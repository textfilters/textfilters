import { esc, normalizeForMatchSameLen } from "../normalization/text.js";
import { compilePatternDefinitions } from "./compile.js";
import type { CompiledPattern } from "./compile.js";
import type { ProfanityTaxonomyMetadata } from "../types.js";

export interface LiteralTermDefinition extends ProfanityTaxonomyMetadata {
  readonly source: string;
}

export const LOOSE_SEPARATOR = String.raw`[^\p{L}\p{N}]*`;

const LITERAL_ESCAPE_RE = /\\([\\^$.*+?()[\]{}|/])/g;

export const compileStrictLiteralPatterns = (
  terms: readonly LiteralTermDefinition[],
  wholeToken: boolean,
): CompiledPattern[] =>
  compilePatternDefinitions(
    terms.map((term) => ({
      source: literalSource(term.source),
      ...literalMetadata(term),
    })),
    wholeToken,
  );

export const compileStrictPhraseLiteralPatterns = (
  terms: readonly LiteralTermDefinition[],
): CompiledPattern[] =>
  compilePatternDefinitions(
    terms.filter(needsPhrasePass).map((term) => ({
      source: literalSource(term.source),
      ...literalMetadata(term),
    })),
    false,
  );

export const compileStrictSymbolLiteralPatterns = (
  terms: readonly LiteralTermDefinition[],
): CompiledPattern[] =>
  compilePatternDefinitions(
    terms.filter(isSymbolOnlyLiteral).map((term) => ({
      source: literalSource(term.source),
      ...literalMetadata(term),
    })),
    true,
  );

export const strictSymbolLiteralLengths = (
  terms: readonly LiteralTermDefinition[],
): readonly number[] =>
  Array.from(
    new Set(
      terms
        .map((term) => normalizeLiteralTerm(term.source))
        .filter(isSymbolRunLiteral)
        .map((term) => term.length),
    ),
  ).sort((left, right) => right - left);

export const compileLooseLiteralPatterns = (
  terms: readonly LiteralTermDefinition[],
): CompiledPattern[] =>
  compilePatternDefinitions(
    terms.map((term) => ({
      source: looseLiteralSource(term.source),
      ...literalMetadata(term),
    })),
    false,
  );

const literalSource = (term: string): string => esc(normalizeLiteralTerm(term));

// Loose literals are still literals: separators are inserted between normalized
// code points, not by interpreting user input as regexp syntax.
const looseLiteralSource = (term: string): string =>
  Array.from(normalizeLiteralTerm(term), esc).join(LOOSE_SEPARATOR);

export const normalizeLiteralTerm = (term: string): string =>
  normalizeForMatchSameLen(term.replace(LITERAL_ESCAPE_RE, "$1"));

const needsPhrasePass = (term: LiteralTermDefinition): boolean => {
  const normalized = normalizeLiteralTerm(term.source);
  return (
    NON_WORD_CHAR_RE.test(normalized) &&
    (WORD_CHAR_RE.test(normalized) || WHITESPACE_RE.test(normalized))
  );
};

const isSymbolOnlyLiteral = (term: LiteralTermDefinition): boolean =>
  isSymbolRunLiteral(normalizeLiteralTerm(term.source));

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
