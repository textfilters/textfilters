import {
  buildLoosePatterns,
  buildStrictPatterns,
  buildTokenPatternIndex,
  type MatcherTerms,
  type StrictPatternSet,
} from "./matchers/build.js";
import type { CompiledPattern } from "./matchers/compile.js";
import {
  buildLooseCandidateIndex,
  type LooseCandidateIndex,
} from "./matchers/loose-candidates.js";
import {
  createBuiltInProfanityRules,
  type InternalProfanityRuleDefinition,
} from "./matchers/internal-rules.js";
import {
  compileLooseLiteralPatterns,
  compileStrictLiteralPatterns,
  compileStrictPhraseLiteralPatterns,
  compileStrictSymbolLiteralPatterns,
  normalizeLiteralTerm,
  strictSymbolLiteralLengths,
  type LiteralNormalizer,
  type LiteralTermDefinition,
} from "./matchers/literals.js";
import { normalizeTermList } from "./matchers/terms.js";
import {
  dictionaryRulesForMode,
  type ProfanityLanguageDictionary,
  type ProfanityNormalizationStrategy,
} from "./languages/profanity.js";
import {
  normalizeForMatchSameLen,
  normalizeForMatchSameLenWithoutHomoglyphs,
  prepareForMatchSameLen,
  prepareForMatchSameLenWithoutHomoglyphs,
  type MatchInputPreparer,
} from "./normalization/text.js";
import { LOOSE_BASE } from "./terms/loose-base.js";
import { STRICT_BASE } from "./terms/strict-base.js";
import { type ProfanityTermList } from "./types.js";

export interface FilterState {
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

export type FilterStateSnapshot = Pick<
  FilterState,
  | "strictPatterns"
  | "loosePatterns"
  | "looseCandidateIndex"
  | "normalization"
  | "normalizeForMatch"
  | "prepareForMatch"
>;

export interface CompiledDictionaryState {
  readonly strictTerms: MatcherTerms;
  readonly looseTerms: MatcherTerms;
  readonly strictPatterns: StrictPatternSet;
  readonly loosePatterns: readonly CompiledPattern[];
  readonly normalization: ProfanityNormalizationStrategy;
  readonly normalizeForMatch: LiteralNormalizer;
  readonly prepareForMatch: MatchInputPreparer;
}

export function createState(
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

export function compileDictionaryState(
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

export const DEFAULT_NORMALIZATION_STRATEGY: ProfanityNormalizationStrategy =
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

export function createStateFromCompiledDictionary(
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

export function rebuildStrict(state: FilterState): void {
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

export function rebuildLoose(state: FilterState): void {
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

export const runtimeLiteralTerms = (
  terms: ProfanityTermList,
  normalize: LiteralNormalizer,
): MatcherTerms => ({
  internal: [],
  literals: literalDefinitions(terms, normalize),
});

export const appendRuntimeLiteralTerm = (
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

export const snapshotFilterState = (
  state: FilterState,
): FilterStateSnapshot => ({
  strictPatterns: state.strictPatterns,
  loosePatterns: state.loosePatterns,
  looseCandidateIndex: state.looseCandidateIndex,
  normalization: state.normalization,
  normalizeForMatch: state.normalizeForMatch,
  prepareForMatch: state.prepareForMatch,
});
