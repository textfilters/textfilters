import type { TextRange } from "@textfilters/core";
import {
  coversToken,
  isLeadingTokenPadding,
  isTrailingTokenPadding,
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
  hasOnlyTokenPadding(normalized, start, end, tokenStart, tokenEnd);

const hasOnlyTokenPadding = (
  normalized: string,
  start: number,
  end: number,
  tokenStart: number,
  tokenEnd: number,
): boolean => {
  const leading = normalized.slice(tokenStart, start);
  const trailing = normalized.slice(end, tokenEnd);
  if (leading.length === 0 && trailing.length === 0) {
    return false;
  }

  // Connector padding may surround a complete match at a token boundary.
  // Numeric and combining-mark content must stay behind a connector at the
  // matched edge, and real word content still rejects embedded fragments such
  // as `b-adminton`.
  return (
    (leading.length === 0 || isLeadingTokenPadding(leading)) &&
    (trailing.length === 0 || isTrailingTokenPadding(trailing))
  );
};
