import {
  compileLooseInternalRulePatterns,
  compileStrictInternalRulePatterns,
} from "./internal-rules.js";
import type { InternalProfanityRule } from "./internal-rules.js";
import {
  compileLooseLiteralPatterns,
  compileStrictPhraseLiteralPatterns,
  compileStrictLiteralPatterns,
  compileStrictSymbolLiteralPatterns,
  strictSymbolLiteralLengths,
} from "./literals.js";
import type { CompiledPattern } from "./compile.js";

export interface MatcherTerms {
  readonly internal: readonly InternalProfanityRule[];
  readonly literals: readonly string[];
}

export interface StrictPatternSet {
  readonly token: CompiledPattern[];
  readonly symbolToken: CompiledPattern[];
  readonly symbolLengths: readonly number[];
  readonly phrase: CompiledPattern[];
}

// Internal built-in rules and runtime literals stay separate until this final
// build step so addStrict/addLoose can append literals without downgrading the
// bundled rule corpus into literal strings.
export const buildStrictPatterns = (terms: MatcherTerms): StrictPatternSet => ({
  token: [
    ...compileStrictInternalRulePatterns(terms.internal),
    ...compileStrictLiteralPatterns(terms.literals, true),
  ],
  symbolToken: compileStrictSymbolLiteralPatterns(terms.literals),
  symbolLengths: strictSymbolLiteralLengths(terms.literals),
  // Phrase patterns are only for runtime literals with punctuation, such as
  // `foo.bar` or `a?`; built-in strict rules stay token-oriented.
  phrase: compileStrictPhraseLiteralPatterns(terms.literals),
});

export const buildLoosePatterns = (terms: MatcherTerms): CompiledPattern[] => [
  ...compileLooseInternalRulePatterns(terms.internal),
  ...compileLooseLiteralPatterns(terms.literals),
];
