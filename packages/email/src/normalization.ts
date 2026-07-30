import { lowerNfkc } from "@textfilters/core";

const ZERO_WIDTH_RE = /^[\u200B-\u200D\u2060\uFEFF]$/u;

export interface EmailTextMeta {
  readonly codePoints: readonly string[];
  readonly normalized: readonly string[];
  readonly zeroWidth: readonly boolean[];
}

export function createEmailTextMeta(value: string): EmailTextMeta {
  const codePoints = Array.from(value);
  return {
    codePoints,
    normalized: codePoints.map((codePoint) => lowerNfkc(codePoint)),
    zeroWidth: codePoints.map((codePoint) => ZERO_WIDTH_RE.test(codePoint)),
  };
}

export const isWhitespace = (value: string): boolean => /^\s$/u.test(value);

export const isAsciiLetter = (value: string): boolean =>
  value.length === 1 && value >= "a" && value <= "z";

export const isAsciiDigit = (value: string): boolean =>
  value.length === 1 && value >= "0" && value <= "9";

export const isAsciiAlphaNumeric = (value: string): boolean =>
  isAsciiLetter(value) || isAsciiDigit(value);
