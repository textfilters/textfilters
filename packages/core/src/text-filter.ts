import type {
  AllocationAwareRangeScanner,
  TextCodePointRange,
  TextFilter,
  TextMatch,
  TextRange,
  TextRangeScanner,
} from "./contracts.js";
import { maskUtf16Ranges } from "./masking.js";
import {
  createPreparedText,
  runTextRangeScanner,
  scanPreparedTextRanges,
} from "./scanner.js";

interface ScannedRange {
  readonly range: TextRange;
  readonly data?: unknown;
}

export function createTextFilterFromScanner<const Name extends string>(
  name: Name,
  scanner: TextRangeScanner,
  defaultMask = "*",
): TextFilter & { readonly name: Name } {
  validateFilterName(name);

  const filter: TextFilter & { readonly name: Name } = {
    name,

    check(text) {
      return hasValidRange(requireText(text), scanner);
    },

    find(text) {
      const source = requireText(text);
      return toTextMatches(source, name, scanRanges(source, scanner));
    },

    censor(text, mask) {
      const source = requireText(text);
      const ranges = scanRanges(source, scanner, false).map(
        (match) => match.range,
      );
      return maskUtf16Ranges(source, ranges, mask ?? defaultMask);
    },

    process(text, mask) {
      const source = requireText(text);
      const matches = toTextMatches(source, name, scanRanges(source, scanner));
      return {
        censored: maskUtf16Ranges(
          source,
          matches.map(({ start, end }) => [start, end]),
          mask ?? defaultMask,
        ),
        matches,
      };
    },
  };

  return Object.freeze(filter);
}

export function combineFilters(...filters: readonly TextFilter[]): TextFilter {
  const children = Object.freeze([...filters]);

  const combined: TextFilter = {
    name: "combined",

    check(text) {
      const source = requireText(text);
      return children.some((filter) => filter.check(source));
    },

    find(text) {
      const source = requireText(text);
      return children
        .flatMap((filter) => [...filter.find(source)])
        .sort(compareTextMatches);
    },

    censor(text, mask) {
      const source = requireText(text);
      const matches = combined.find(source);
      return maskUtf16Ranges(
        source,
        matches.map(({ start, end }) => [start, end]),
        mask,
      );
    },

    process(text, mask) {
      const source = requireText(text);
      const matches = combined.find(source);
      return {
        censored: maskUtf16Ranges(
          source,
          matches.map(({ start, end }) => [start, end]),
          mask,
        ),
        matches,
      };
    },
  };

  return Object.freeze(combined);
}

function hasValidRange(source: string, scanner: TextRangeScanner): boolean {
  const input = createPreparedText(source);
  const offsets = utf16Offsets(input.codePoints);

  if (isAllocationAwareScanner(scanner)) {
    let found = false;
    scanPreparedTextRanges(scanner, input, (match) => {
      if (codePointRangeToUtf16(match.range, offsets) === undefined) return;
      found = true;
      return false;
    });
    return found;
  }

  return runTextRangeScanner(scanner, input).ranges.some(
    (range) => codePointRangeToUtf16(range, offsets) !== undefined,
  );
}

function scanRanges(
  source: string,
  scanner: TextRangeScanner,
  includeData = true,
): readonly ScannedRange[] {
  const input = createPreparedText(source);
  const offsets = utf16Offsets(input.codePoints);

  if (isAllocationAwareScanner(scanner)) {
    const ranges: ScannedRange[] = [];
    scanPreparedTextRanges(scanner, input, (match) => {
      const range = codePointRangeToUtf16(match.range, offsets);
      if (range === undefined) return;
      ranges.push(
        includeData && match.metadata !== undefined
          ? { range, data: { ...match.metadata } }
          : { range },
      );
    });
    return ranges;
  }

  return runTextRangeScanner(scanner, input).ranges.flatMap((range) => {
    const utf16Range = codePointRangeToUtf16(range, offsets);
    return utf16Range === undefined ? [] : [{ range: utf16Range }];
  });
}

function toTextMatches(
  source: string,
  filter: string,
  ranges: readonly ScannedRange[],
): readonly TextMatch[] {
  return ranges.map(({ range: [start, end], data }) => ({
    start,
    end,
    value: source.slice(start, end),
    filter,
    ...(data === undefined ? {} : { data }),
  }));
}

function utf16Offsets(codePoints: readonly string[]): readonly number[] {
  const offsets = [0];
  for (const codePoint of codePoints) {
    offsets.push(offsets[offsets.length - 1] + codePoint.length);
  }
  return offsets;
}

function codePointRangeToUtf16(
  range: TextCodePointRange,
  offsets: readonly number[],
): TextRange | undefined {
  const start = Math.trunc(Number(range[0]));
  const end = Math.trunc(Number(range[1]));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  if (start < 0 || end <= start || end >= offsets.length) return undefined;
  return [offsets[start], offsets[end]];
}

function isAllocationAwareScanner(
  scanner: TextRangeScanner,
): scanner is AllocationAwareRangeScanner {
  return (
    typeof scanner === "object" &&
    scanner !== null &&
    "allocationAware" in scanner &&
    scanner.allocationAware === true
  );
}

function validateFilterName(name: string): void {
  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError("filter name must not be empty");
  }
  if (name.trim() !== name) {
    throw new TypeError(
      "filter name must not have leading or trailing whitespace",
    );
  }
}

function requireText(text: string): string {
  if (typeof text !== "string") {
    throw new TypeError("text must be a string");
  }
  return text;
}

function compareTextMatches(left: TextMatch, right: TextMatch): number {
  return (
    left.start - right.start ||
    left.end - right.end ||
    left.filter.localeCompare(right.filter)
  );
}
