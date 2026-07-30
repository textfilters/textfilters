import type { TextRange } from "@textfilters/core";
import type { CompiledPattern } from "../matchers/compile.js";
import type { CollectedProfanityRange } from "../matches/ranges.js";

export const collectedRangeForPattern = (
  range: TextRange,
  pattern: CompiledPattern,
): CollectedProfanityRange => {
  const metadata = {
    ...(pattern.ruleId === undefined ? {} : { ruleId: pattern.ruleId }),
    ...(pattern.category === undefined ? {} : { category: pattern.category }),
    ...(pattern.severity === undefined ? {} : { severity: pattern.severity }),
    ...(pattern.originalSourceExemptions === undefined
      ? {}
      : { originalSourceExemptions: pattern.originalSourceExemptions }),
  };

  return Object.keys(metadata).length === 0
    ? range
    : Object.assign([range[0], range[1]] as [number, number], metadata);
};
