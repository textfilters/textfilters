export type ProfanityTermList = readonly unknown[];

export const PROFANITY_FILTER_NAME = "profanity";

export interface ProfanityFilter {
  readonly name: typeof PROFANITY_FILTER_NAME;
  check(text: string): boolean;
  censor(text: string): string;
  setStrict(list: ProfanityTermList): void;
  setLoose(list: ProfanityTermList): void;
  addStrict(term: unknown): void;
  addLoose(term: unknown): void;
}
