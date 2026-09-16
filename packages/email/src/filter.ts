import {
  maskTextRanges,
  type TextMatch,
  type TextRange,
} from "@textfilters/core";

import { createEmailScanner } from "./scanner.js";
import {
  type CodePointRange,
  type EmailFilter,
  type EmailFilterOptions,
} from "./types.js";

export function createEmailFilter(
  options: EmailFilterOptions = {},
): EmailFilter {
  const scanner = createEmailScanner(options);

  const filter: EmailFilter = {
    name: "email",

    check(text) {
      const source = requireText(text);
      return scanner.check(source);
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
    const ranges = scanner.scan(source);
    if (ranges.length === 0) return [];
    const offsets = utf16Offsets(source);
    return ranges.flatMap((range) => toUtf16Range(range, offsets));
  }

  function scanMatches(source: string): readonly TextMatch[] {
    return scanRanges(source).map(([start, end]) => ({
      start,
      end,
      value: source.slice(start, end),
      filter: "email",
    }));
  }

  return Object.freeze(filter);
}

export const filter = createEmailFilter();

function utf16Offsets(source: string): readonly number[] {
  const offsets = [0];
  for (const codePoint of source) {
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
