import {
  maskTextRanges,
  type TextMatch,
  type TextRange,
} from "@textfilters/core";

import {
  type CodePointRange,
  type UrlFilter,
  type UrlFilterOptions,
} from "./contracts.js";
import { createUrlScanner } from "./scanner.js";

export function createUrlFilter(options: UrlFilterOptions = {}): UrlFilter {
  const scanner = createUrlScanner(options);

  const filter: UrlFilter = {
    name: "url",

    check(text) {
      const source = requireText(text);
      return scanner.check({ text: source, codePoints: Array.from(source) });
    },

    find(text) {
      return scanMatches(requireText(text));
    },

    censor(text, mask) {
      const source = requireText(text);
      return maskTextRanges(source, scanRanges(source), mask);
    },

    process(text, mask) {
      const source = requireText(text);
      const matches = scanMatches(source);
      return {
        censored: maskTextRanges(source, toRanges(matches), mask),
        matches,
      };
    },
  };

  function scanRanges(source: string): readonly TextRange[] {
    const codePoints = Array.from(source);
    const offsets = utf16Offsets(codePoints);
    return scanner
      .scan({ text: source, codePoints })
      .ranges.flatMap((range) => toUtf16Range(range, offsets));
  }

  function scanMatches(source: string): readonly TextMatch[] {
    return scanRanges(source).map(([start, end]) => ({
      start,
      end,
      value: source.slice(start, end),
      filter: "url",
    }));
  }

  return Object.freeze(filter);
}

export const filter = createUrlFilter();

function utf16Offsets(codePoints: readonly string[]): readonly number[] {
  const offsets = [0];
  for (const codePoint of codePoints) {
    offsets.push(offsets[offsets.length - 1] + codePoint.length);
  }
  return offsets;
}

function toUtf16Range(
  [start, end]: CodePointRange,
  offsets: readonly number[],
): readonly TextRange[] {
  if (start < 0 || end <= start || end >= offsets.length) return [];
  return [[offsets[start], offsets[end]]];
}

function toRanges(matches: readonly TextMatch[]): readonly TextRange[] {
  return matches.map(({ start, end }) => [start, end]);
}

function requireText(text: string): string {
  if (typeof text !== "string") {
    throw new TypeError("text must be a string");
  }
  return text;
}
