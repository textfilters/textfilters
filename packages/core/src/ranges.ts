import type { TextCodePointRange, TextRange } from "./contracts.js";

/**
 * Drops invalid numeric ranges before callers merge or mask spans.
 */
function normalizeRange<T extends TextRange | TextCodePointRange>(
  range: T,
): T | null {
  const start = Math.trunc(Number(range[0]));
  const end = Math.trunc(Number(range[1]));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end <= start) return null;
  return [start, end] as unknown as T;
}

export function mergeRanges(ranges: readonly TextRange[]): TextRange[] {
  const sorted = ranges
    .map(normalizeRange)
    .filter((range): range is TextRange => range !== null)
    .sort((left, right) => left[0] - right[0]);

  const merged: Array<[number, number]> = [];

  for (const [start, end] of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || start > previous[1]) {
      merged.push([start, end]);
      continue;
    }
    previous[1] = Math.max(previous[1], end);
  }

  return merged;
}

/**
 * Merges ranges that are already expressed in code point indexes.
 */
export function mergeCodePointRanges(
  ranges: readonly TextCodePointRange[],
): readonly TextCodePointRange[] {
  if (ranges.length === 0) return [];

  const sorted = ranges
    .map(normalizeRange)
    .filter((range): range is TextCodePointRange => range !== null)
    .sort((left, right) => left[0] - right[0]);
  if (sorted.length === 0) return [];
  const merged: Array<[number, number]> = [[sorted[0][0], sorted[0][1]]];

  for (let i = 1; i < sorted.length; i++) {
    const [start, end] = sorted[i];
    const previous = merged[merged.length - 1];
    if (start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}
