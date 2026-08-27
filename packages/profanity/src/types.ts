import type {
  TextFilter,
  TextFilterResult,
  TextMatch,
} from "@textfilters/core";

export const PROFANITY_FILTER_NAME = "profanity";

export interface ProfanityDictionary {
  readonly id: string;
  readonly deny: readonly string[];
  readonly allow: readonly string[];
  readonly aliases?: readonly (readonly [from: string, to: string])[];
}

export interface ProfanityMatchData {
  readonly dictionary: string;
  readonly term: string;
}

export interface ProfanityMatch extends TextMatch {
  readonly filter: typeof PROFANITY_FILTER_NAME;
  readonly data: ProfanityMatchData;
}

export interface ProfanityFilterResult extends TextFilterResult {
  readonly matches: readonly ProfanityMatch[];
}

export interface ProfanityFilter extends TextFilter {
  readonly name: typeof PROFANITY_FILTER_NAME;
  find(text: string): readonly ProfanityMatch[];
  process(text: string, mask?: string): ProfanityFilterResult;
}
