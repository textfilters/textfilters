import type { TextCodePointRange } from "@textfilters/core";

export type ProfanityTermList = readonly unknown[];

export type ProfanityCategory =
  | "OBSCENE_MAT"
  | "STRONG_INSULT"
  | "VULGAR"
  | "EUPHEMISM";

export type ProfanitySeverity = "high" | "medium" | "low" | "soft";

export interface ProfanityTaxonomyMetadata {
  readonly category?: ProfanityCategory;
  readonly severity?: ProfanitySeverity;
}

export interface ProfanityMatchOptions {
  readonly categories?: readonly ProfanityCategory[];
  readonly severities?: readonly ProfanitySeverity[];
  readonly minSeverity?: ProfanitySeverity;
}

export type ProfanityMatchMode = "strict" | "loose";

export interface ProfanityMatchRange extends Readonly<
  [start: number, end: number]
> {
  readonly mode: ProfanityMatchMode;
  readonly ruleId?: string;
  readonly category?: ProfanityCategory;
  readonly severity?: ProfanitySeverity;
}

export const PROFANITY_FILTER_NAME = "profanity";

export interface ReadonlyProfanityFilter {
  readonly name: typeof PROFANITY_FILTER_NAME;
  analyze(
    text: unknown,
    options?: ProfanityMatchOptions,
  ): ProfanityMatchRange[];
  check(text: unknown, options?: ProfanityMatchOptions): boolean;
  censor(text: unknown, options?: ProfanityMatchOptions): string;
}

export interface ProfanityFilter extends ReadonlyProfanityFilter {
  setStrict(list: ProfanityTermList): void;
  setLoose(list: ProfanityTermList): void;
  addStrict(term: unknown): void;
  addLoose(term: unknown): void;
}

export interface ProfanityScanInput {
  readonly text: string;
  readonly codePoints: readonly string[];
  readonly hints?: ProfanityScanHints;
}

export interface ProfanityScanHints {
  readonly textLength?: number;
  readonly codePointLength?: number;
  readonly isEmpty?: boolean;
  readonly hasAsciiOnly?: boolean;
  readonly hasNonAscii?: boolean;
  readonly hasDigit?: boolean;
  readonly digitCount?: number;
  readonly hasAsciiLetter?: boolean;
  readonly hasWhitespace?: boolean;
  readonly hasPunctuation?: boolean;
  readonly punctuationCount?: number;
  readonly hasAtSign?: boolean;
  readonly hasDot?: boolean;
  readonly hasSlash?: boolean;
  readonly hasColon?: boolean;
  readonly hasPlus?: boolean;
}

export interface ProfanityScannerOptions {
  readonly filter?: ReadonlyProfanityFilter;
  readonly matchOptions?: ProfanityMatchOptions;
}

export interface ProfanityScannerMetadata extends Readonly<
  Record<string, unknown>
> {
  readonly matches: readonly ProfanityMatchRange[];
}

export interface ProfanityScannerOutput {
  readonly ranges: readonly TextCodePointRange[];
  readonly metadata: ProfanityScannerMetadata;
}

export interface ProfanityRangeMatch {
  readonly range: TextCodePointRange;
  readonly match: ProfanityMatchRange;
}

export type ProfanityRangeMatchSink = (
  match: ProfanityRangeMatch,
) => boolean | void;

export interface ProfanityScanner {
  readonly name: typeof PROFANITY_FILTER_NAME;
  readonly allocationAware?: true;
  check(input: ProfanityScanInput): boolean;
  scan(input: ProfanityScanInput): ProfanityScannerOutput;
  scan(input: ProfanityScanInput, sink: ProfanityRangeMatchSink): boolean;
}
