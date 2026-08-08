import {
  lowerNfkc,
  stripZeroWidth,
  type TextCodePointRange,
} from "@textfilters/core";

import {
  DOT_CHAR_SET,
  HOST_LABEL_CHAR_RE,
  LETTER_OR_DIGIT_RE,
  LOOKALIKE_TO_ASCII,
  UNICODE_MARK_RE,
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
  readonly labelChar: readonly boolean[];
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

export interface LabelText {
  readonly raw: string;
  readonly skeleton: string;
}

export interface DomainMatch extends Match {
  readonly labels: readonly Label[];
}

export type CodePointRange = TextCodePointRange;

export const toRawChar = (ch: string): string => lowerNfkc(ch);

export const toSkeleton = (value: unknown): string =>
  Array.from(lowerNfkc(value))
    .map((ch) => LOOKALIKE_TO_ASCII[ch] ?? ch)
    .join("");

export const toRawChars = (value: string): string[] =>
  Array.from(lowerNfkc(value));

export const toSkeletonChars = (value: string): string[] =>
  toRawChars(value).map((ch) => LOOKALIKE_TO_ASCII[ch] ?? ch);

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
  const labelChar: boolean[] = new Array(codePoints.length);
  const separator: boolean[] = new Array(codePoints.length);
  const labelJoinSeparator: boolean[] = new Array(codePoints.length);

  for (let i = 0; i < codePoints.length; i++) {
    const ch = codePoints[i];
    const rawChar = toRawChar(ch);
    const rawChars = Array.from(rawChar);
    const skeletonChar = toSkeleton(rawChar);
    const isDotSymbol =
      rawChars.length > 0 &&
      rawChars.every((normalizedChar) => DOT_CHAR_SET.has(normalizedChar));
    const symbolChar = isDotSymbol ? "." : rawChar === "\\" ? "/" : rawChar;
    const isZeroWidth = ch !== "" && stripZeroWidth(ch) === "";
    const isWhitespace = WHITESPACE_RE.test(ch);
    const isAlphaNum =
      rawChars.length > 0 &&
      rawChars.every((normalizedChar) =>
        LETTER_OR_DIGIT_RE.test(normalizedChar),
      );
    const isLabelChar =
      HOST_LABEL_CHAR_RE.test(ch) ||
      (rawChars.length > 0 &&
        rawChars.every((normalizedChar) =>
          HOST_LABEL_CHAR_RE.test(normalizedChar),
        ));

    raw[i] = rawChar;
    skeleton[i] = skeletonChar;
    symbol[i] = symbolChar;
    zeroWidth[i] = isZeroWidth;
    whitespace[i] = isWhitespace;
    alphaNum[i] = isAlphaNum;
    labelChar[i] = isLabelChar;
    separator[i] = isZeroWidth || !isAlphaNum;
    // Dots and path delimiters terminate labels; other separators may be
    // obfuscation joins inside a label.
    labelJoinSeparator[i] =
      isZeroWidth ||
      (!isLabelChar &&
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
    labelChar,
    separator,
    labelJoinSeparator,
  };
};

export const skipSeparators = (meta: TextMeta, start: number): number => {
  let pos = start;
  while (pos < meta.codePoints.length && meta.separator[pos]) pos++;
  return pos;
};

export const isTokenDelimiterPadding = (meta: TextMeta, pos: number): boolean =>
  meta.zeroWidth[pos] ||
  meta.whitespace[pos] ||
  UNICODE_MARK_RE.test(meta.codePoints[pos] ?? "");

export const skipTokenSuffixMarks = (
  meta: TextMeta,
  start: number,
): { readonly pos: number; readonly hasWhitespace: boolean } => {
  let pos = start;
  let sawMark = false;
  let hasWhitespace = false;
  let lastMarkEnd = start;
  while (pos < meta.codePoints.length && isTokenDelimiterPadding(meta, pos)) {
    const isMark = UNICODE_MARK_RE.test(meta.codePoints[pos] ?? "");
    sawMark ||= isMark;
    hasWhitespace ||= meta.whitespace[pos];
    if (isMark) lastMarkEnd = pos + 1;
    pos++;
  }
  return sawMark
    ? { pos: lastMarkEnd, hasWhitespace }
    : { pos: start, hasWhitespace: false };
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
  let expectedPos = 0;
  while (expectedPos < expectedChars.length) {
    pos = skipSeparators(meta, pos);
    if (pos >= meta.codePoints.length) return null;
    const actual = mode === "raw" ? meta.raw[pos] : meta.skeleton[pos];
    const actualChars = Array.from(actual);
    if (actualChars.length === 0) return null;
    for (const actualChar of actualChars) {
      if (actualChar !== expectedChars[expectedPos]) return null;
      expectedPos++;
    }
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
  while (pos < meta.codePoints.length && isTokenDelimiterPadding(meta, pos)) {
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
