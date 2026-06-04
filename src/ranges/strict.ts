import type { TextRange } from "@textfilters/core";
import type { StrictPatternSet } from "../matchers/build.js";
import type { CompiledPattern } from "../matchers/compile.js";
import { patternMatches } from "../matchers/compile.js";
import { nextCodePointEnd } from "../normalization/text.js";
import { WHITESPACE_RE, WORD_CHAR_RE, WORD_RE } from "../token-ranges.js";
import { boundaryCheckedRange } from "./boundary.js";
import { forEachPatternMatch } from "./patterns.js";

export const collectStrictRanges = (
  normalized: string,
  patterns: StrictPatternSet,
  ranges: TextRange[],
): void => {
  collectWordRanges(normalized, patterns, ranges);
  collectSymbolRanges(normalized, patterns, ranges);
  collectPhraseRanges(normalized, patterns, ranges);
};

const collectWordRanges = (
  normalized: string,
  patterns: StrictPatternSet,
  ranges: TextRange[],
): void => {
  // Strict terms must own the whole word token; embedded prefixes are rejected by
  // boundaryCheckedRange before they become mask ranges.
  for (const match of normalized.matchAll(WORD_RE)) {
    if (!matchesAnyTokenPattern(patterns.token, match[0])) {
      continue;
    }

    const range = boundaryCheckedRange(
      normalized,
      match.index,
      match.index + match[0].length,
    );
    if (range !== null) {
      ranges.push(range);
    }
  }
};

const collectSymbolRanges = (
  normalized: string,
  patterns: StrictPatternSet,
  ranges: TextRange[],
): void => {
  // Symbol-only literals such as "(" or "." never appear in WORD_RE.
  forEachSymbolRun(normalized, (start, end) => {
    const positions = codePointPositions(normalized, start, end);

    for (let left = 0; left < positions.length - 1; left++) {
      for (const length of patterns.symbolLengths) {
        const rangeStart = positions[left];
        const rangeEnd = rangeStart + length;
        if (rangeEnd > end) {
          continue;
        }
        if (
          matchesAnyTokenPattern(
            patterns.symbolToken,
            normalized.slice(rangeStart, rangeEnd),
          )
        ) {
          ranges.push([rangeStart, rangeEnd]);
        }
      }
    }
  });
};

const collectPhraseRanges = (
  normalized: string,
  patterns: StrictPatternSet,
  ranges: TextRange[],
): void =>
  // Phrase pass is for strict literals that contain punctuation, for example
  // `foo.bar`; plain word literals are already handled by collectWordRanges.
  forEachPatternMatch(normalized, patterns.phrase, (start, end) => {
    if (
      boundaryCheckedRange(normalized, start, end) !== null ||
      !containsWordChar(normalized, start, end)
    ) {
      ranges.push([start, end]);
    }
  });

const matchesAnyTokenPattern = (
  patterns: readonly CompiledPattern[],
  value: string,
): boolean => patterns.some((pattern) => patternMatches(pattern, value));

const containsWordChar = (
  normalized: string,
  start: number,
  end: number,
): boolean => {
  for (let position = start; position < end; ) {
    const charEnd = nextCodePointEnd(normalized, position);
    if (WORD_CHAR_RE.test(normalized.slice(position, charEnd))) {
      return true;
    }
    position = charEnd;
  }
  return false;
};

const forEachSymbolRun = (
  normalized: string,
  visit: (start: number, end: number) => void,
): void => {
  for (let position = 0; position < normalized.length; ) {
    const charEnd = nextCodePointEnd(normalized, position);
    const char = normalized.slice(position, charEnd);

    if (WORD_CHAR_RE.test(char) || WHITESPACE_RE.test(char)) {
      position = charEnd;
      continue;
    }

    const start = position;
    position = charEnd;

    while (position < normalized.length) {
      const nextEnd = nextCodePointEnd(normalized, position);
      const next = normalized.slice(position, nextEnd);
      if (WORD_CHAR_RE.test(next) || WHITESPACE_RE.test(next)) {
        break;
      }
      position = nextEnd;
    }

    visit(start, position);
  }
};

const codePointPositions = (
  normalized: string,
  start: number,
  end: number,
): number[] => {
  const positions = [start];
  let position = start;
  while (position < end) {
    position = nextCodePointEnd(normalized, position);
    positions.push(position);
  }
  return positions;
};
