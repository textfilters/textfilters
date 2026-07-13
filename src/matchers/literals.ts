import { esc, normalizeForMatchSameLen } from "../normalization/text.js";
import { compilePatternDefinitions, type CompiledPattern } from "./compile.js";
import type { ProfanityTaxonomyMetadata } from "../types.js";

export interface LiteralTermDefinition extends ProfanityTaxonomyMetadata {
  readonly source: string;
}

export type LiteralNormalizer = (value: string) => string;

export const LOOSE_SEPARATOR = String.raw`[^\p{L}\p{N}]*`;

const LITERAL_ESCAPE_RE = /\\([\\^$.*+?()[\]{}|/])/g;

export const compileStrictLiteralPatterns = (
  terms: readonly LiteralTermDefinition[],
  wholeToken: boolean,
  normalize: LiteralNormalizer = normalizeForMatchSameLen,
): CompiledPattern[] =>
  compilePatternDefinitions(
    terms.map((term) => ({
      source: literalSource(term.source, normalize),
      ...literalMetadata(term),
    })),
    wholeToken,
  );

export const compileStrictTokenLiteralPatterns = (
  terms: readonly LiteralTermDefinition[],
  normalize: LiteralNormalizer = normalizeForMatchSameLen,
): CompiledPattern[] =>
  compileStrictLiteralPatterns(
    terms.filter((term) => needsTokenPass(term, normalize)),
    true,
    normalize,
  );

export const compileStrictPhraseLiteralPatterns = (
  terms: readonly LiteralTermDefinition[],
  normalize: LiteralNormalizer = normalizeForMatchSameLen,
): CompiledPattern[] =>
  compilePatternDefinitions(
    terms
      .filter((term) => needsPhrasePass(term, normalize))
      .map((term) => ({
        source: literalSource(term.source, normalize),
        ...literalMetadata(term),
      })),
    false,
  );

export const compileStrictSymbolLiteralPatterns = (
  terms: readonly LiteralTermDefinition[],
  normalize: LiteralNormalizer = normalizeForMatchSameLen,
): CompiledPattern[] =>
  compilePatternDefinitions(
    terms
      .filter((term) => isSymbolOnlyLiteral(term, normalize))
      .map((term) => ({
        source: literalSource(term.source, normalize),
        ...literalMetadata(term),
      })),
    true,
  );

export const strictSymbolLiteralLengths = (
  terms: readonly LiteralTermDefinition[],
  normalize: LiteralNormalizer = normalizeForMatchSameLen,
): readonly number[] =>
  Array.from(
    new Set(
      terms
        .map((term) => normalizeLiteralTerm(term.source, normalize))
        .filter(isSymbolRunLiteral)
        .map((term) => term.length),
    ),
  ).sort((left, right) => right - left);

export const compileLooseLiteralPatterns = (
  terms: readonly LiteralTermDefinition[],
  normalize: LiteralNormalizer = normalizeForMatchSameLen,
): CompiledPattern[] =>
  compilePatternDefinitions(
    terms.map((term) => ({
      source: looseLiteralSource(term.source, normalize),
      ...literalMetadata(term),
    })),
    false,
  );

const literalSource = (term: string, normalize: LiteralNormalizer): string =>
  esc(normalizeLiteralTerm(term, normalize));

// Loose literals are still literals: separators are inserted between normalized
// code points, not by interpreting user input as regexp syntax.
const looseLiteralSource = (
  term: string,
  normalize: LiteralNormalizer,
): string =>
  Array.from(normalizeLiteralTerm(term, normalize), esc).join(LOOSE_SEPARATOR);

export const normalizeLiteralTerm = (
  term: string,
  normalize: LiteralNormalizer = normalizeForMatchSameLen,
): string => normalize(term.replace(LITERAL_ESCAPE_RE, "$1"));

const needsPhrasePass = (
  term: LiteralTermDefinition,
  normalize: LiteralNormalizer,
): boolean => {
  const normalized = normalizeLiteralTerm(term.source, normalize);
  return (
    NON_WORD_CHAR_RE.test(normalized) &&
    (WORD_CHAR_RE.test(normalized) || WHITESPACE_RE.test(normalized))
  );
};

const needsTokenPass = (
  term: LiteralTermDefinition,
  normalize: LiteralNormalizer,
): boolean =>
  !needsPhrasePass(term, normalize) && !isSymbolOnlyLiteral(term, normalize);

const isSymbolOnlyLiteral = (
  term: LiteralTermDefinition,
  normalize: LiteralNormalizer,
): boolean => isSymbolRunLiteral(normalizeLiteralTerm(term.source, normalize));

const literalMetadata = (
  term: LiteralTermDefinition,
): Partial<Pick<LiteralTermDefinition, "category" | "severity">> => ({
  ...(term.category === undefined ? {} : { category: term.category }),
  ...(term.severity === undefined ? {} : { severity: term.severity }),
});

const isSymbolRunLiteral = (term: string): boolean =>
  term.length > 0 && !WORD_CHAR_RE.test(term) && !WHITESPACE_RE.test(term);

const WORD_CHAR_RE = /[\p{L}\p{N}\p{M}_-]/u;
const NON_WORD_CHAR_RE = /[^\p{L}\p{N}\p{M}_-]/u;
const WHITESPACE_RE = /\s/u;
