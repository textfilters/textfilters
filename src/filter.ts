import type { TextRange } from "@textfilters/core";
import { buildLoosePatterns, buildStrictPatterns } from "./matchers/build.js";
import type { MatcherTerms, StrictPatternSet } from "./matchers/build.js";
import type { CompiledPattern } from "./matchers/compile.js";
import { appendTerm, normalizeTermList } from "./matchers/terms.js";
import { normalizeForMatchSameLen } from "./normalization/text.js";
import { collectLooseRanges } from "./ranges/loose.js";
import { collectStrictRanges } from "./ranges/strict.js";
import { maskProfanityRanges } from "./token-ranges.js";
import { LOOSE_BASE } from "./terms/loose-base.js";
import { STRICT_BASE } from "./terms/strict-base.js";
import { PROFANITY_FILTER_NAME } from "./types.js";
import type { ProfanityFilter, ProfanityTermList } from "./types.js";

interface FilterState {
  // Built-in rules and runtime literals are stored separately so appending a
  // tenant literal never changes how the bundled regex-like corpus is compiled.
  strictTerms: MatcherTerms;
  looseTerms: MatcherTerms;
  strictPatterns: StrictPatternSet;
  loosePatterns: CompiledPattern[];
}

export const createProfanityFilter = (
  strictTerms: ProfanityTermList = STRICT_BASE,
  looseTerms: ProfanityTermList = LOOSE_BASE,
): ProfanityFilter => {
  const state = createState(strictTerms, looseTerms);

  return {
    name: PROFANITY_FILTER_NAME,
    check: (text) => hasProfanity(state, String(text)),
    censor: (text) => censorText(state, String(text)),
    setStrict: (list) => {
      state.strictTerms = customTerms(list);
      rebuildStrict(state);
    },
    addStrict: (term) => {
      state.strictTerms = appendLiteralTerm(state.strictTerms, term);
      rebuildStrict(state);
    },
    setLoose: (list) => {
      state.looseTerms = customTerms(list);
      rebuildLoose(state);
    },
    addLoose: (term) => {
      state.looseTerms = appendLiteralTerm(state.looseTerms, term);
      rebuildLoose(state);
    },
  };
};

function createState(
  strictTerms: ProfanityTermList,
  looseTerms: ProfanityTermList,
): FilterState {
  const state: FilterState = {
    strictTerms:
      strictTerms === STRICT_BASE
        ? internalTerms(strictTerms)
        : customTerms(strictTerms),
    looseTerms:
      looseTerms === LOOSE_BASE
        ? internalTerms(looseTerms)
        : customTerms(looseTerms),
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

function rebuildStrict(state: FilterState): void {
  state.strictPatterns = buildStrictPatterns(state.strictTerms);
}

function rebuildLoose(state: FilterState): void {
  state.loosePatterns = buildLoosePatterns(state.looseTerms);
}

const internalTerms = (terms: ProfanityTermList): MatcherTerms => ({
  internal: normalizeTermList(terms),
  literals: [],
});

const customTerms = (terms: ProfanityTermList): MatcherTerms => ({
  internal: [],
  literals: normalizeTermList(terms),
});

const appendLiteralTerm = (
  terms: MatcherTerms,
  term: unknown,
): MatcherTerms => ({
  // Keep the existing internal rules intact and append only to the literal side.
  internal: terms.internal,
  literals: appendTerm(terms.literals, term),
});

const hasProfanity = (state: FilterState, text: string): boolean => {
  const [strictRanges, looseRanges] = collectRanges(state, text);
  return strictRanges.length > 0 || looseRanges.length > 0;
};

const censorText = (state: FilterState, text: string): string => {
  const [strictRanges, looseRanges] = collectRanges(state, text);
  return maskProfanityRanges(text, strictRanges, looseRanges);
};

const collectRanges = (
  state: FilterState,
  text: string,
): [TextRange[], TextRange[]] => {
  // Normalization is same-length, so ranges collected from the normalized string
  // can be applied directly to the original source string.
  const normalized = normalizeForMatchSameLen(text);
  const strictRanges: TextRange[] = [];
  const looseRanges: TextRange[] = [];

  collectStrictRanges(normalized, state.strictPatterns, strictRanges);
  collectLooseRanges(
    normalized,
    state.loosePatterns,
    state.strictPatterns,
    looseRanges,
  );

  return [strictRanges, looseRanges];
};

export const profanityFilter = createProfanityFilter;
export const filter = createProfanityFilter(STRICT_BASE, LOOSE_BASE);
