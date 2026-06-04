import { esc, normalizeForMatchSameLen } from "../normalization/text.js";
import { compilePatternSources } from "./compile.js";
import type { CompiledPattern } from "./compile.js";

export const LOOSE_SEPARATOR = String.raw`[^\p{L}\p{N}]*`;

const LITERAL_ESCAPE_RE = /\\([\\^$.*+?()[\]{}|/])/g;

export const compileStrictLiteralPatterns = (
  terms: readonly string[],
  wholeToken: boolean,
): CompiledPattern[] =>
  compilePatternSources(
    terms.map((term) => literalSource(term)),
    wholeToken,
  );

export const compileStrictPhraseLiteralPatterns = (
  terms: readonly string[],
): CompiledPattern[] =>
  compilePatternSources(
    // The phrase pass is needed when a literal mixes token characters with
    // punctuation, or when a symbol-only literal contains whitespace and cannot
    // be found in one consecutive symbol run.
    terms.filter(needsPhrasePass).map((term) => literalSource(term)),
    false,
  );

export const compileStrictSymbolLiteralPatterns = (
  terms: readonly string[],
): CompiledPattern[] =>
  compilePatternSources(
    terms.filter(isSymbolOnlyLiteral).map((term) => literalSource(term)),
    true,
  );

export const strictSymbolLiteralLengths = (
  terms: readonly string[],
): readonly number[] =>
  Array.from(
    new Set(
      terms
        .map(normalizeLiteralTerm)
        .filter(isSymbolRunLiteral)
        .map((term) => term.length),
    ),
  ).sort((left, right) => right - left);

export const compileLooseLiteralPatterns = (
  terms: readonly string[],
): CompiledPattern[] =>
  compilePatternSources(
    terms.map((term) => looseLiteralSource(term)),
    false,
  );

const literalSource = (term: string): string => esc(normalizeLiteralTerm(term));

// Loose literals are still literals: separators are inserted between normalized
// code points, not by interpreting user input as regexp syntax.
const looseLiteralSource = (term: string): string =>
  Array.from(normalizeLiteralTerm(term), esc).join(LOOSE_SEPARATOR);

export const normalizeLiteralTerm = (term: string): string =>
  normalizeForMatchSameLen(term.replace(LITERAL_ESCAPE_RE, "$1"));

const needsPhrasePass = (term: string): boolean => {
  const normalized = normalizeLiteralTerm(term);
  return (
    NON_WORD_CHAR_RE.test(normalized) &&
    (WORD_CHAR_RE.test(normalized) || WHITESPACE_RE.test(normalized))
  );
};

const isSymbolOnlyLiteral = (term: string): boolean =>
  isSymbolRunLiteral(normalizeLiteralTerm(term));

const isSymbolRunLiteral = (term: string): boolean =>
  term.length > 0 && !WORD_CHAR_RE.test(term) && !WHITESPACE_RE.test(term);

const WORD_CHAR_RE = /[\p{L}\p{N}\p{M}_-]/u;
const NON_WORD_CHAR_RE = /[^\p{L}\p{N}\p{M}_-]/u;
const WHITESPACE_RE = /\s/u;
