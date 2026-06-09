import type { TextRange } from "@textfilters/core";

export const PROFANITY_MATCH_MODE = {
  STRICT: "strict",
  LOOSE: "loose",
} as const;

export type ProfanityMatchMode =
  (typeof PROFANITY_MATCH_MODE)[keyof typeof PROFANITY_MATCH_MODE];

export interface ProfanityMatchRange extends TextRange {
  readonly mode: ProfanityMatchMode;
  readonly ruleId?: string;
}

export interface CollectedProfanityRange extends TextRange {
  readonly ruleId?: string;
}

export const matchRangesForMode = (
  ranges: readonly CollectedProfanityRange[],
  mode: ProfanityMatchMode,
): ProfanityMatchRange[] =>
  ranges.map((range) => {
    const matchRange = Object.assign([range[0], range[1]] as [number, number], {
      mode,
    });
    return range.ruleId === undefined
      ? matchRange
      : Object.assign(matchRange, { ruleId: range.ruleId });
  });

export const textRangesForMode = (
  ranges: readonly ProfanityMatchRange[],
  mode: ProfanityMatchMode,
): TextRange[] =>
  ranges
    .filter((range) => range.mode === mode)
    .map(([start, end]) => [start, end]);
