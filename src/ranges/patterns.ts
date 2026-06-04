import type { CompiledPattern } from "../matchers/compile.js";
import { nextCodePointEnd } from "../normalization/text.js";

export const forEachPatternMatch = (
  normalized: string,
  patterns: readonly CompiledPattern[],
  visit: (start: number, end: number) => void,
): void => {
  for (const pattern of patterns) {
    pattern.re.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.re.exec(normalized)) !== null) {
      const end = match.index + match[0].length;

      // Lookarounds in controlled internal rules can win with an empty match;
      // advance by code point so global regexp state never lands in a surrogate.
      if (match[0].length === 0) {
        pattern.re.lastIndex = nextCodePointEnd(normalized, match.index);
        continue;
      }

      visit(match.index, end);
    }
  }
};
