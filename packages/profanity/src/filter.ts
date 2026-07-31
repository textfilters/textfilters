import {
  collectInputScanFacts,
  createInputScanFactCollector,
  loosePatternCandidates,
  type InputScanFacts,
} from "./matchers/loose-candidates.js";
import {
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
  hasLooseCandidateRange,
  iterateLooseCandidateRanges,
} from "./ranges/loose.js";
import { hasStrictRange, iterateStrictRanges } from "./ranges/strict.js";
import { maskProfanityRanges } from "./token-ranges.js";
import { LOOSE_BASE } from "./terms/loose-base.js";
import { STRICT_BASE } from "./terms/strict-base.js";
import {
  PROFANITY_FILTER_NAME,
  type ProfanityFilter,
  type ProfanityMatchOptions,
  type ProfanityMatchRange,
  type ProfanityTermList,
  type ReadonlyProfanityFilter,
} from "./types.js";
import {
  appendRuntimeLiteralTerm,
  compileDictionaryState,
  createState,
  createStateFromCompiledDictionary,
  DEFAULT_NORMALIZATION_STRATEGY,
  rebuildLoose,
  rebuildStrict,
  runtimeLiteralTerms,
  snapshotFilterState,
  type CompiledDictionaryState,
  type FilterState,
  type FilterStateSnapshot,
} from "./filter-state.js";
import {
  createPreparedProfanityInput,
  normalizedTextForPreparedProfanityInput,
  type PreparedNormalizationView,
  type PreparedProfanityInput,
} from "./prepared-input.js";
import { collectedRangeMatchesTaxonomy } from "./match-options.js";

export {
  createPreparedProfanityInput,
  normalizedTextForPreparedProfanityInput,
};
export type { PreparedProfanityInput } from "./prepared-input.js";

export interface CompiledProfanityDictionary {
  readonly language: string;
  readonly normalization: ProfanityNormalizationStrategy;
  readonly strictRuleCount: number;
  readonly looseRuleCount: number;
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
  const looseCandidates = loosePatternCandidates(
    state.looseCandidateIndex,
    facts,
  );
  if (looseCandidates.length === 0) {
    return false;
  }

  return hasLooseCandidateRange(
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

  const looseCandidates = loosePatternCandidates(
    state.looseCandidateIndex,
    facts,
  );
  if (looseCandidates.length === 0) {
    return;
  }

  for (const range of iterateLooseCandidateRanges(
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

export const profanityFilter = createProfanityFilter;
export const filter: ReadonlyProfanityFilter = createReadOnlyFilter(
  createProfanityFilter(STRICT_BASE, LOOSE_BASE),
);
