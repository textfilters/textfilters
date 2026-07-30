import type { TextRange } from "@textfilters/core";
import type {
  ProfanityCategory,
  ProfanityMatchMode,
  ProfanityMatchRange,
  ProfanitySeverity,
} from "../types.js";

export const PROFANITY_MATCH_MODE = {
  STRICT: "strict",
  LOOSE: "loose",
} as const;

export interface CollectedProfanityRange extends TextRange {
  readonly ruleId?: string;
  readonly category?: ProfanityCategory;
  readonly severity?: ProfanitySeverity;
  readonly originalSourceExemptions?: readonly string[];
}

export const matchRangeForMode = (
  range: CollectedProfanityRange,
  mode: ProfanityMatchMode,
): ProfanityMatchRange => {
  const matchRange = Object.assign([range[0], range[1]] as [number, number], {
    mode,
  });
  return Object.assign(matchRange, rangeMetadata(range));
};

export const matchRangesForMode = (
  ranges: readonly CollectedProfanityRange[],
  mode: ProfanityMatchMode,
): ProfanityMatchRange[] =>
  ranges.map((range) => matchRangeForMode(range, mode));

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
