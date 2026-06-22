import {
  buildLoosePatterns,
  buildStrictPatterns,
  type MatcherTerms,
  type StrictPatternSet,
} from "./matchers/build.js";
import type { CompiledPattern } from "./matchers/compile.js";
import {
  createBuiltInProfanityRules,
  type InternalProfanityRuleDefinition,
} from "./matchers/internal-rules.js";
import { normalizeTermList } from "./matchers/terms.js";
import {
  dictionaryRulesForMode,
  type ProfanityLanguageDictionary,
} from "./languages/profanity.js";
import {
  type CollectedProfanityRange,
  matchRangesForMode,
  PROFANITY_MATCH_MODE,
  textRangesForMode,
} from "./matches/ranges.js";
import { normalizeForMatchSameLen } from "./normalization/text.js";
import { collectLooseRanges } from "./ranges/loose.js";
import { collectStrictRanges } from "./ranges/strict.js";
import { maskProfanityRanges } from "./token-ranges.js";
import { LOOSE_BASE } from "./terms/loose-base.js";
import { STRICT_BASE } from "./terms/strict-base.js";
import {
  PROFANITY_FILTER_NAME,
  type ProfanityFilter,
  type ProfanityMatchOptions,
  type ProfanityMatchRange,
  type ProfanitySeverity,
  type ProfanityTermList,
} from "./types.js";
import {
  compileLooseLiteralPatterns,
  compileStrictLiteralPatterns,
  compileStrictPhraseLiteralPatterns,
  compileStrictSymbolLiteralPatterns,
  normalizeLiteralTerm,
  type LiteralTermDefinition,
  strictSymbolLiteralLengths,
} from "./matchers/literals.js";

interface FilterState {
  // Built-in rules and runtime literals are stored separately so appending a
  // tenant literal never changes how the bundled regex-like corpus is compiled.
  strictTerms: MatcherTerms;
  looseTerms: MatcherTerms;
  strictPatterns: StrictPatternSet;
  loosePatterns: CompiledPattern[];
  strictBasePatterns?: StrictPatternSet;
  looseBasePatterns?: readonly CompiledPattern[];
}

export interface CompiledProfanityDictionary {
  readonly language: string;
  readonly strictRuleCount: number;
  readonly looseRuleCount: number;
}

interface CompiledDictionaryState {
  readonly strictTerms: MatcherTerms;
  readonly looseTerms: MatcherTerms;
  readonly strictPatterns: StrictPatternSet;
  readonly loosePatterns: readonly CompiledPattern[];
}

const compiledDictionaryStates = new WeakMap<
  CompiledProfanityDictionary,
  CompiledDictionaryState
>();
const COMPILED_DICTIONARY_STATE =
  "__textfiltersProfanityCompiledDictionaryState";

type CompiledProfanityDictionaryWithState = CompiledProfanityDictionary & {
  readonly [COMPILED_DICTIONARY_STATE]?: CompiledDictionaryState;
};

export const createProfanityFilter = (
  strictTerms: ProfanityTermList = STRICT_BASE,
  looseTerms: ProfanityTermList = LOOSE_BASE,
): ProfanityFilter => createFilter(createState(strictTerms, looseTerms));

export const compileProfanityDictionary = (
  dictionary: ProfanityLanguageDictionary,
): CompiledProfanityDictionary => {
  const state = compileDictionaryState(dictionary);
  const compiled: CompiledProfanityDictionary = {
    language: dictionary.language,
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
): ProfanityFilter =>
  createProfanityFilterFromCompiledDictionary(
    compileProfanityDictionary(dictionary),
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

function createFilter(state: FilterState): ProfanityFilter {
  return {
    name: PROFANITY_FILTER_NAME,
    analyze: (text, options) =>
      collectProfanityMatches(state, String(text), options),
    check: (text, options) => hasProfanity(state, String(text), options),
    censor: (text, options) => censorText(state, String(text), options),
    setStrict: (list) => {
      state.strictTerms = runtimeLiteralTerms(list);
      state.strictBasePatterns = undefined;
      rebuildStrict(state);
    },
    addStrict: (term) => {
      state.strictTerms = appendRuntimeLiteralTerm(state.strictTerms, term);
      rebuildStrict(state);
    },
    setLoose: (list) => {
      state.looseTerms = runtimeLiteralTerms(list);
      state.looseBasePatterns = undefined;
      rebuildLoose(state);
    },
    addLoose: (term) => {
      state.looseTerms = appendRuntimeLiteralTerm(state.looseTerms, term);
      rebuildLoose(state);
    },
  };
}

function createState(
  strictTerms: ProfanityTermList,
  looseTerms: ProfanityTermList,
): FilterState {
  const state: FilterState = {
    strictTerms:
      strictTerms === STRICT_BASE
        ? builtInRuleTerms(strictTerms, "strict")
        : runtimeLiteralTerms(strictTerms),
    looseTerms:
      looseTerms === LOOSE_BASE
        ? builtInRuleTerms(looseTerms, "loose")
        : runtimeLiteralTerms(looseTerms),
    strictPatterns: {
      token: [],
      symbolToken: [],
      symbolLengths: [],
      phrase: [],
    },
    loosePatterns: [],
  };

  rebuildStrict(state);
  rebuildLoose(state);

  return state;
}

function compileDictionaryState(
  dictionary: ProfanityLanguageDictionary,
): CompiledDictionaryState {
  const strictTerms = builtInRuleTerms(
    dictionaryRulesForMode(dictionary, "strict"),
    "strict",
  );
  const looseTerms = builtInRuleTerms(
    dictionaryRulesForMode(dictionary, "loose"),
    "loose",
  );

  return {
    strictTerms,
    looseTerms,
    strictPatterns: buildStrictPatterns(strictTerms),
    loosePatterns: buildLoosePatterns(looseTerms),
  };
}

function createStateFromCompiledDictionary(
  state: CompiledDictionaryState,
): FilterState {
  return {
    strictTerms: cloneMatcherTerms(state.strictTerms),
    looseTerms: cloneMatcherTerms(state.looseTerms),
    strictPatterns: cloneStrictPatternSet(state.strictPatterns),
    loosePatterns: [...state.loosePatterns],
    strictBasePatterns: cloneStrictPatternSet(state.strictPatterns),
    looseBasePatterns: [...state.loosePatterns],
  };
}

function cloneMatcherTerms(terms: MatcherTerms): MatcherTerms {
  return {
    internal: [...terms.internal],
    literals: [...terms.literals],
  };
}

function cloneStrictPatternSet(patterns: StrictPatternSet): StrictPatternSet {
  return {
    token: [...patterns.token],
    symbolToken: [...patterns.symbolToken],
    symbolLengths: [...patterns.symbolLengths],
    phrase: [...patterns.phrase],
  };
}

function rebuildStrict(state: FilterState): void {
  state.strictPatterns =
    state.strictBasePatterns === undefined ||
    state.strictTerms.internal.length === 0
      ? buildStrictPatterns(state.strictTerms)
      : appendStrictLiteralPatterns(
          state.strictBasePatterns,
          state.strictTerms.literals,
        );
}

function rebuildLoose(state: FilterState): void {
  state.loosePatterns =
    state.looseBasePatterns === undefined ||
    state.looseTerms.internal.length === 0
      ? buildLoosePatterns(state.looseTerms)
      : [
          ...state.looseBasePatterns,
          ...compileLooseLiteralPatterns(state.looseTerms.literals),
        ];
}

function appendStrictLiteralPatterns(
  basePatterns: StrictPatternSet,
  literals: readonly LiteralTermDefinition[],
): StrictPatternSet {
  return {
    token: [
      ...basePatterns.token,
      ...compileStrictLiteralPatterns(literals, true),
    ],
    symbolToken: [
      ...basePatterns.symbolToken,
      ...compileStrictSymbolLiteralPatterns(literals),
    ],
    symbolLengths: [
      ...basePatterns.symbolLengths,
      ...strictSymbolLiteralLengths(literals),
    ],
    phrase: [
      ...basePatterns.phrase,
      ...compileStrictPhraseLiteralPatterns(literals),
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

const runtimeLiteralTerms = (terms: ProfanityTermList): MatcherTerms => ({
  internal: [],
  literals: literalDefinitions(terms),
});

const appendRuntimeLiteralTerm = (
  terms: MatcherTerms,
  term: unknown,
): MatcherTerms => ({
  // Keep the existing internal rules intact and append only to the literal side.
  internal: terms.internal,
  literals: appendLiteralTerm(terms.literals, term),
});

const literalDefinitions = (
  terms: ProfanityTermList,
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

    const key = normalizeLiteralTerm(definition.source);
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
): LiteralTermDefinition[] => {
  const definition = literalDefinition(term);
  if (definition === null) {
    return [...terms];
  }

  const key = normalizeLiteralTerm(definition.source);

  return terms.some((term) => normalizeLiteralTerm(term.source) === key)
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
  state: FilterState,
  text: string,
  options?: ProfanityMatchOptions,
): boolean => {
  // Normalization is same-length, so collected ranges stay source-compatible.
  const normalized = normalizeForMatchSameLen(text);
  const strictRanges: CollectedProfanityRange[] = [];

  collectStrictRanges(normalized, state.strictPatterns, strictRanges);

  if (hasMatchingCollectedRange(strictRanges, options)) {
    return true;
  }

  const looseRanges: CollectedProfanityRange[] = [];
  collectLooseRanges(
    normalized,
    text,
    state.loosePatterns,
    state.strictPatterns,
    looseRanges,
  );

  return hasMatchingCollectedRange(looseRanges, options);
};

const censorText = (
  state: FilterState,
  text: string,
  options?: ProfanityMatchOptions,
): string => {
  const matches = collectProfanityMatches(state, text, options);
  return maskProfanityRanges(
    text,
    textRangesForMode(matches, PROFANITY_MATCH_MODE.STRICT),
    textRangesForMode(matches, PROFANITY_MATCH_MODE.LOOSE),
  );
};

const collectProfanityMatches = (
  state: FilterState,
  text: string,
  options?: ProfanityMatchOptions,
): ProfanityMatchRange[] => {
  // Normalization is same-length, so ranges collected from the normalized string
  // can be applied directly to the original source string.
  const normalized = normalizeForMatchSameLen(text);
  const strictRanges: CollectedProfanityRange[] = [];
  const looseRanges: CollectedProfanityRange[] = [];

  collectStrictRanges(normalized, state.strictPatterns, strictRanges);
  collectLooseRanges(
    normalized,
    text,
    state.loosePatterns,
    state.strictPatterns,
    looseRanges,
  );

  return filterMatchesByTaxonomy(
    [
      ...matchRangesForMode(strictRanges, PROFANITY_MATCH_MODE.STRICT),
      ...matchRangesForMode(looseRanges, PROFANITY_MATCH_MODE.LOOSE),
    ],
    options,
  );
};

const filterMatchesByTaxonomy = (
  matches: ProfanityMatchRange[],
  options: ProfanityMatchOptions | undefined,
): ProfanityMatchRange[] => {
  if (options === undefined) {
    return matches;
  }

  const categories =
    options.categories === undefined ? undefined : new Set(options.categories);
  const severities =
    options.severities === undefined ? undefined : new Set(options.severities);
  const minSeverity = options.minSeverity;

  if (
    categories === undefined &&
    severities === undefined &&
    minSeverity === undefined
  ) {
    return matches;
  }

  return matches.filter((match) =>
    rangeMatchesTaxonomy(match, categories, severities, minSeverity),
  );
};

const hasMatchingCollectedRange = (
  ranges: readonly CollectedProfanityRange[],
  options: ProfanityMatchOptions | undefined,
): boolean => {
  if (options === undefined || !hasTaxonomyFilters(options)) {
    return ranges.length > 0;
  }

  const categories =
    options.categories === undefined ? undefined : new Set(options.categories);
  const severities =
    options.severities === undefined ? undefined : new Set(options.severities);

  return ranges.some((range) =>
    rangeMatchesTaxonomy(range, categories, severities, options.minSeverity),
  );
};

const hasTaxonomyFilters = (options: ProfanityMatchOptions): boolean =>
  options.categories !== undefined ||
  options.severities !== undefined ||
  options.minSeverity !== undefined;

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
export const filter = createProfanityFilter(STRICT_BASE, LOOSE_BASE);
