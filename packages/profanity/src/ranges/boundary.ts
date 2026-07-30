import type { TextRange } from "@textfilters/core";
import {
  coversToken,
  SPLIT_TOKEN_CHAR_RE,
  tokenBoundsAt,
  trimMatchToWordChars,
} from "../token-ranges.js";

export const boundaryCheckedRange = (
  normalized: string,
  rawStart: number,
  rawEnd: number,
): TextRange | null => {
  // Regex matches can include punctuation around a word; trim first, then decide
  // whether the remaining word span is allowed to be masked.
  const trimmed = trimMatchToWordChars(normalized, rawStart, rawEnd);
  if (trimmed === null) {
    return null;
  }

  const [start, end] = trimmed;
  const [leftStart, leftEnd] = tokenBoundsAt(normalized, start);
  const [rightStart, rightEnd] = tokenBoundsAt(normalized, end - 1);

  if (sameToken(leftStart, leftEnd, rightStart, rightEnd)) {
    return acceptsSingleTokenMatch(normalized, start, end, leftStart, leftEnd)
      ? [start, end]
      : null;
  }

  if (!crossesTwoTokens(leftStart, leftEnd, rightStart, rightEnd)) {
    return [start, end];
  }

  // Two-token matches are allowed only when both edge tokens are fully covered;
  // this preserves phrase matches without accepting arbitrary token fragments.
  return coversToken(start, Math.min(end, leftEnd), leftStart, leftEnd) &&
    coversToken(Math.max(start, rightStart), end, rightStart, rightEnd)
    ? [start, end]
    : null;
};

const sameToken = (
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): boolean => leftStart === rightStart && leftEnd === rightEnd;

const crossesTwoTokens = (
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): boolean => leftEnd > leftStart && rightEnd > rightStart;

const acceptsSingleTokenMatch = (
  normalized: string,
  start: number,
  end: number,
  tokenStart: number,
  tokenEnd: number,
): boolean =>
  coversToken(start, end, tokenStart, tokenEnd) ||
  isSplitTokenPrefix(normalized, start, end, tokenStart, tokenEnd);

const isSplitTokenPrefix = (
  normalized: string,
  start: number,
  end: number,
  tokenStart: number,
  tokenEnd: number,
): boolean => {
  if (start !== tokenStart) {
    return false;
  }

  // A split spelling such as `b-a-d` may leave only splitters after the match,
  // and an unsplit profanity may be followed by only splitters. Prefixes such as
  // `b-adminton` must stay neutral because the suffix is a real word part.
  const remainder = normalized.slice(end, tokenEnd);
  if (remainder.length > 0) {
    return Array.from(remainder).every((char) =>
      SPLIT_TOKEN_CHAR_RE.test(char),
    );
  }

  const matched = normalized.slice(start, end);
  return SPLIT_TOKEN_CHAR_RE.test(matched);
};
