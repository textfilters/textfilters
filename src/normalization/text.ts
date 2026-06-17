import { LATIN_TO_CYR } from "../constants/latin-to-cyr.js";

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
  Array.from(value, (char) => {
    const code = char.codePointAt(0);
    if (
      code !== undefined &&
      code >= FULLWIDTH_ASCII_START &&
      code <= FULLWIDTH_ASCII_END
    ) {
      return String.fromCodePoint(code - FULLWIDTH_ASCII_OFFSET);
    }
    return char;
  }).join("");

// Every transform must preserve UTF-16 length so match ranges stay source-based.
// Zero-width markers must stay outside WORD_RE so strict token bounds do not
// grow past the visible word.
export const normalizeForMatchSameLen = (value: string): string =>
  foldHomoglyphs(normalizeFullwidthAsciiSameLen(value))
    .replace(/[ёЁ]/g, (char) => (char === "Ё" ? "Е" : "е"))
    .replace(ZERO_WIDTH_RE, ZERO_WIDTH_SPLIT_MARKER);

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
