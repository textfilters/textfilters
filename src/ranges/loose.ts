import type { TextRange } from "@textfilters/core";
import type { StrictPatternSet } from "../matchers/build.js";
import type { CompiledPattern } from "../matchers/compile.js";
import type { CollectedProfanityRange } from "../matches/ranges.js";
import { nextCodePointEnd } from "../normalization/text.js";
import {
  containsWordChar,
  expandToTokenBounds,
  SPLIT_TOKEN_CHAR_RE,
  tokenBoundsAt,
  WORD_CHAR_RE,
} from "../token-ranges.js";
import { boundaryCheckedRange } from "./boundary.js";
import { collectedRangeForPattern } from "./collected.js";
import { knownHyphenatedSuffixRange } from "./hyphen-tail.js";
import { iteratePatternMatches, somePatternMatch } from "./patterns.js";

interface LooseRangePatterns {
  readonly loose: readonly CompiledPattern[];
  readonly strict: StrictPatternSet;
}

type CollectedRangePredicate = (range: CollectedProfanityRange) => boolean;

export const collectLooseRanges = (
  normalized: string,
  source: string,
  loosePatterns: readonly CompiledPattern[],
  strictPatterns: StrictPatternSet,
  ranges: CollectedProfanityRange[],
): void => {
  for (const range of iterateLooseRanges(
    normalized,
    source,
    loosePatterns,
    strictPatterns,
  )) {
    ranges.push(range);
  }
};

export function* iterateLooseRanges(
  normalized: string,
  source: string,
  loosePatterns: readonly CompiledPattern[],
  strictPatterns: StrictPatternSet,
): IterableIterator<CollectedProfanityRange> {
  const patterns = { loose: loosePatterns, strict: strictPatterns };

  for (const { start, end, pattern } of iteratePatternMatches(
    normalized,
    loosePatterns,
  )) {
    const range = looseRange(normalized, source, start, end, pattern, patterns);

    if (range !== null) {
      yield collectedRangeForPattern(range, pattern);
    }
  }
}

export const hasLooseRange = (
  normalized: string,
  source: string,
  loosePatterns: readonly CompiledPattern[],
  strictPatterns: StrictPatternSet,
  predicate: CollectedRangePredicate,
): boolean => {
  const patterns = { loose: loosePatterns, strict: strictPatterns };

  return somePatternMatch(normalized, loosePatterns, (start, end, pattern) => {
    const range = looseRange(normalized, source, start, end, pattern, patterns);

    return (
      range !== null && predicate(collectedRangeForPattern(range, pattern))
    );
  });
};

const looseRange = (
  normalized: string,
  source: string,
  start: number,
  end: number,
  pattern: CompiledPattern,
  patterns: LooseRangePatterns,
  trimHyphenSuffix = true,
): TextRange | null => {
  const hyphenSuffix =
    trimHyphenSuffix && pattern.trimHyphenTail === true
      ? knownHyphenatedSuffixRange(
          normalized,
          source,
          start,
          end,
          pattern,
          patterns,
          looseTailMatchEnd,
        )
      : { emitEnd: end, boundaryEnd: end };
  const adjustedEnd = hyphenSuffix.emitEnd;

  const checked = boundaryCheckedRange(
    normalized,
    start,
    hyphenSuffix.boundaryEnd,
  );
  if (checked === null) {
    if (
      hyphenSuffix.emitEnd > end &&
      startsAtTokenBoundary(normalized, start)
    ) {
      return [start, adjustedEnd];
    }
    return containsWordChar(normalized, start, end)
      ? null
      : [start, adjustedEnd];
  }

  const [trimmedStart, checkedEnd] = checked;
  const trimmedEnd = Math.min(adjustedEnd, checkedEnd);
  // Loose matches may include separators around a token, so the final mask range
  // expands after boundary validation instead of before it.
  const [expandedStart, expandedEnd] = expandToTokenBounds(
    normalized,
    trimmedStart,
    trimmedEnd,
  );

  return [
    Math.min(expandedStart, start),
    Math.max(
      trimSplitWordSuffix(normalized, trimmedEnd, expandedEnd),
      adjustedEnd,
    ),
  ];
};

const looseTailMatchEnd = (
  normalized: string,
  source: string,
  start: number,
  end: number,
  pattern: CompiledPattern,
  patterns: LooseRangePatterns,
): number | null => {
  const range = looseRange(
    normalized,
    source,
    start,
    end,
    pattern,
    patterns,
    false,
  );
  if (range !== null) return range[1];

  // Hyphen-tail rescans a suffix slice. If a loose match starts after a split
  // character, evaluate that segment as if it were the start of the suffix.
  if (start === 0 || SPLIT_TOKEN_CHAR_RE.test(normalized[start - 1] ?? "")) {
    const segmentRange = looseRange(
      normalized.slice(start),
      source.slice(start),
      0,
      end - start,
      pattern,
      patterns,
      false,
    );
    return segmentRange === null ? end : start + segmentRange[1];
  }

  return null;
};

const startsAtTokenBoundary = (normalized: string, start: number): boolean =>
  tokenBoundsAt(normalized, start)[0] === start;

const trimSplitWordSuffix = (
  normalized: string,
  trimmedEnd: number,
  expandedEnd: number,
): number => {
  const suffix = normalized.slice(trimmedEnd, expandedEnd);
  if (suffix.length === 0) return expandedEnd;
  if (!Array.from(suffix).some((char) => SPLIT_TOKEN_CHAR_RE.test(char))) {
    return expandedEnd;
  }
  return containsNonSplitWordChar(normalized, trimmedEnd, expandedEnd)
    ? trimmedEnd
    : expandedEnd;
};

const containsNonSplitWordChar = (
  normalized: string,
  start: number,
  end: number,
): boolean => {
  for (let position = start; position < end; ) {
    const charEnd = nextCodePointEnd(normalized, position);
    const char = normalized.slice(position, charEnd);
    if (WORD_CHAR_RE.test(char) && !SPLIT_TOKEN_CHAR_RE.test(char)) {
      return true;
    }
    position = charEnd;
  }
  return false;
};
