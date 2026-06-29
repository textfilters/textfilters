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
import { iteratePatternMatches, somePatternMatch } from "./patterns.js";

type CollectedRangePredicate = (range: CollectedProfanityRange) => boolean;

export const collectStrictRanges = (
  normalized: string,
  patterns: StrictPatternSet,
  ranges: CollectedProfanityRange[],
): void => {
  for (const range of iterateStrictRanges(normalized, patterns)) {
    ranges.push(range);
  }
};

export function* iterateStrictRanges(
  normalized: string,
  patterns: StrictPatternSet,
): IterableIterator<CollectedProfanityRange> {
  if (!hasStrictPatterns(patterns)) return;

  yield* iterateWordRanges(normalized, patterns);
  yield* iterateSymbolRanges(normalized, patterns);
  yield* iteratePhraseRanges(normalized, patterns);
}

export const hasStrictRange = (
  normalized: string,
  patterns: StrictPatternSet,
  predicate: CollectedRangePredicate,
): boolean =>
  hasWordRange(normalized, patterns, predicate) ||
  hasSymbolRange(normalized, patterns, predicate) ||
  hasPhraseRange(normalized, patterns, predicate);

const collectWordRanges = (
  normalized: string,
  patterns: StrictPatternSet,
  ranges: CollectedProfanityRange[],
): void => {
  for (const range of iterateWordRanges(normalized, patterns)) {
    ranges.push(range);
  }
};

function* iterateWordRanges(
  normalized: string,
  patterns: StrictPatternSet,
): IterableIterator<CollectedProfanityRange> {
  if (patterns.token.length === 0) return;

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
      yield collectedRangeForPattern(range, pattern);
    }
  }
}

const hasWordRange = (
  normalized: string,
  patterns: StrictPatternSet,
  predicate: CollectedRangePredicate,
): boolean => {
  if (patterns.token.length === 0) return false;

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
    if (range !== null && predicate(collectedRangeForPattern(range, pattern))) {
      return true;
    }
  }

  return false;
};

const collectSymbolRanges = (
  normalized: string,
  patterns: StrictPatternSet,
  ranges: CollectedProfanityRange[],
): void => {
  for (const range of iterateSymbolRanges(normalized, patterns)) {
    ranges.push(range);
  }
};

function* iterateSymbolRanges(
  normalized: string,
  patterns: StrictPatternSet,
): IterableIterator<CollectedProfanityRange> {
  if (
    patterns.symbolToken.length === 0 ||
    patterns.symbolLengths.length === 0
  ) {
    return;
  }

  // Symbol-only literals such as "(" or "." never appear in WORD_RE.
  for (let rangeStart = 0; rangeStart < normalized.length; ) {
    const charEnd = nextCodePointEnd(normalized, rangeStart);
    if (!isSymbolCodePoint(normalized, rangeStart, charEnd)) {
      rangeStart = charEnd;
      continue;
    }

    for (const length of patterns.symbolLengths) {
      const rangeEnd = rangeStart + length;
      if (!isSymbolRange(normalized, rangeStart, rangeEnd)) {
        continue;
      }

      const pattern = findMatchingPatternInList(
        patterns.symbolToken,
        normalized.slice(rangeStart, rangeEnd),
      );
      if (pattern !== null) {
        yield collectedRangeForPattern([rangeStart, rangeEnd], pattern);
      }
    }

    rangeStart = charEnd;
  }
}

const hasSymbolRange = (
  normalized: string,
  patterns: StrictPatternSet,
  predicate: CollectedRangePredicate,
): boolean => {
  if (
    patterns.symbolToken.length === 0 ||
    patterns.symbolLengths.length === 0
  ) {
    return false;
  }

  for (const range of iterateSymbolRanges(normalized, patterns)) {
    if (predicate(range)) {
      return true;
    }
  }

  return false;
};

const collectPhraseRanges = (
  normalized: string,
  patterns: StrictPatternSet,
  ranges: CollectedProfanityRange[],
): void => {
  for (const range of iteratePhraseRanges(normalized, patterns)) {
    ranges.push(range);
  }
};

function* iteratePhraseRanges(
  normalized: string,
  patterns: StrictPatternSet,
): IterableIterator<CollectedProfanityRange> {
  if (patterns.phrase.length === 0) return;

  // Phrase pass is for strict literals that contain punctuation, for example
  // `foo.bar`; plain word literals are already handled by collectWordRanges.
  for (const { start, end, pattern } of iteratePatternMatches(
    normalized,
    patterns.phrase,
  )) {
    if (
      boundaryCheckedRange(normalized, start, end) !== null ||
      !containsWordChar(normalized, start, end)
    ) {
      yield collectedRangeForPattern([start, end], pattern);
    }
  }
}

const hasPhraseRange = (
  normalized: string,
  patterns: StrictPatternSet,
  predicate: CollectedRangePredicate,
): boolean => {
  if (patterns.phrase.length === 0) return false;

  return somePatternMatch(
    normalized,
    patterns.phrase,
    (start, end, pattern) => {
      if (
        boundaryCheckedRange(normalized, start, end) === null &&
        containsWordChar(normalized, start, end)
      ) {
        return false;
      }

      return predicate(collectedRangeForPattern([start, end], pattern));
    },
  );
};

const hasStrictPatterns = (patterns: StrictPatternSet): boolean =>
  patterns.token.length > 0 ||
  patterns.symbolToken.length > 0 ||
  patterns.phrase.length > 0;

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

const isSymbolRange = (
  normalized: string,
  start: number,
  end: number,
): boolean => {
  if (end > normalized.length) return false;

  let position = start;
  while (position < end) {
    const charEnd = nextCodePointEnd(normalized, position);
    if (charEnd > end || !isSymbolCodePoint(normalized, position, charEnd)) {
      return false;
    }
    position = charEnd;
  }

  return position === end;
};

const isSymbolCodePoint = (
  normalized: string,
  start: number,
  end: number,
): boolean => {
  const char = normalized.slice(start, end);
  return !WORD_CHAR_RE.test(char) && !WHITESPACE_RE.test(char);
};
