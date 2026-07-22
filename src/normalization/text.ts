import { LATIN_TO_CYR } from "../constants/latin-to-cyr.js";

export type NormalizedCodePointVisitor = (
  normalizedChar: string,
  sourcePosition: number,
) => void;

export type MatchInputPreparer = (
  value: string,
  visit: NormalizedCodePointVisitor,
) => string;

const FULLWIDTH_ASCII_START = 0xff01;
const FULLWIDTH_ASCII_END = 0xff5e;
const FULLWIDTH_ASCII_OFFSET = 0xfee0;

export const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u2060]/g;
const ZERO_WIDTH_SPLIT_MARKER = "\uFFFF";

const REGEX_META_RE = /[\\^$.*+?()[\]{}|]/g;

export const esc = (value: string): string =>
  value.replace(REGEX_META_RE, "\\$&");

export const foldHomoglyphs = (value: string): string =>
  value.replace(/[A-Za-z]/g, (ch) => LATIN_TO_CYR[ch] ?? ch);

export const normalizeFullwidthAsciiSameLen = (value: string): string =>
  Array.from(value, foldFullwidthAsciiChar).join("");

// Every transform must preserve UTF-16 length so match ranges stay source-based.
// Zero-width markers must stay outside WORD_RE so strict token bounds do not
// grow past the visible word.
export const normalizeForMatchSameLenWithoutHomoglyphs = (
  value: string,
): string =>
  normalizeFullwidthAsciiSameLen(value)
    .replace(/[ёЁ]/g, (char) => (char === "Ё" ? "Е" : "е"))
    .replace(ZERO_WIDTH_RE, ZERO_WIDTH_SPLIT_MARKER);

export const normalizeForMatchSameLen = (value: string): string =>
  foldHomoglyphs(normalizeForMatchSameLenWithoutHomoglyphs(value));

export const prepareForMatchSameLenWithoutHomoglyphs: MatchInputPreparer = (
  value: string,
  visit: NormalizedCodePointVisitor,
): string => normalizeMatchText(value, false, visit);

export const prepareForMatchSameLen: MatchInputPreparer = (
  value: string,
  visit: NormalizedCodePointVisitor,
): string => normalizeMatchText(value, true, visit);

const normalizeMatchText = (
  value: string,
  shouldFoldHomoglyphs: boolean,
  visit: NormalizedCodePointVisitor,
): string => {
  const normalizedParts: string[] = [];
  let unchangedStart = 0;

  for (let position = 0; position < value.length; ) {
    const end = nextCodePointEnd(value, position);
    const sourceChar = value.slice(position, end);
    const char = normalizeMatchChar(sourceChar, shouldFoldHomoglyphs);

    if (char !== sourceChar) {
      if (unchangedStart < position) {
        normalizedParts.push(value.slice(unchangedStart, position));
      }
      normalizedParts.push(char);
      unchangedStart = end;
    }

    visit(char, position);
    position = end;
  }

  if (unchangedStart === 0) return value;
  if (unchangedStart < value.length) {
    normalizedParts.push(value.slice(unchangedStart));
  }
  return normalizedParts.join("");
};

const normalizeMatchChar = (
  sourceChar: string,
  shouldFoldHomoglyphs: boolean,
): string => {
  let char = foldFullwidthAsciiChar(sourceChar);

  if (char === "ё") {
    char = "е";
  } else if (char === "Ё") {
    char = "Е";
  } else if (isZeroWidthChar(char)) {
    char = ZERO_WIDTH_SPLIT_MARKER;
  }

  return shouldFoldHomoglyphs && isAsciiLetter(char)
    ? (LATIN_TO_CYR[char] ?? char)
    : char;
};

const foldFullwidthAsciiChar = (char: string): string => {
  const code = char.codePointAt(0);
  return code !== undefined &&
    code >= FULLWIDTH_ASCII_START &&
    code <= FULLWIDTH_ASCII_END
    ? String.fromCodePoint(code - FULLWIDTH_ASCII_OFFSET)
    : char;
};

const isZeroWidthChar = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x200b && code <= 0x200d) || code === 0xfeff || code === 0x2060
  );
};

const isAsciiLetter = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
};

export const codePointStartAt = (value: string, index: number): number => {
  if (
    index > 0 &&
    index < value.length &&
    value.charCodeAt(index) >= 0xdc00 &&
    value.charCodeAt(index) <= 0xdfff &&
    value.charCodeAt(index - 1) >= 0xd800 &&
    value.charCodeAt(index - 1) <= 0xdbff
  ) {
    return index - 1;
  }

  return index;
};

export const nextCodePointEnd = (value: string, index: number): number => {
  const code = value.codePointAt(index);
  return index + (code !== undefined && code > 0xffff ? 2 : 1);
};

export const previousCodePointStart = (value: string, index: number): number =>
  codePointStartAt(value, Math.max(0, index - 1));
