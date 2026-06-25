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
