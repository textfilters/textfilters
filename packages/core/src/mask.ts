import type { TextRange } from "./contracts.js";

export function maskTextRanges(
  text: string,
  ranges: readonly TextRange[],
  mask?: string,
): string {
  requireText(text);
  if (text.length === 0 || ranges.length === 0) return text;

  const merged = normalizeRanges(text, ranges);
  if (merged.length === 0) return text;

  const maskCodeUnit = normalizeMask(mask);
  let offset = 0;
  let result = "";

  for (const [start, end] of merged) {
    result += text.slice(offset, start);
    result += maskCodeUnit.repeat(end - start);
    offset = end;
  }

  return result + text.slice(offset);
}

function normalizeRanges(
  text: string,
  ranges: readonly TextRange[],
): Array<[number, number]> {
  const normalized = ranges.flatMap((range) => {
    const rawStart = range?.[0];
    const rawEnd = range?.[1];
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return [];

    let start = Math.max(0, Math.min(text.length, Math.trunc(rawStart)));
    let end = Math.max(0, Math.min(text.length, Math.trunc(rawEnd)));
    if (end <= start) return [];

    if (
      isLowSurrogate(text.charCodeAt(start)) &&
      isHighSurrogate(text.charCodeAt(start - 1))
    ) {
      start--;
    }
    if (
      isLowSurrogate(text.charCodeAt(end)) &&
      isHighSurrogate(text.charCodeAt(end - 1))
    ) {
      end++;
    }

    return [[start, end] as [number, number]];
  });

  normalized.sort((left, right) => left[0] - right[0] || left[1] - right[1]);

  const merged: Array<[number, number]> = [];
  for (const [start, end] of normalized) {
    const previous = merged[merged.length - 1];
    if (!previous || start > previous[1]) {
      merged.push([start, end]);
    } else {
      previous[1] = Math.max(previous[1], end);
    }
  }
  return merged;
}

function normalizeMask(mask: string | undefined): string {
  if (typeof mask !== "string" || mask.length !== 1) return "*";
  const codeUnit = mask.charCodeAt(0);
  return isHighSurrogate(codeUnit) || isLowSurrogate(codeUnit) ? "*" : mask;
}

function isHighSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}

function isLowSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
}

function requireText(text: string): void {
  if (typeof text !== "string") {
    throw new TypeError("text must be a string");
  }
}
