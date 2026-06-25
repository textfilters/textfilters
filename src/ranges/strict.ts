import type { StrictPatternSet } from "../matchers/build.js";
import { patternMatches, type CompiledPattern } from "../matchers/compile.js";
import type { CollectedProfanityRange } from "../matches/ranges.js";
import { nextCodePointEnd } from "../normalization/text.js";
import {
  containsWordChar,
  SPLIT_TOKEN_CHAR_RE,
  WHITESPACE_RE,
  WORD_CHAR_RE,
  WORD_RE,
} from "../token-ranges.js";
import { boundaryCheckedRange } from "./boundary.js";
import { collectedRangeForPattern } from "./collected.js";
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
    const pattern = findMatchingIndexedTokenPattern(patterns, match[0]);
    if (pattern === null) {
      continue;
    }

    const range = boundaryCheckedRange(
      normalized,
      match.index,
      match.index + match[0].length,
    );
    if (range !== null) {
      ranges.push(collectedRangeForPattern(range, pattern));
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
        const pattern = findMatchingPatternInList(
          patterns.symbolToken,
          normalized.slice(rangeStart, rangeEnd),
        );
        if (pattern !== null) {
          ranges.push(
            collectedRangeForPattern([rangeStart, rangeEnd], pattern),
          );
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
      ranges.push(collectedRangeForPattern([start, end], pattern));
    }
  });

const findMatchingIndexedTokenPattern = (
  patterns: StrictPatternSet,
  value: string,
): CompiledPattern | null => {
  const candidates = [...patterns.tokenIndex.fallback];
  const seenOrders = new Set(candidates.map((candidate) => candidate.order));

  for (const char of tokenIndexLookupChars(value)) {
    const bucket = patterns.tokenIndex.byFirstChar.get(char);
    if (bucket === undefined) continue;

    for (const candidate of bucket) {
      if (seenOrders.has(candidate.order)) continue;
      seenOrders.add(candidate.order);
      candidates.push(candidate);
    }
  }

  candidates.sort((left, right) => left.order - right.order);

  for (const candidate of candidates) {
    if (patternMatches(candidate.pattern, value)) return candidate.pattern;
  }

  return null;
};

const tokenIndexLookupChars = (value: string): Set<string> => {
  const chars = new Set<string>();
  const firstEnd = nextCodePointEnd(value, 0);
  const first = value.slice(0, firstEnd);

  addTokenIndexLookupChar(chars, first);

  if (!SPLIT_TOKEN_CHAR_RE.test(first)) {
    return chars;
  }

  for (let position = firstEnd; position < value.length; ) {
    const end = nextCodePointEnd(value, position);
    addTokenIndexLookupChar(chars, value.slice(position, end));
    position = end;
  }

  return chars;
};

const addTokenIndexLookupChar = (chars: Set<string>, char: string): void => {
  chars.add(char);
  chars.add(char.toLowerCase());
  chars.add(char.toUpperCase());
};

const findMatchingPatternInList = (
  patterns: readonly CompiledPattern[],
  value: string,
): CompiledPattern | null => {
  for (const pattern of patterns) {
    if (patternMatches(pattern, value)) return pattern;
  }
  return null;
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
