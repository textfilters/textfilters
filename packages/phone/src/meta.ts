import { stripZeroWidth } from "@textfilters/core";
import { ASCII_DIGIT_RE, toRawChar } from "./digits.js";

export interface TextMeta {
  readonly codePoints: readonly string[];
  readonly raw: readonly string[];
  readonly zeroWidth: readonly boolean[];
  readonly digit: readonly boolean[];
  readonly wordChar: readonly boolean[];
  readonly groupSeparator: readonly boolean[];
}

export const WHITESPACE_RE = /\s/u;
export const WORD_OR_DIGIT_RE = /[\p{L}\p{N}\p{M}_]/u;
export const DEFAULT_IGNORABLE_RE = /^\p{Default_Ignorable_Code_Point}$/u;
export const COMBINING_MARK_RE = /^\p{M}$/u;
export const SYMBOL_SEPARATORS = new Set([
  "-",
  "‐",
  "‑",
  "‒",
  "–",
  "—",
  "―",
  "−",
  ".",
  "/",
  ",",
  "(",
  ")",
]);

export const createMeta = (source: string): TextMeta => {
  const codePoints = Array.from(source);
  const raw: string[] = new Array(codePoints.length);
  const zeroWidth: boolean[] = new Array(codePoints.length);
  const digit: boolean[] = new Array(codePoints.length);
  const wordChar: boolean[] = new Array(codePoints.length);
  const groupSeparator: boolean[] = new Array(codePoints.length);

  for (let i = 0; i < codePoints.length; i++) {
    const ch = codePoints[i];
    const rawChar = toRawChar(ch);
    const isZeroWidth =
      ch !== "" && (stripZeroWidth(ch) === "" || DEFAULT_IGNORABLE_RE.test(ch));
    const isDigit = ASCII_DIGIT_RE.test(rawChar);
    const isWordChar = WORD_OR_DIGIT_RE.test(rawChar);

    raw[i] = rawChar;
    zeroWidth[i] = isZeroWidth;
    digit[i] = isDigit;
    wordChar[i] = isWordChar;
    groupSeparator[i] =
      WHITESPACE_RE.test(rawChar) || SYMBOL_SEPARATORS.has(rawChar);
  }

  return {
    codePoints,
    raw,
    zeroWidth,
    digit,
    wordChar,
    groupSeparator,
  };
};
