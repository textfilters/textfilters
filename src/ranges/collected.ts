import type { TextRange } from "@textfilters/core";
import type { CompiledPattern } from "../matchers/compile.js";
import type { CollectedProfanityRange } from "../matches/ranges.js";

export const collectedRangeForPattern = (
  range: TextRange,
  pattern: CompiledPattern,
): CollectedProfanityRange =>
  pattern.ruleId === undefined
    ? range
    : Object.assign([range[0], range[1]] as [number, number], {
        ruleId: pattern.ruleId,
      });
