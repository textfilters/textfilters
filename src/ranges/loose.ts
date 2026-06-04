import type { TextRange } from "@textfilters/core";
import type { CompiledPattern } from "../matchers/compile.js";
import { nextCodePointEnd } from "../normalization/text.js";
import { expandToTokenBounds, WORD_CHAR_RE } from "../token-ranges.js";
import { boundaryCheckedRange } from "./boundary.js";
import { forEachPatternMatch } from "./patterns.js";

export const collectLooseRanges = (
  normalized: string,
  patterns: readonly CompiledPattern[],
  ranges: TextRange[],
): void =>
  forEachPatternMatch(normalized, patterns, (start, end) => {
    const range = looseRange(normalized, start, end);

    if (range !== null) {
      ranges.push(range);
    }
  });

const looseRange = (
  normalized: string,
  start: number,
  end: number,
): TextRange | null => {
  const checked = boundaryCheckedRange(normalized, start, end);
  if (checked === null) {
    return containsWordChar(normalized, start, end) ? null : [start, end];
  }

  const [trimmedStart, trimmedEnd] = checked;
  // Loose matches may include separators around a token, so the final mask range
  // expands after boundary validation instead of before it.
  const [expandedStart, expandedEnd] = expandToTokenBounds(
    normalized,
    trimmedStart,
    trimmedEnd,
  );

  return [Math.min(expandedStart, start), Math.max(expandedEnd, end)];
};

const containsWordChar = (
  normalized: string,
  start: number,
  end: number,
): boolean => {
  for (let position = start; position < end; ) {
    const charEnd = nextCodePointEnd(normalized, position);
    if (WORD_CHAR_RE.test(normalized.slice(position, charEnd))) {
      return true;
    }
    position = charEnd;
  }
  return false;
};
