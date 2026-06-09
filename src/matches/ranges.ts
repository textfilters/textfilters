import type { TextRange } from "@textfilters/core";

export const PROFANITY_MATCH_MODE = {
  STRICT: "strict",
  LOOSE: "loose",
} as const;

export type ProfanityMatchMode =
  (typeof PROFANITY_MATCH_MODE)[keyof typeof PROFANITY_MATCH_MODE];

export interface ProfanityMatchRange extends TextRange {
  readonly mode: ProfanityMatchMode;
}

export const matchRangesForMode = (
  ranges: readonly TextRange[],
  mode: ProfanityMatchMode,
): ProfanityMatchRange[] =>
  ranges.map(([start, end]) =>
    Object.assign([start, end] as [number, number], { mode }),
  );

export const textRangesForMode = (
  ranges: readonly ProfanityMatchRange[],
  mode: ProfanityMatchMode,
): TextRange[] =>
  ranges
    .filter((range) => range.mode === mode)
    .map(([start, end]) => [start, end]);
