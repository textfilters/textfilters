import { mergeRanges, type TextRange } from "@textfilters/core";
import {
  codePointStartAt,
  nextCodePointEnd,
  previousCodePointStart,
} from "./normalization/text.js";

// Token and range helpers work on source-string UTF-16 offsets because callers
// use those offsets to mask without changing the original string length.
export const WORD_RE = /[\p{L}\p{N}_-][\p{L}\p{N}\p{M}_-]*/gu;
export const WORD_CHAR_RE = /[\p{L}\p{N}\p{M}_-]/u;
export const WHITESPACE_RE = /\s/u;
export const SPLIT_TOKEN_CHAR_RE = /[_-]/u;

export const isWordCharAt = (s: string, i: number): boolean =>
  i >= 0 &&
  i < s.length &&
  WORD_CHAR_RE.test(s.slice(i, nextCodePointEnd(s, i)));

export const containsWordChar = (
  s: string,
  start: number,
  end: number,
): boolean => {
  for (let position = start; position < end; ) {
    const charEnd = nextCodePointEnd(s, position);
    if (WORD_CHAR_RE.test(s.slice(position, charEnd))) {
      return true;
    }
    position = charEnd;
  }
  return false;
};

export const wordStartAtOrAfter = (
  s: string,
  start: number,
  end = s.length,
): number => {
  let position = start;
  while (position < end && !isWordCharAt(s, position)) {
    position = nextCodePointEnd(s, position);
  }
  return position;
};

export const wordRunEnd = (
  s: string,
  start: number,
  end = s.length,
): number => {
  let position = start;
  while (position < end && isWordCharAt(s, position)) {
    position = nextCodePointEnd(s, position);
  }
  return position;
};

export const expandToTokenBounds = (
  s: string,
  a: number,
  b: number,
): [number, number] => {
  let L = a;
  let R = b;
  while (L > 0) {
    const prev = previousCodePointStart(s, L);
    if (!isWordCharAt(s, prev)) break;
    L = prev;
  }
  while (R < s.length && isWordCharAt(s, R)) R = nextCodePointEnd(s, R);
  return [L, R];
};

export const tokenBoundsAt = (s: string, i: number): [number, number] => {
  const start = codePointStartAt(s, i);
  if (!isWordCharAt(s, start)) return [i, i];
  let L = start;
  let R = nextCodePointEnd(s, start);
  while (L > 0) {
    const prev = previousCodePointStart(s, L);
    if (!isWordCharAt(s, prev)) break;
    L = prev;
  }
  while (R < s.length && isWordCharAt(s, R)) R = nextCodePointEnd(s, R);
  return [L, R];
};

export const trimMatchToWordChars = (
  s: string,
  a: number,
  b: number,
): [number, number] | null => {
  let start = a;
  let end = b;
  while (start < end && !isWordCharAt(s, start)) {
    start = nextCodePointEnd(s, start);
  }
  while (end > start) {
    const prev = previousCodePointStart(s, end);
    if (isWordCharAt(s, prev)) break;
    end = prev;
  }
  return start < end ? [start, end] : null;
};

export const coversToken = (
  start: number,
  end: number,
  tokenStart: number,
  tokenEnd: number,
): boolean => start === tokenStart && end === tokenEnd;

export const rangeOverlaps = (
  range: TextRange | undefined,
  start: number,
  end: number,
): boolean => range !== undefined && range[0] < end && range[1] > start;

export const maskProfanityRanges = (
  source: string,
  strictRanges: readonly TextRange[],
  looseRanges: readonly TextRange[],
): string => {
  const strict = mergeRanges(strictRanges);
  const loose = mergeRanges(looseRanges);
  if (strict.length === 0 && loose.length === 0) return source;

  let strictIndex = 0;
  let looseIndex = 0;
  let offset = 0;

  return Array.from(source)
    .map((codePoint) => {
      const start = offset;
      const end = start + codePoint.length;
      offset = end;

      while (strictIndex < strict.length && strict[strictIndex][1] <= start) {
        strictIndex++;
      }
      while (looseIndex < loose.length && loose[looseIndex][1] <= start) {
        looseIndex++;
      }

      if (rangeOverlaps(strict[strictIndex], start, end)) {
        return "*".repeat(codePoint.length);
      }
      return rangeOverlaps(loose[looseIndex], start, end)
        ? "*".repeat(codePoint.length)
        : codePoint;
    })
    .join("");
};
