import { type TextMeta, WHITESPACE_RE } from "./meta.js";

const INLINE_EXTENSION_MARKERS = ["x", "ext"];

export const isBoundary = (
  meta: TextMeta,
  start: number,
  end: number,
): boolean => {
  return hasLeftBoundary(meta, start) && hasRightBoundary(meta, end);
};

export const hasLeftBoundary = (meta: TextMeta, start: number): boolean => {
  let before = start - 1;
  while (before >= 0 && meta.zeroWidth[before]) before--;
  if (before >= 0 && meta.wordChar[before]) return false;
  return true;
};

export const hasRightBoundary = (meta: TextMeta, end: number): boolean => {
  let after = end;
  while (after < meta.codePoints.length && meta.zeroWidth[after]) after++;
  if (after < meta.codePoints.length && meta.wordChar[after]) return false;
  return true;
};

export const hasInlineExtensionMarker = (
  meta: TextMeta,
  start: number,
): boolean => {
  // Inline "x123" and "ext123" extensions delimit the phone but are not masked.
  let marker = start;
  while (marker < meta.codePoints.length && meta.zeroWidth[marker]) marker++;

  for (const extensionMarker of INLINE_EXTENSION_MARKERS) {
    let pos = marker;
    let matched = true;
    for (const ch of extensionMarker) {
      while (pos < meta.codePoints.length && meta.zeroWidth[pos]) pos++;
      if (pos >= meta.codePoints.length || meta.raw[pos] !== ch) {
        matched = false;
        break;
      }
      pos++;
    }
    if (!matched) continue;

    while (pos < meta.codePoints.length && meta.zeroWidth[pos]) pos++;
    if (pos < meta.codePoints.length && meta.raw[pos] === ".") {
      pos++;
      while (pos < meta.codePoints.length && meta.zeroWidth[pos]) pos++;
    }
    if (pos < meta.codePoints.length && meta.digit[pos]) return true;
  }
  return false;
};

export const previousVisible = (meta: TextMeta, pos: number): number => {
  let cursor = pos;
  while (cursor >= 0 && meta.zeroWidth[cursor]) cursor--;
  return cursor;
};

export const previousContent = (meta: TextMeta, pos: number): number => {
  let cursor = pos;
  while (
    cursor >= 0 &&
    (meta.zeroWidth[cursor] || WHITESPACE_RE.test(meta.raw[cursor]))
  ) {
    cursor--;
  }
  return cursor;
};

export const skipZeroWidthForward = (meta: TextMeta, start: number): number => {
  let pos = start;
  while (pos < meta.codePoints.length && meta.zeroWidth[pos]) pos++;
  return pos;
};

export const isWhitespaceSeparator = (separator: string): boolean =>
  Array.from(separator).some((ch) => WHITESPACE_RE.test(ch));
