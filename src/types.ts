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

export interface ProfanityFilter {
  readonly name: typeof PROFANITY_FILTER_NAME;
  analyze(text: string): ProfanityMatchRange[];
  check(text: string): boolean;
  censor(text: string): string;
  setStrict(list: ProfanityTermList): void;
  setLoose(list: ProfanityTermList): void;
  addStrict(term: unknown): void;
  addLoose(term: unknown): void;
}
