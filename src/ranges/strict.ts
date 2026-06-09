import type { TextRange } from "@textfilters/core";
import type { StrictPatternSet } from "../matchers/build.js";
import type { CompiledPattern } from "../matchers/compile.js";
import { patternMatches } from "../matchers/compile.js";
import type { CollectedProfanityRange } from "../matches/ranges.js";
import { nextCodePointEnd } from "../normalization/text.js";
import { WHITESPACE_RE, WORD_CHAR_RE, WORD_RE } from "../token-ranges.js";
import { boundaryCheckedRange } from "./boundary.js";
import { forEachPatternMatch } from "./patterns.js";

export const collectStrictRanges = (
  normalized: string,
  patterns: StrictPatternSet,
  ranges: CollectedProfanityRange[],
): void => {
  collectWordRanges(normalized, patterns, ranges);
  collectSymbolRanges(normalized, patterns, ranges);
  collectPhraseRanges(normalized, patterns, ranges);
};

const collectWordRanges = (
  normalized: string,
  patterns: StrictPatternSet,
  ranges: CollectedProfanityRange[],
): void => {
  // Strict terms must own the whole word token; embedded prefixes are rejected by
  // boundaryCheckedRange before they become mask ranges.
  for (const match of normalized.matchAll(WORD_RE)) {
    const pattern = findMatchingTokenPattern(patterns.token, match[0]);
    if (pattern === null) {
      continue;
    }

    const range = boundaryCheckedRange(
      normalized,
      match.index,
      match.index + match[0].length,
    );
    if (range !== null) {
      ranges.push(rangeForPattern(range, pattern));
    }
  }
};

const collectSymbolRanges = (
  normalized: string,
  patterns: StrictPatternSet,
  ranges: CollectedProfanityRange[],
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
        const pattern = findMatchingTokenPattern(
          patterns.symbolToken,
          normalized.slice(rangeStart, rangeEnd),
        );
        if (pattern !== null) {
          ranges.push(rangeForPattern([rangeStart, rangeEnd], pattern));
        }
      }
    }
  });
};

const collectPhraseRanges = (
  normalized: string,
  patterns: StrictPatternSet,
  ranges: CollectedProfanityRange[],
): void =>
  // Phrase pass is for strict literals that contain punctuation, for example
  // `foo.bar`; plain word literals are already handled by collectWordRanges.
  forEachPatternMatch(normalized, patterns.phrase, (start, end, pattern) => {
    if (
      boundaryCheckedRange(normalized, start, end) !== null ||
      !containsWordChar(normalized, start, end)
    ) {
      ranges.push(rangeForPattern([start, end], pattern));
    }
  });

const findMatchingTokenPattern = (
  patterns: readonly CompiledPattern[],
  value: string,
): CompiledPattern | null => {
  for (const pattern of patterns) {
    if (patternMatches(pattern, value)) return pattern;
  }
  return null;
};

const rangeForPattern = (
  range: TextRange,
  pattern: CompiledPattern,
): CollectedProfanityRange =>
  pattern.ruleId === undefined
    ? range
    : Object.assign([range[0], range[1]] as [number, number], {
        ruleId: pattern.ruleId,
      });

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
