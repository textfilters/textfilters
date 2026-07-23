import {
  compileLooseInternalRulePatterns,
  compileStrictInternalRulePatterns,
  type InternalProfanityRule,
} from "./internal-rules.js";
import {
  compileLooseLiteralPatterns,
  compileStrictPhraseLiteralPatterns,
  compileStrictSymbolLiteralPatterns,
  compileStrictTokenLiteralPatterns,
  type LiteralTermDefinition,
  type LiteralNormalizer,
  strictSymbolLiteralLengths,
} from "./literals.js";
import { normalizeForMatchSameLen } from "../normalization/text.js";
import type { CompiledPattern } from "./compile.js";

export interface MatcherTerms {
  readonly internal: readonly InternalProfanityRule[];
  readonly literals: readonly LiteralTermDefinition[];
}

export interface StrictPatternSet {
  readonly token: CompiledPattern[];
  readonly tokenIndex: TokenPatternIndex;
  readonly symbolToken: CompiledPattern[];
  readonly symbolLengths: readonly number[];
  readonly phrase: CompiledPattern[];
}

export interface IndexedTokenPattern {
  readonly order: number;
  readonly pattern: CompiledPattern;
}

export interface TokenPatternIndex {
  readonly fallback: readonly IndexedTokenPattern[];
  readonly byFirstChar: ReadonlyMap<string, readonly IndexedTokenPattern[]>;
}

// Internal built-in rules and runtime literals stay separate until this final
// build step so addStrict/addLoose can append literals without downgrading the
// bundled rule corpus into literal strings.
export const buildStrictPatterns = (
  terms: MatcherTerms,
  normalize: LiteralNormalizer = normalizeForMatchSameLen,
): StrictPatternSet => {
  const token = [
    ...compileStrictInternalRulePatterns(terms.internal),
    ...compileStrictTokenLiteralPatterns(terms.literals, normalize),
  ];

  return {
    token,
    tokenIndex: buildTokenPatternIndex(token),
    symbolToken: compileStrictSymbolLiteralPatterns(terms.literals, normalize),
    symbolLengths: strictSymbolLiteralLengths(terms.literals, normalize),
    // Phrase patterns are only for runtime literals with punctuation, such as
    // `foo.bar` or `a?`; built-in strict rules stay token-oriented.
    phrase: compileStrictPhraseLiteralPatterns(terms.literals, normalize),
  };
};

export const buildTokenPatternIndex = (
  patterns: readonly CompiledPattern[],
): TokenPatternIndex => {
  const fallback: IndexedTokenPattern[] = [];
  const byFirstChar = new Map<string, IndexedTokenPattern[]>();

  // Pattern order is the strict precedence contract. Visiting the compiled
  // list once keeps every fallback and character bucket ordered by numeric id.
  patterns.forEach((pattern, order) => {
    const indexed = { order, pattern };
    if (pattern.scanFirstChars === undefined) {
      fallback.push(indexed);
      return;
    }

    for (const char of new Set(pattern.scanFirstChars)) {
      const bucket = byFirstChar.get(char);
      if (bucket === undefined) {
        byFirstChar.set(char, [indexed]);
      } else {
        bucket.push(indexed);
      }
    }
  });

  return { fallback, byFirstChar };
};

export const buildLoosePatterns = (
  terms: MatcherTerms,
  normalize: LiteralNormalizer = normalizeForMatchSameLen,
): CompiledPattern[] => [
  ...compileLooseInternalRulePatterns(terms.internal),
  ...compileLooseLiteralPatterns(terms.literals, normalize),
];
