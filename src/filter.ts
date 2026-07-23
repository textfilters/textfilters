import {
  buildTokenPatternIndex,
  buildLoosePatterns,
  buildStrictPatterns,
  type MatcherTerms,
  type StrictPatternSet,
} from "./matchers/build.js";
import type { CompiledPattern } from "./matchers/compile.js";
import {
  buildLooseCandidateIndex,
  collectInputScanFacts,
  createInputScanFactCollector,
  looseCandidatePatterns,
  type InputScanFacts,
  type LooseCandidateIndex,
} from "./matchers/loose-candidates.js";
import {
  createBuiltInProfanityRules,
  type InternalProfanityRuleDefinition,
} from "./matchers/internal-rules.js";
import { normalizeTermList } from "./matchers/terms.js";
import {
  dictionaryRulesForMode,
  type ProfanityDictionaryCompileOptions,
  type ProfanityLanguageDictionary,
  type ProfanityNormalizationStrategy,
} from "./languages/profanity.js";
import {
  validateProfanityLanguageDictionary,
  type ProfanityLanguageDictionaryValidationIssue,
} from "./languages/validation.js";
import {
  matchRangeForMode,
  PROFANITY_MATCH_MODE,
  textRangesForMode,
} from "./matches/ranges.js";
import { normalizeTextInput } from "@textfilters/core";
import {
  normalizeForMatchSameLen,
  normalizeForMatchSameLenWithoutHomoglyphs,
  prepareForMatchSameLen,
  prepareForMatchSameLenWithoutHomoglyphs,
  type MatchInputPreparer,
} from "./normalization/text.js";
import { hasLooseRange, iterateLooseRanges } from "./ranges/loose.js";
import { hasStrictRange, iterateStrictRanges } from "./ranges/strict.js";
import { maskProfanityRanges } from "./token-ranges.js";
import { LOOSE_BASE } from "./terms/loose-base.js";
import { STRICT_BASE } from "./terms/strict-base.js";
import {
  PROFANITY_FILTER_NAME,
  type ProfanityFilter,
  type ProfanityMatchOptions,
  type ProfanityMatchRange,
  type ProfanityScanHints,
  type ProfanitySeverity,
  type ProfanityTermList,
  type ReadonlyProfanityFilter,
} from "./types.js";
import {
  compileLooseLiteralPatterns,
  compileStrictLiteralPatterns,
  compileStrictPhraseLiteralPatterns,
  compileStrictSymbolLiteralPatterns,
  normalizeLiteralTerm,
  type LiteralTermDefinition,
  type LiteralNormalizer,
  strictSymbolLiteralLengths,
} from "./matchers/literals.js";

interface FilterState {
  // Built-in rules and runtime literals are stored separately so appending a
  // tenant literal never changes how the bundled regex-like corpus is compiled.
  strictTerms: MatcherTerms;
  looseTerms: MatcherTerms;
  strictPatterns: StrictPatternSet;
  loosePatterns: CompiledPattern[];
  looseCandidateIndex: LooseCandidateIndex;
  strictBasePatterns?: StrictPatternSet;
  looseBasePatterns?: readonly CompiledPattern[];
  normalization: ProfanityNormalizationStrategy;
  normalizeForMatch: LiteralNormalizer;
  prepareForMatch: MatchInputPreparer;
}

type FilterStateSnapshot = Pick<
  FilterState,
  | "strictPatterns"
  | "loosePatterns"
  | "looseCandidateIndex"
  | "normalization"
  | "normalizeForMatch"
  | "prepareForMatch"
>;

export interface CompiledProfanityDictionary {
  readonly language: string;
  readonly normalization: ProfanityNormalizationStrategy;
  readonly strictRuleCount: number;
  readonly looseRuleCount: number;
}

interface CompiledDictionaryState {
  readonly strictTerms: MatcherTerms;
  readonly looseTerms: MatcherTerms;
  readonly strictPatterns: StrictPatternSet;
  readonly loosePatterns: readonly CompiledPattern[];
  readonly normalization: ProfanityNormalizationStrategy;
  readonly normalizeForMatch: LiteralNormalizer;
  readonly prepareForMatch: MatchInputPreparer;
}

interface PreparedNormalizationView {
  readonly normalized: string;
  readonly scanFacts: WeakMap<LooseCandidateIndex, InputScanFacts>;
}

export interface PreparedProfanityInput {
  readonly text: string;
  readonly codePoints?: readonly string[];
  readonly hints?: ProfanityScanHints;
  readonly normalizedViews: Map<
    ProfanityNormalizationStrategy,
    PreparedNormalizationView
  >;
}

const compiledDictionaryStates = new WeakMap<
  CompiledProfanityDictionary,
  CompiledDictionaryState
>();
const COMPILED_DICTIONARY_STATE =
  "__textfiltersProfanityCompiledDictionaryState";
const filterStates = new WeakMap<ReadonlyProfanityFilter, FilterState>();
type ProfanityMatchStreamer = (
  input: PreparedProfanityInput,
  options: ProfanityMatchOptions | undefined,
  visit: (match: ProfanityMatchRange) => boolean | void,
) => boolean;
type ProfanityPreparedAnalyzer = (
  input: PreparedProfanityInput,
  options: ProfanityMatchOptions | undefined,
) => ProfanityMatchRange[];
const profanityMatchStreamers = new WeakMap<
  ReadonlyProfanityFilter,
  ProfanityMatchStreamer
>();
const profanityPreparedAnalyzers = new WeakMap<
  ReadonlyProfanityFilter,
  ProfanityPreparedAnalyzer
>();

type CompiledProfanityDictionaryWithState = CompiledProfanityDictionary & {
  readonly [COMPILED_DICTIONARY_STATE]?: CompiledDictionaryState;
};

export const canStreamProfanityMatches = (
  filter: ReadonlyProfanityFilter,
): boolean => filterStates.has(filter) || profanityMatchStreamers.has(filter);

export const createPreparedProfanityInput = (
  text: string,
  scanInput?: {
    readonly codePoints?: readonly string[];
    readonly hints?: ProfanityScanHints;
  },
): PreparedProfanityInput => {
  const codePoints = scanInput?.codePoints;
  // Preserve generic hints as optional evidence, but derive length facts from
  // the actual invocation input before package-owned code can use them.
  const hints =
    scanInput?.hints === undefined
      ? undefined
      : {
          ...scanInput.hints,
          textLength: text.length,
          ...(codePoints === undefined
            ? {}
            : { codePointLength: codePoints.length }),
          isEmpty: text.length === 0,
        };

  return {
    text,
    ...(codePoints === undefined ? {} : { codePoints }),
    ...(hints === undefined ? {} : { hints }),
    normalizedViews: new Map(),
  };
};

export const normalizedTextForPreparedProfanityInput = (
  input: PreparedProfanityInput,
  normalization: ProfanityNormalizationStrategy,
  normalizeForMatch: LiteralNormalizer,
): string =>
  normalizedViewForPreparedInput(input, normalization, normalizeForMatch)
    .normalized;

export const registerProfanityMatchStreamer = (
  filter: ReadonlyProfanityFilter,
  streamer: ProfanityMatchStreamer,
): void => {
  profanityMatchStreamers.set(filter, streamer);
};

export const registerProfanityPreparedAnalyzer = (
  filter: ReadonlyProfanityFilter,
  analyzer: ProfanityPreparedAnalyzer,
): void => {
  profanityPreparedAnalyzers.set(filter, analyzer);
};

export const createProfanityFilter = (
  strictTerms: ProfanityTermList = STRICT_BASE,
  looseTerms: ProfanityTermList = LOOSE_BASE,
): ProfanityFilter => createFilter(createState(strictTerms, looseTerms));

export const compileProfanityDictionary = (
  dictionary: ProfanityLanguageDictionary,
  options: ProfanityDictionaryCompileOptions = {},
): CompiledProfanityDictionary => {
  assertValidProfanityLanguageDictionary(dictionary);

  const normalization =
    options.normalization ??
    dictionary.normalization ??
    DEFAULT_NORMALIZATION_STRATEGY;
  const state = compileDictionaryState(dictionary, normalization);
  const compiled: CompiledProfanityDictionary = {
    language: dictionary.language,
    normalization,
    strictRuleCount: state.strictTerms.internal.length,
    looseRuleCount: state.looseTerms.internal.length,
  };

  compiledDictionaryStates.set(compiled, state);
  Object.defineProperty(compiled, COMPILED_DICTIONARY_STATE, {
    value: state,
    enumerable: false,
  });

  return compiled;
};

export const createProfanityFilterFromDictionary = (
  dictionary: ProfanityLanguageDictionary,
  options: ProfanityDictionaryCompileOptions = {},
): ProfanityFilter =>
  createProfanityFilterFromCompiledDictionary(
    compileProfanityDictionary(dictionary, options),
  );

export const createProfanityFilterFromCompiledDictionary = (
  dictionary: CompiledProfanityDictionary,
): ProfanityFilter => {
  const compiledState =
    compiledDictionaryStates.get(dictionary) ??
    (dictionary as CompiledProfanityDictionaryWithState)[
      COMPILED_DICTIONARY_STATE
    ];

  if (compiledState === undefined) {
    throw new TypeError(
      "Expected a compiled profanity dictionary created by compileProfanityDictionary().",
    );
  }

  return createFilter(createStateFromCompiledDictionary(compiledState));
};

function assertValidProfanityLanguageDictionary(
  dictionary: ProfanityLanguageDictionary,
): void {
  const issues = validateProfanityLanguageDictionary(dictionary);

  if (issues.length === 0) {
    return;
  }

  throw new TypeError(
    `Invalid profanity language dictionary: ${formatValidationIssues(issues)}`,
  );
}

function formatValidationIssues(
  issues: readonly ProfanityLanguageDictionaryValidationIssue[],
): string {
  const formatted = issues
    .slice(0, 3)
    .map(({ path, code, message }) => `${path} ${code}: ${message}`);
  const remaining = issues.length - formatted.length;

  return remaining > 0
    ? `${formatted.join("; ")}; and ${remaining} more issue${
        remaining === 1 ? "" : "s"
      }`
    : formatted.join("; ");
}

function createFilter(state: FilterState): ProfanityFilter {
  const filter: ProfanityFilter = {
    name: PROFANITY_FILTER_NAME,
    analyze: (text, options) => {
      const input = createPreparedProfanityInput(normalizeTextInput(text));
      return collectProfanityMatches(state, input, options);
    },
    check: (text, options) => {
      const input = createPreparedProfanityInput(normalizeTextInput(text));
      return hasProfanity(state, input, options);
    },
    censor: (text, options) => {
      const input = createPreparedProfanityInput(normalizeTextInput(text));
      return censorText(state, input, options);
    },
    setStrict: (list) => {
      state.strictTerms = runtimeLiteralTerms(list, state.normalizeForMatch);
      state.strictBasePatterns = undefined;
      rebuildStrict(state);
    },
    addStrict: (term) => {
      state.strictTerms = appendRuntimeLiteralTerm(
        state.strictTerms,
        term,
        state.normalizeForMatch,
      );
      rebuildStrict(state);
    },
    setLoose: (list) => {
      state.looseTerms = runtimeLiteralTerms(list, state.normalizeForMatch);
      state.looseBasePatterns = undefined;
      rebuildLoose(state);
    },
    addLoose: (term) => {
      state.looseTerms = appendRuntimeLiteralTerm(
        state.looseTerms,
        term,
        state.normalizeForMatch,
      );
      rebuildLoose(state);
    },
  };

  filterStates.set(filter, state);
  return filter;
}

function createReadOnlyFilter(
  filter: ProfanityFilter,
): ReadonlyProfanityFilter {
  const readOnlyFilter = Object.freeze({
    name: filter.name,
    analyze: filter.analyze,
    check: filter.check,
    censor: filter.censor,
    setStrict: rejectReadOnlyFilterMutation,
    addStrict: rejectReadOnlyFilterMutation,
    setLoose: rejectReadOnlyFilterMutation,
    addLoose: rejectReadOnlyFilterMutation,
  });

  const state = filterStates.get(filter);
  if (state !== undefined) {
    filterStates.set(readOnlyFilter, state);
  }

  return readOnlyFilter;
}

function rejectReadOnlyFilterMutation(): never {
  throw new TypeError(
    "The shared profanity filter is read-only. Use createProfanityFilter() or a dictionary factory to create a mutable filter.",
  );
}

function createState(
  strictTerms: ProfanityTermList,
  looseTerms: ProfanityTermList,
): FilterState {
  const state: FilterState = {
    strictTerms:
      strictTerms === STRICT_BASE
        ? builtInRuleTerms(strictTerms, "strict")
        : runtimeLiteralTerms(strictTerms, normalizeForMatchSameLen),
    looseTerms:
      looseTerms === LOOSE_BASE
        ? builtInRuleTerms(looseTerms, "loose")
        : runtimeLiteralTerms(looseTerms, normalizeForMatchSameLen),
    strictPatterns: {
      token: [],
      tokenIndex: buildTokenPatternIndex([]),
      symbolToken: [],
      symbolLengths: [],
      phrase: [],
    },
    loosePatterns: [],
    looseCandidateIndex: buildLooseCandidateIndex([]),
    normalization: DEFAULT_NORMALIZATION_STRATEGY,
    normalizeForMatch: normalizeForMatchSameLen,
    prepareForMatch: prepareForMatchSameLen,
  };

  rebuildStrict(state);
  rebuildLoose(state);

  return state;
}

function compileDictionaryState(
  dictionary: ProfanityLanguageDictionary,
  normalization: ProfanityNormalizationStrategy,
): CompiledDictionaryState {
  const strictTerms = builtInRuleTerms(
    dictionaryRulesForMode(dictionary, "strict"),
    "strict",
  );
  const looseTerms = builtInRuleTerms(
    dictionaryRulesForMode(dictionary, "loose"),
    "loose",
  );
  const { normalizeForMatch, prepareForMatch } =
    normalizersForStrategy(normalization);

  return {
    strictTerms,
    looseTerms,
    strictPatterns: buildStrictPatterns(strictTerms, normalizeForMatch),
    loosePatterns: buildLoosePatterns(looseTerms, normalizeForMatch),
    normalization,
    normalizeForMatch,
    prepareForMatch,
  };
}

const DEFAULT_NORMALIZATION_STRATEGY: ProfanityNormalizationStrategy =
  "cyrillic-homoglyphs";

const normalizersForStrategy = (
  strategy: ProfanityNormalizationStrategy,
): {
  readonly normalizeForMatch: LiteralNormalizer;
  readonly prepareForMatch: MatchInputPreparer;
} => {
  switch (strategy) {
    case "cyrillic-homoglyphs":
      return {
        normalizeForMatch: normalizeForMatchSameLen,
        prepareForMatch: prepareForMatchSameLen,
      };
    case "latin-preserving":
      return {
        normalizeForMatch: normalizeForMatchSameLenWithoutHomoglyphs,
        prepareForMatch: prepareForMatchSameLenWithoutHomoglyphs,
      };
    default:
      throw new TypeError(`Unsupported profanity normalization: ${strategy}`);
  }
};

function createStateFromCompiledDictionary(
  state: CompiledDictionaryState,
): FilterState {
  return {
    strictTerms: cloneMatcherTerms(state.strictTerms),
    looseTerms: cloneMatcherTerms(state.looseTerms),
    strictPatterns: cloneStrictPatternSet(state.strictPatterns),
    loosePatterns: [...state.loosePatterns],
    looseCandidateIndex: buildLooseCandidateIndex(state.loosePatterns),
    strictBasePatterns: cloneStrictPatternSet(state.strictPatterns),
    looseBasePatterns: [...state.loosePatterns],
    normalization: state.normalization,
    normalizeForMatch: state.normalizeForMatch,
    prepareForMatch: state.prepareForMatch,
  };
}

function cloneMatcherTerms(terms: MatcherTerms): MatcherTerms {
  return {
    internal: [...terms.internal],
    literals: [...terms.literals],
  };
}

function cloneStrictPatternSet(patterns: StrictPatternSet): StrictPatternSet {
  const token = [...patterns.token];
  return {
    token,
    tokenIndex: buildTokenPatternIndex(token),
    symbolToken: [...patterns.symbolToken],
    symbolLengths: [...patterns.symbolLengths],
    phrase: [...patterns.phrase],
  };
}

function rebuildStrict(state: FilterState): void {
  state.strictPatterns =
    state.strictBasePatterns === undefined ||
    state.strictTerms.internal.length === 0
      ? buildStrictPatterns(state.strictTerms, state.normalizeForMatch)
      : appendStrictLiteralPatterns(
          state.strictBasePatterns,
          state.strictTerms.literals,
          state.normalizeForMatch,
        );
}

function rebuildLoose(state: FilterState): void {
  state.loosePatterns =
    state.looseBasePatterns === undefined ||
    state.looseTerms.internal.length === 0
      ? buildLoosePatterns(state.looseTerms, state.normalizeForMatch)
      : [
          ...state.looseBasePatterns,
          ...compileLooseLiteralPatterns(
            state.looseTerms.literals,
            state.normalizeForMatch,
          ),
        ];
  state.looseCandidateIndex = buildLooseCandidateIndex(state.loosePatterns);
}

function appendStrictLiteralPatterns(
  basePatterns: StrictPatternSet,
  literals: readonly LiteralTermDefinition[],
  normalize: LiteralNormalizer,
): StrictPatternSet {
  const token = [
    ...basePatterns.token,
    ...compileStrictLiteralPatterns(literals, true, normalize),
  ];

  return {
    token,
    tokenIndex: buildTokenPatternIndex(token),
    symbolToken: [
      ...basePatterns.symbolToken,
      ...compileStrictSymbolLiteralPatterns(literals, normalize),
    ],
    symbolLengths: [
      ...basePatterns.symbolLengths,
      ...strictSymbolLiteralLengths(literals, normalize),
    ],
    phrase: [
      ...basePatterns.phrase,
      ...compileStrictPhraseLiteralPatterns(literals, normalize),
    ],
  };
}

const builtInRuleTerms = (
  terms: ProfanityTermList,
  corpus: "strict" | "loose",
): MatcherTerms => ({
  internal: createBuiltInProfanityRules(builtInRuleDefinitions(terms), corpus),
  literals: [],
});

const builtInRuleDefinitions = (
  terms: ProfanityTermList,
): InternalProfanityRuleDefinition[] =>
  Array.isArray(terms)
    ? terms.flatMap((term): InternalProfanityRuleDefinition[] =>
        isRuleDefinition(term)
          ? [normalizedRuleDefinition(term)]
          : normalizeTermList([term]),
      )
    : [];

const normalizedRuleDefinition = (
  definition: Extract<InternalProfanityRuleDefinition, { source: string }>,
): Extract<InternalProfanityRuleDefinition, { source: string }> => ({
  ...definition,
  source: definition.source.trim(),
});

const isRuleDefinition = (
  term: unknown,
): term is Extract<InternalProfanityRuleDefinition, { source: string }> =>
  typeof term === "object" &&
  term !== null &&
  "source" in term &&
  typeof term.source === "string" &&
  term.source.trim().length > 0;

const runtimeLiteralTerms = (
  terms: ProfanityTermList,
  normalize: LiteralNormalizer,
): MatcherTerms => ({
  internal: [],
  literals: literalDefinitions(terms, normalize),
});

const appendRuntimeLiteralTerm = (
  terms: MatcherTerms,
  term: unknown,
  normalize: LiteralNormalizer,
): MatcherTerms => ({
  // Keep the existing internal rules intact and append only to the literal side.
  internal: terms.internal,
  literals: appendLiteralTerm(terms.literals, term, normalize),
});

const literalDefinitions = (
  terms: ProfanityTermList,
  normalize: LiteralNormalizer,
): LiteralTermDefinition[] => {
  if (!Array.isArray(terms)) {
    return [];
  }

  const seen = new Set<string>();
  const definitions: LiteralTermDefinition[] = [];

  for (const term of terms) {
    const definition = literalDefinition(term);
    if (definition === null) {
      continue;
    }

    const key = normalizeLiteralTerm(definition.source, normalize);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    definitions.push(definition);
  }

  return definitions;
};

const appendLiteralTerm = (
  terms: readonly LiteralTermDefinition[],
  term: unknown,
  normalize: LiteralNormalizer,
): LiteralTermDefinition[] => {
  const definition = literalDefinition(term);
  if (definition === null) {
    return [...terms];
  }

  const key = normalizeLiteralTerm(definition.source, normalize);

  return terms.some(
    (term) => normalizeLiteralTerm(term.source, normalize) === key,
  )
    ? [...terms]
    : [...terms, definition];
};

const literalDefinition = (term: unknown): LiteralTermDefinition | null => {
  if (isRuleDefinition(term)) {
    return {
      source: term.source.trim(),
      ...(term.category === undefined ? {} : { category: term.category }),
      ...(term.severity === undefined ? {} : { severity: term.severity }),
    };
  }

  const [source] = normalizeTermList([term]);
  return source === undefined ? null : { source };
};

const hasProfanity = (
  state: FilterStateSnapshot,
  input: PreparedProfanityInput,
  options?: ProfanityMatchOptions,
): boolean => {
  // Keep boolean checks strict-first: measured eager fact collection makes a
  // late strict hit slower, while strict misses still use the compatibility
  // collector over the same normalized representation.
  const normalized = normalizedTextForPreparedProfanityInput(
    input,
    state.normalization,
    state.normalizeForMatch,
  );
  const matchesTaxonomy = collectedRangeMatchesTaxonomy(options);

  if (hasStrictRange(normalized, state.strictPatterns, matchesTaxonomy)) {
    return true;
  }

  const facts = scanFactsForPreparedInput(state, input, normalized);
  const looseCandidates = looseCandidatePatterns(
    state.looseCandidateIndex,
    facts,
  );
  if (looseCandidates.length === 0) {
    return false;
  }

  return hasLooseRange(
    normalized,
    input.text,
    looseCandidates,
    state.strictPatterns,
    matchesTaxonomy,
    state.loosePatterns,
  );
};

const censorText = (
  state: FilterStateSnapshot,
  input: PreparedProfanityInput,
  options?: ProfanityMatchOptions,
): string => {
  const matches = collectProfanityMatches(state, input, options);
  return maskProfanityRanges(
    input.text,
    textRangesForMode(matches, PROFANITY_MATCH_MODE.STRICT),
    textRangesForMode(matches, PROFANITY_MATCH_MODE.LOOSE),
  );
};

const collectProfanityMatches = (
  state: FilterStateSnapshot,
  input: PreparedProfanityInput,
  options?: ProfanityMatchOptions,
): ProfanityMatchRange[] => [...iterateProfanityMatches(state, input, options)];

export const streamPreparedProfanityMatches = (
  filter: ReadonlyProfanityFilter,
  input: PreparedProfanityInput,
  options: ProfanityMatchOptions | undefined,
  visit: (match: ProfanityMatchRange) => boolean | void,
): boolean | undefined => {
  const customStreamer = profanityMatchStreamers.get(filter);
  if (customStreamer !== undefined) {
    return customStreamer(input, options, visit);
  }

  const state = filterStates.get(filter);
  if (state === undefined) return undefined;
  const snapshot = snapshotFilterState(state);

  for (const match of iterateProfanityMatches(snapshot, input, options)) {
    if (visit(match) === false) return false;
  }

  return true;
};

export const analyzePreparedProfanity = (
  filter: ReadonlyProfanityFilter,
  input: PreparedProfanityInput,
  options?: ProfanityMatchOptions,
): ProfanityMatchRange[] | undefined => {
  const state = filterStates.get(filter);
  if (state !== undefined) {
    return collectProfanityMatches(snapshotFilterState(state), input, options);
  }

  const analyzer = profanityPreparedAnalyzers.get(filter);
  if (analyzer !== undefined) {
    return analyzer(input, options);
  }

  if (!profanityMatchStreamers.has(filter)) return undefined;
  const matches: ProfanityMatchRange[] = [];
  streamPreparedProfanityMatches(filter, input, options, (match) => {
    matches.push(match);
  });
  return matches;
};

export const checkPreparedProfanity = (
  filter: ReadonlyProfanityFilter,
  input: PreparedProfanityInput,
  options?: ProfanityMatchOptions,
): boolean | undefined => {
  const state = filterStates.get(filter);
  if (state !== undefined) {
    return hasProfanity(snapshotFilterState(state), input, options);
  }

  if (!profanityMatchStreamers.has(filter)) return undefined;
  let found = false;
  streamPreparedProfanityMatches(filter, input, options, () => {
    found = true;
    return false;
  });
  return found;
};

const snapshotFilterState = (state: FilterState): FilterStateSnapshot => ({
  strictPatterns: state.strictPatterns,
  loosePatterns: state.loosePatterns,
  looseCandidateIndex: state.looseCandidateIndex,
  normalization: state.normalization,
  normalizeForMatch: state.normalizeForMatch,
  prepareForMatch: state.prepareForMatch,
});

function* iterateProfanityMatches(
  state: FilterStateSnapshot,
  input: PreparedProfanityInput,
  options?: ProfanityMatchOptions,
): IterableIterator<ProfanityMatchRange> {
  const { normalized, facts } = prepareInput(state, input);
  const matchesTaxonomy = collectedRangeMatchesTaxonomy(options);

  for (const range of iterateStrictRanges(normalized, state.strictPatterns)) {
    const match = matchRangeForMode(range, PROFANITY_MATCH_MODE.STRICT);
    if (matchesTaxonomy(match)) {
      yield match;
    }
  }

  const looseCandidates = looseCandidatePatterns(
    state.looseCandidateIndex,
    facts,
  );
  if (looseCandidates.length === 0) {
    return;
  }

  for (const range of iterateLooseRanges(
    normalized,
    input.text,
    looseCandidates,
    state.strictPatterns,
    state.loosePatterns,
  )) {
    const match = matchRangeForMode(range, PROFANITY_MATCH_MODE.LOOSE);
    if (matchesTaxonomy(match)) {
      yield match;
    }
  }
}

const prepareInput = (
  state: FilterStateSnapshot,
  input: PreparedProfanityInput,
): { readonly normalized: string; readonly facts: InputScanFacts } => {
  const existing = input.normalizedViews.get(state.normalization);
  if (existing !== undefined) {
    const facts =
      existing.scanFacts.get(state.looseCandidateIndex) ??
      collectInputScanFacts(existing.normalized, state.looseCandidateIndex);
    existing.scanFacts.set(state.looseCandidateIndex, facts);
    return { normalized: existing.normalized, facts };
  }

  const collector = createInputScanFactCollector(state.looseCandidateIndex);
  // Normalization and loose candidate facts share one same-length UTF-16 pass,
  // so every collected position stays source-compatible.
  const normalized = state.prepareForMatch(input.text, collector.visit);
  const facts = collector.finish();
  const view: PreparedNormalizationView = {
    normalized,
    scanFacts: new WeakMap([[state.looseCandidateIndex, facts]]),
  };
  input.normalizedViews.set(state.normalization, view);
  return { normalized, facts };
};

const normalizedViewForPreparedInput = (
  input: PreparedProfanityInput,
  normalization: ProfanityNormalizationStrategy,
  normalizeForMatch: LiteralNormalizer,
): PreparedNormalizationView => {
  const existing = input.normalizedViews.get(normalization);
  if (existing !== undefined) return existing;

  const created: PreparedNormalizationView = {
    normalized: normalizeForMatch(input.text),
    scanFacts: new WeakMap(),
  };
  input.normalizedViews.set(normalization, created);
  return created;
};

const scanFactsForPreparedInput = (
  state: FilterStateSnapshot,
  input: PreparedProfanityInput,
  normalized: string,
): InputScanFacts => {
  const view = input.normalizedViews.get(state.normalization);
  if (view === undefined) {
    throw new TypeError("Expected a prepared profanity normalization view.");
  }

  const existing = view.scanFacts.get(state.looseCandidateIndex);
  if (existing !== undefined) return existing;

  const created = collectInputScanFacts(normalized, state.looseCandidateIndex);
  view.scanFacts.set(state.looseCandidateIndex, created);
  return created;
};

const hasTaxonomyFilters = (options: ProfanityMatchOptions): boolean =>
  options.categories !== undefined ||
  options.severities !== undefined ||
  options.minSeverity !== undefined;

const collectedRangeMatchesTaxonomy = (
  options: ProfanityMatchOptions | undefined,
): ((range: Pick<ProfanityMatchRange, "category" | "severity">) => boolean) => {
  if (options === undefined || !hasTaxonomyFilters(options)) {
    return () => true;
  }

  const categories =
    options.categories === undefined ? undefined : new Set(options.categories);
  const severities =
    options.severities === undefined ? undefined : new Set(options.severities);
  const minSeverity = options.minSeverity;

  return (range) =>
    rangeMatchesTaxonomy(range, categories, severities, minSeverity);
};

const rangeMatchesTaxonomy = (
  match: Pick<ProfanityMatchRange, "category" | "severity">,
  categories:
    | ReadonlySet<NonNullable<ProfanityMatchRange["category"]>>
    | undefined,
  severities:
    | ReadonlySet<NonNullable<ProfanityMatchRange["severity"]>>
    | undefined,
  minSeverity: ProfanitySeverity | undefined,
): boolean =>
  (categories === undefined ||
    (match.category !== undefined && categories.has(match.category))) &&
  (severities === undefined ||
    (match.severity !== undefined && severities.has(match.severity))) &&
  (minSeverity === undefined ||
    (match.severity !== undefined &&
      isAtLeastSeverity(match.severity, minSeverity)));

const PROFANITY_SEVERITY_RANK: Record<ProfanitySeverity, number> = {
  soft: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const isAtLeastSeverity = (
  severity: ProfanitySeverity,
  minSeverity: ProfanitySeverity,
): boolean =>
  PROFANITY_SEVERITY_RANK[severity] >= PROFANITY_SEVERITY_RANK[minSeverity];

export const profanityFilter = createProfanityFilter;
export const filter: ReadonlyProfanityFilter = createReadOnlyFilter(
  createProfanityFilter(STRICT_BASE, LOOSE_BASE),
);
