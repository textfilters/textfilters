import type { TextRange } from "@textfilters/core";
import { buildLoosePatterns, buildStrictPatterns } from "./matchers/build.js";
import type { MatcherTerms, StrictPatternSet } from "./matchers/build.js";
import type { CompiledPattern } from "./matchers/compile.js";
import { createBuiltInProfanityRules } from "./matchers/internal-rules.js";
import { appendTerm, normalizeTermList } from "./matchers/terms.js";
import {
  matchRangesForMode,
  PROFANITY_MATCH_MODE,
  textRangesForMode,
} from "./matches/ranges.js";
import type { ProfanityMatchRange } from "./matches/ranges.js";
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
      state.strictTerms = runtimeLiteralTerms(list);
      rebuildStrict(state);
    },
    addStrict: (term) => {
      state.strictTerms = appendRuntimeLiteralTerm(state.strictTerms, term);
      rebuildStrict(state);
    },
    setLoose: (list) => {
      state.looseTerms = runtimeLiteralTerms(list);
      rebuildLoose(state);
    },
    addLoose: (term) => {
      state.looseTerms = appendRuntimeLiteralTerm(state.looseTerms, term);
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

function rebuildStrict(state: FilterState): void {
  state.strictPatterns = buildStrictPatterns(state.strictTerms);
}

function rebuildLoose(state: FilterState): void {
  state.loosePatterns = buildLoosePatterns(state.looseTerms);
}

const builtInRuleTerms = (
  terms: ProfanityTermList,
  corpus: "strict" | "loose",
): MatcherTerms => ({
  internal: createBuiltInProfanityRules(normalizeTermList(terms), corpus),
  literals: [],
});

const runtimeLiteralTerms = (terms: ProfanityTermList): MatcherTerms => ({
  internal: [],
  literals: normalizeTermList(terms),
});

const appendRuntimeLiteralTerm = (
  terms: MatcherTerms,
  term: unknown,
): MatcherTerms => ({
  // Keep the existing internal rules intact and append only to the literal side.
  internal: terms.internal,
  literals: appendTerm(terms.literals, term),
});

const hasProfanity = (state: FilterState, text: string): boolean => {
  const matches = collectProfanityMatches(state, text);
  return matches.length > 0;
};

const censorText = (state: FilterState, text: string): string => {
  const matches = collectProfanityMatches(state, text);
  return maskProfanityRanges(
    text,
    textRangesForMode(matches, PROFANITY_MATCH_MODE.STRICT),
    textRangesForMode(matches, PROFANITY_MATCH_MODE.LOOSE),
  );
};

const collectProfanityMatches = (
  state: FilterState,
  text: string,
): ProfanityMatchRange[] => {
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

  return [
    ...matchRangesForMode(strictRanges, PROFANITY_MATCH_MODE.STRICT),
    ...matchRangesForMode(looseRanges, PROFANITY_MATCH_MODE.LOOSE),
  ];
};

export const profanityFilter = createProfanityFilter;
export const filter = createProfanityFilter(STRICT_BASE, LOOSE_BASE);
