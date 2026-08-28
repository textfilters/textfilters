import {
  maskTextRanges,
  type TextMatch,
  type TextRange,
} from "@textfilters/core";

import { type CodePointRange, type PhoneFilter } from "./contracts.js";
import { toRawChar } from "./digits.js";
import { createMeta } from "./meta.js";
import { collectCandidateRangeMatches } from "./scanner.js";

const filterImplementation: PhoneFilter = {
  name: "phone",

  check(text) {
    const source = requireText(text);
    if (!hasPhoneCandidate(source)) return false;

    let found = false;
    collectCandidateRangeMatches(createMeta(source), () => {
      found = true;
      return false;
    });
    return found;
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

export const filter = Object.freeze(filterImplementation);

function scanMatches(source: string): readonly TextMatch[] {
  return scanRanges(source).map(([start, end]) => ({
    start,
    end,
    value: source.slice(start, end),
    filter: "phone",
  }));
}

function scanRanges(source: string): readonly TextRange[] {
  if (!hasPhoneCandidate(source)) return [];

  const codePoints = Array.from(source);
  const offsets = utf16Offsets(codePoints);
  const ranges: CodePointRange[] = [];
  let pending: CodePointRange | undefined;

  collectCandidateRangeMatches(createMeta(source), (range) => {
    if (!pending) {
      pending = range;
    } else if (range[0] <= pending[1]) {
      pending = [pending[0], Math.max(pending[1], range[1])];
    } else {
      ranges.push(pending);
      pending = range;
    }
  });
  if (pending) ranges.push(pending);

  return ranges.flatMap((range) => toUtf16Range(range, offsets));
}

function hasPhoneCandidate(source: string): boolean {
  let digitCount = 0;
  for (const codePoint of source) {
    const raw = toRawChar(codePoint);
    if (raw >= "0" && raw <= "9" && ++digitCount >= 10) return true;
  }
  return false;
}

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
