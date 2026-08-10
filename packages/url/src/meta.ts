import {
  lowerNfkc,
  stripZeroWidth,
  type TextCodePointRange,
} from "@textfilters/core";

import {
  DOT_CHAR_SET,
  LETTER_OR_DIGIT_RE,
  LOOKALIKE_TO_ASCII,
  WHITESPACE_RE,
} from "./chars.js";

export interface TextMeta {
  readonly codePoints: readonly string[];
  readonly raw: readonly string[];
  readonly skeleton: readonly string[];
  readonly symbol: readonly string[];
  readonly zeroWidth: readonly boolean[];
  readonly whitespace: readonly boolean[];
  readonly alphaNum: readonly boolean[];
  readonly separator: readonly boolean[];
  readonly labelJoinSeparator: readonly boolean[];
}

export interface Match {
  readonly start: number;
  readonly end: number;
  readonly pos: number;
}

export interface Label extends Match {
  readonly raw: string;
  readonly skeleton: string;
}

export interface DomainMatch extends Match {
  readonly labels: readonly Label[];
}

export type CodePointRange = TextCodePointRange;

export const countCodePoints = (value: string): number => {
  let length = 0;
  for (const _codePoint of value) length++;
  return length;
};

export const toRawChar = (ch: string): string =>
  Array.from(lowerNfkc(ch))[0] ?? "";

export const toSkeletonFromNormalized = (value: string): string =>
  Array.from(value)
    .map((ch) => LOOKALIKE_TO_ASCII.get(ch) ?? ch)
    .join("");

export const toSkeleton = (value: unknown): string =>
  toSkeletonFromNormalized(lowerNfkc(value));

export const toRawChars = (value: string): string[] =>
  Array.from(lowerNfkc(value));

export const toSkeletonChars = (value: string): string[] =>
  toRawChars(value).map((ch) => LOOKALIKE_TO_ASCII.get(ch) ?? ch);

// TextMeta stores parallel per-code-point views so later parsers can reason in
// stable code-point offsets while still preserving UTF-16 lengths when masking.
export const createMeta = (source: string): TextMeta => {
  const codePoints = Array.from(source);
  const raw: string[] = new Array(codePoints.length);
  const skeleton: string[] = new Array(codePoints.length);
  const symbol: string[] = new Array(codePoints.length);
  const zeroWidth: boolean[] = new Array(codePoints.length);
  const whitespace: boolean[] = new Array(codePoints.length);
  const alphaNum: boolean[] = new Array(codePoints.length);
  const separator: boolean[] = new Array(codePoints.length);
  const labelJoinSeparator: boolean[] = new Array(codePoints.length);

  for (let i = 0; i < codePoints.length; i++) {
    const ch = codePoints[i];
    const rawChar = toRawChar(ch);
    const skeletonChar = LOOKALIKE_TO_ASCII.get(rawChar) ?? rawChar;
    const symbolChar = DOT_CHAR_SET.has(rawChar)
      ? "."
      : rawChar === "\\"
        ? "/"
        : rawChar;
    const isZeroWidth = ch !== "" && stripZeroWidth(ch) === "";
    const isWhitespace = WHITESPACE_RE.test(ch);
    const isAlphaNum = LETTER_OR_DIGIT_RE.test(rawChar);

    raw[i] = rawChar;
    skeleton[i] = skeletonChar;
    symbol[i] = symbolChar;
    zeroWidth[i] = isZeroWidth;
    whitespace[i] = isWhitespace;
    alphaNum[i] = isAlphaNum;
    separator[i] = isZeroWidth || !isAlphaNum;
    // Dots and path delimiters terminate labels; other separators may be
    // obfuscation joins inside a label.
    labelJoinSeparator[i] =
      isZeroWidth ||
      (!isAlphaNum &&
        symbolChar !== "." &&
        symbolChar !== "/" &&
        symbolChar !== ":" &&
        symbolChar !== "?" &&
        symbolChar !== "#");
  }

  return {
    codePoints,
    raw,
    skeleton,
    symbol,
    zeroWidth,
    whitespace,
    alphaNum,
    separator,
    labelJoinSeparator,
  };
};

export const skipSeparators = (meta: TextMeta, start: number): number => {
  let pos = start;
  while (pos < meta.codePoints.length && meta.separator[pos]) pos++;
  return pos;
};

export const consumeWord = (
  meta: TextMeta,
  start: number,
  expectedChars: readonly string[],
  mode: "raw" | "skeleton" = "skeleton",
): Match | null => {
  let pos = start;
  let first = -1;
  let last = -1;
  for (const expected of expectedChars) {
    pos = skipSeparators(meta, pos);
    if (pos >= meta.codePoints.length) return null;
    const actual = mode === "raw" ? meta.raw[pos] : meta.skeleton[pos];
    if (actual !== expected) return null;
    if (first < 0) first = pos;
    last = pos;
    pos++;
  }
  return first < 0 ? null : { start: first, end: last + 1, pos };
};

export const consumeSymbol = (
  meta: TextMeta,
  start: number,
  expected: string,
): Match | null => {
  let pos = start;
  while (
    pos < meta.codePoints.length &&
    (meta.zeroWidth[pos] || meta.whitespace[pos])
  ) {
    pos++;
  }
  if (pos >= meta.codePoints.length) return null;
  if (meta.symbol[pos] !== expected) return null;
  return { start: pos, end: pos + 1, pos: pos + 1 };
};

export const matchesRawChars = (
  meta: TextMeta,
  start: number,
  expectedChars: readonly string[],
): boolean => {
  if (start + expectedChars.length > meta.codePoints.length) return false;
  for (let i = 0; i < expectedChars.length; i++) {
    if (meta.raw[start + i] !== expectedChars[i]) return false;
  }
  return true;
};
