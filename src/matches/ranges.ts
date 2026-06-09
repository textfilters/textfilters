import type { TextRange } from "@textfilters/core";
import type {
  ProfanityCategory,
  ProfanitySeverity,
} from "../taxonomy/types.js";

export const PROFANITY_MATCH_MODE = {
  STRICT: "strict",
  LOOSE: "loose",
} as const;

export type ProfanityMatchMode =
  (typeof PROFANITY_MATCH_MODE)[keyof typeof PROFANITY_MATCH_MODE];

export interface ProfanityMatchRange extends TextRange {
  readonly mode: ProfanityMatchMode;
  readonly ruleId?: string;
  readonly category?: ProfanityCategory;
  readonly severity?: ProfanitySeverity;
}

export interface CollectedProfanityRange extends TextRange {
  readonly ruleId?: string;
  readonly category?: ProfanityCategory;
  readonly severity?: ProfanitySeverity;
}

export const matchRangesForMode = (
  ranges: readonly CollectedProfanityRange[],
  mode: ProfanityMatchMode,
): ProfanityMatchRange[] =>
  ranges.map((range) => {
    const matchRange = Object.assign([range[0], range[1]] as [number, number], {
      mode,
    });
    return Object.assign(matchRange, rangeMetadata(range));
  });

export const textRangesForMode = (
  ranges: readonly ProfanityMatchRange[],
  mode: ProfanityMatchMode,
): TextRange[] =>
  ranges
    .filter((range) => range.mode === mode)
    .map(([start, end]) => [start, end]);

const rangeMetadata = (
  range: CollectedProfanityRange,
): Partial<
  Pick<CollectedProfanityRange, "ruleId" | "category" | "severity">
> => ({
  ...(range.ruleId === undefined ? {} : { ruleId: range.ruleId }),
  ...(range.category === undefined ? {} : { category: range.category }),
  ...(range.severity === undefined ? {} : { severity: range.severity }),
});
