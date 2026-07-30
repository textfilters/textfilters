import type { TextCodePointRange, TextRange } from "./contracts.js";
import {
  normalizeLengthPreservingMaskChar,
  normalizeMaskChar,
  normalizeTextInput,
} from "./input.js";
import { mergeCodePointRanges, mergeRanges } from "./ranges.js";

export function maskRange(value: string, range: TextRange, mask = "*"): string {
  return maskRanges(value, [range], mask);
}

/**
 * Masks code point ranges without splitting surrogate pairs.
 */
export function maskCodePointRanges(
  codePoints: readonly string[],
  ranges: readonly TextCodePointRange[],
  mask = "*",
): string {
  if (ranges.length === 0) return codePoints.join("");

  const maskChar = normalizeMaskChar(mask);
  const masked = new Array<boolean>(codePoints.length).fill(false);
  for (const [start, end] of mergeCodePointRanges(ranges)) {
    const left = Math.max(0, start);
    const right = Math.min(codePoints.length, end);
    for (let i = left; i < right; i++) masked[i] = true;
  }

  return codePoints
    .map((codePoint, index) => (masked[index] ? maskChar : codePoint))
    .join("");
}

/**
 * Masks code point ranges while preserving the source UTF-16 string length.
 */
export function maskCodePointRangesPreservingLength(
  codePoints: readonly string[],
  ranges: readonly TextCodePointRange[],
  mask = "*",
): string {
  if (ranges.length === 0) return codePoints.join("");

  const maskChar = normalizeLengthPreservingMaskChar(mask);
  const masked = new Array<boolean>(codePoints.length).fill(false);
  for (const [start, end] of mergeCodePointRanges(ranges)) {
    const left = Math.max(0, start);
    const right = Math.min(codePoints.length, end);
    for (let i = left; i < right; i++) masked[i] = true;
  }

  return codePoints
    .map((codePoint, index) =>
      masked[index] ? maskChar.repeat(codePoint.length) : codePoint,
    )
    .join("");
}

/**
 * Censors collected code point ranges while preserving source UTF-16 length.
 */
export function censorCodePointRanges(
  codePoints: readonly string[],
  ranges: readonly TextCodePointRange[],
  mask = "*",
): string {
  return ranges.length === 0
    ? codePoints.join("")
    : maskCodePointRangesPreservingLength(codePoints, ranges, mask);
}

export function maskRanges(
  value: string,
  ranges: readonly TextRange[],
  maskChar?: unknown,
): string {
  const source = normalizeTextInput(value);
  if (source.length === 0 || ranges.length === 0) return source;

  const merged = mergeRanges(ranges);
  if (merged.length === 0) return source;

  const mask = normalizeMaskChar(maskChar);
  let offset = 0;
  let rangeIndex = 0;
  let result = "";

  // Iterate by code point while tracking UTF-16 offsets, because TextRange
  // callers use string indexes but masking must not split astral characters.
  for (const codePoint of source) {
    const start = offset;
    const end = start + codePoint.length;
    offset = end;

    while (rangeIndex < merged.length && merged[rangeIndex][1] <= start) {
      rangeIndex++;
    }

    const range = merged[rangeIndex];
    result += range && range[0] < end && range[1] > start ? mask : codePoint;
  }

  return result;
}
