import type {
  IndexedTokenPattern,
  StrictPatternSet,
  TokenPatternIndex,
} from "../matchers/build.js";
import { patternMatches, type CompiledPattern } from "../matchers/compile.js";
import type { CollectedProfanityRange } from "../matches/ranges.js";
import {
  nextCodePointEnd,
  previousCodePointStart,
} from "../normalization/text.js";
import {
  containsWordChar,
  isLeadingTokenPadding,
  isTokenPaddingChar,
  isTrailingTokenPadding,
  SPLIT_TOKEN_CHAR_RE,
  WHITESPACE_RE,
  WORD_CHAR_RE,
  WORD_RE,
} from "../token-ranges.js";
import { boundaryCheckedRange } from "./boundary.js";
import { collectedRangeForPattern } from "./collected.js";
import { iteratePatternMatches, somePatternMatch } from "./patterns.js";

type CollectedRangePredicate = (range: CollectedProfanityRange) => boolean;
const acceptAnyRange: CollectedRangePredicate = () => true;
const acceptAnyPattern = (): boolean => true;

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
  acceptsRange: CollectedRangePredicate = acceptAnyRange,
): IterableIterator<CollectedProfanityRange> {
  if (!hasStrictPatterns(patterns)) return;

  yield* iterateWordRanges(normalized, patterns, acceptsRange);
  yield* iterateSymbolRanges(normalized, patterns);
  yield* iteratePhraseRanges(normalized, patterns);
}

export const hasStrictRange = (
  normalized: string,
  patterns: StrictPatternSet,
  predicate: CollectedRangePredicate,
  acceptsRange: CollectedRangePredicate = acceptAnyRange,
): boolean =>
  hasWordRange(normalized, patterns, predicate, acceptsRange) ||
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
  acceptsRange: CollectedRangePredicate = acceptAnyRange,
): IterableIterator<CollectedProfanityRange> {
  if (patterns.token.length === 0) return;

  const lookupState = createTokenLookupState();

  // Strict terms must own the whole word token; embedded prefixes are rejected by
  // boundaryCheckedRange before they become mask ranges.
  for (const match of normalized.matchAll(WORD_RE)) {
    const range = matchedWordRange(
      normalized,
      match.index,
      match[0],
      patterns,
      lookupState,
      acceptsRange,
    );
    if (range !== null) {
      yield range;
    }
  }
}

const hasWordRange = (
  normalized: string,
  patterns: StrictPatternSet,
  predicate: CollectedRangePredicate,
  acceptsRange: CollectedRangePredicate,
): boolean => {
  if (patterns.token.length === 0) return false;

  const lookupState = createTokenLookupState();

  for (const match of normalized.matchAll(WORD_RE)) {
    const range = matchedWordRange(
      normalized,
      match.index,
      match[0],
      patterns,
      lookupState,
      acceptsRange,
    );
    if (range !== null && predicate(range)) {
      return true;
    }
  }

  return false;
};

const matchedWordRange = (
  normalized: string,
  occurrenceStart: number,
  value: string,
  patterns: StrictPatternSet,
  lookupState: TokenLookupState,
  acceptsRange: CollectedRangePredicate,
): CollectedProfanityRange | null => {
  const fullRange = matchedIndexedTokenRange(
    normalized,
    occurrenceStart,
    value,
    patterns,
    lookupState,
    acceptsRange,
  );
  if (fullRange !== null) {
    return fullRange;
  }

  const [trimStart, trimEnd] = trimTokenPadding(value);
  if (trimStart === 0 && trimEnd === value.length) {
    return null;
  }

  return matchedIndexedTokenRange(
    normalized,
    occurrenceStart + trimStart,
    value.slice(trimStart, trimEnd),
    patterns,
    lookupState,
    acceptsRange,
  );
};

const matchedIndexedTokenRange = (
  normalized: string,
  occurrenceStart: number,
  value: string,
  patterns: StrictPatternSet,
  lookupState: TokenLookupState,
  acceptsRange: CollectedRangePredicate,
): CollectedProfanityRange | null => {
  if (value.length === 0) {
    return null;
  }

  const pattern = findMatchingIndexedTokenPattern(patterns, value, lookupState);
  if (pattern === null) {
    return null;
  }

  const range = boundaryCheckedRange(
    normalized,
    occurrenceStart,
    occurrenceStart + value.length,
  );
  return range === null
    ? null
    : acceptedIndexedTokenRange(
        patterns,
        value,
        lookupState,
        range,
        pattern,
        acceptsRange,
      );
};

const trimTokenPadding = (value: string): readonly [number, number] => {
  let leadingEnd = 0;
  let trailingStart = value.length;

  while (leadingEnd < value.length) {
    const next = nextCodePointEnd(value, leadingEnd);
    if (!isTokenPaddingChar(value.slice(leadingEnd, next))) {
      break;
    }
    leadingEnd = next;
  }
  while (trailingStart > 0) {
    const previous = previousCodePointStart(value, trailingStart);
    if (!isTokenPaddingChar(value.slice(previous, trailingStart))) {
      break;
    }
    trailingStart = previous;
  }

  return [
    isLeadingTokenPadding(value.slice(0, leadingEnd)) ? leadingEnd : 0,
    isTrailingTokenPadding(value.slice(trailingStart))
      ? trailingStart
      : value.length,
  ];
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

interface TokenLookupState {
  readonly buckets: (readonly IndexedTokenPattern[])[];
  readonly positions: number[];
  firstValue?: string;
  firstPattern?: CompiledPattern | null;
  secondValue?: string;
  secondPattern?: CompiledPattern | null;
  cache?: Record<string, CompiledPattern | null>;
}

const createTokenLookupState = (): TokenLookupState => ({
  buckets: [],
  positions: [],
});

const findMatchingIndexedTokenPattern = (
  patterns: StrictPatternSet,
  value: string,
  state: TokenLookupState,
): CompiledPattern | null => {
  const cache = state.cache;
  if (cache !== undefined) {
    const cached = cache[value];
    if (cached !== undefined) {
      return cached;
    }

    const pattern = lookupIndexedTokenPattern(patterns, value, state);
    cache[value] = pattern;
    return pattern;
  }

  if (state.firstValue === value) {
    return state.firstPattern ?? null;
  }
  if (state.secondValue === value) {
    return state.secondPattern ?? null;
  }

  const pattern = lookupIndexedTokenPattern(patterns, value, state);

  if (state.firstValue === undefined) {
    state.firstValue = value;
    state.firstPattern = pattern;
    return pattern;
  }

  if (state.secondValue === undefined) {
    state.secondValue = value;
    state.secondPattern = pattern;
    return pattern;
  }

  // Keep one- and two-token inputs on an allocation-minimal inline path. The
  // dictionary promotes only after a third distinct token and stays
  // bounded by the unique normalized tokens in this invocation.
  state.cache = Object.create(null) as Record<string, CompiledPattern | null>;
  state.cache[state.firstValue] = state.firstPattern ?? null;
  state.cache[state.secondValue] = state.secondPattern ?? null;
  state.firstValue = undefined;
  state.firstPattern = undefined;
  state.secondValue = undefined;
  state.secondPattern = undefined;

  state.cache[value] = pattern;
  return pattern;
};

const acceptedIndexedTokenRange = (
  patterns: StrictPatternSet,
  value: string,
  state: TokenLookupState,
  range: readonly [number, number],
  firstPattern: CompiledPattern,
  acceptsRange: CollectedRangePredicate,
): CollectedProfanityRange | null => {
  const firstRange = collectedRangeForPattern(range, firstPattern);
  if (acceptsRange(firstRange)) {
    return firstRange;
  }

  const nextPattern = lookupIndexedTokenPattern(
    patterns,
    value,
    state,
    patterns.token.indexOf(firstPattern),
    (pattern) => acceptsRange(collectedRangeForPattern(range, pattern)),
  );

  return nextPattern === null
    ? null
    : collectedRangeForPattern(range, nextPattern);
};

const lookupIndexedTokenPattern = (
  patterns: StrictPatternSet,
  value: string,
  state: TokenLookupState,
  afterOrder = -1,
  acceptsPattern: (pattern: CompiledPattern) => boolean = acceptAnyPattern,
): CompiledPattern | null => {
  resetTokenLookupScratch(state);
  addTokenIndexBucket(state, patterns.tokenIndex.fallback);
  addTokenIndexLookupBuckets(state, patterns.tokenIndex, value);

  while (true) {
    let nextCandidate: IndexedTokenPattern | undefined;

    for (
      let bucketIndex = 0;
      bucketIndex < state.buckets.length;
      bucketIndex++
    ) {
      const bucket = state.buckets[bucketIndex]!;
      const candidate = bucket[state.positions[bucketIndex]!];
      if (
        candidate !== undefined &&
        (nextCandidate === undefined || candidate.order < nextCandidate.order)
      ) {
        nextCandidate = candidate;
      }
    }

    if (nextCandidate === undefined) return null;

    // A pattern can occur in multiple case-variant or split-token buckets. All
    // buckets are ordered at build time, so advancing every copy of the lowest
    // numeric order de-duplicates without a per-token Set or candidate sort.
    for (
      let bucketIndex = 0;
      bucketIndex < state.buckets.length;
      bucketIndex++
    ) {
      const bucket = state.buckets[bucketIndex]!;
      let position = state.positions[bucketIndex]!;
      if (bucket[position]?.order === nextCandidate.order) {
        position++;
        state.positions[bucketIndex] = position;
      }
    }

    if (
      nextCandidate.order > afterOrder &&
      patternMatches(nextCandidate.pattern, value) &&
      acceptsPattern(nextCandidate.pattern)
    ) {
      return nextCandidate.pattern;
    }
  }
};

const resetTokenLookupScratch = (state: TokenLookupState): void => {
  state.buckets.length = 0;
  state.positions.length = 0;
};

const addTokenIndexLookupBuckets = (
  state: TokenLookupState,
  index: TokenPatternIndex,
  value: string,
): void => {
  const firstEnd = nextCodePointEnd(value, 0);
  const first = value.slice(0, firstEnd);

  addTokenIndexLookupCharBuckets(state, index, first);

  if (!SPLIT_TOKEN_CHAR_RE.test(first)) {
    return;
  }

  for (let position = firstEnd; position < value.length; ) {
    const end = nextCodePointEnd(value, position);
    addTokenIndexLookupCharBuckets(state, index, value.slice(position, end));
    position = end;
  }
};

const addTokenIndexLookupCharBuckets = (
  state: TokenLookupState,
  index: TokenPatternIndex,
  char: string,
): void => {
  addTokenIndexBucketForChar(state, index, char);

  const lower = char.toLowerCase();
  if (lower !== char) {
    addTokenIndexBucketForChar(state, index, lower);
  }

  const upper = char.toUpperCase();
  if (upper !== char && upper !== lower) {
    addTokenIndexBucketForChar(state, index, upper);
  }
};

const addTokenIndexBucketForChar = (
  state: TokenLookupState,
  index: TokenPatternIndex,
  char: string,
): void => {
  const bucket = index.byFirstChar.get(char);
  if (bucket !== undefined) {
    addTokenIndexBucket(state, bucket);
  }
};

const addTokenIndexBucket = (
  state: TokenLookupState,
  bucket: readonly IndexedTokenPattern[],
): void => {
  if (bucket.length === 0) return;

  for (const existing of state.buckets) {
    if (existing === bucket) return;
  }

  state.buckets.push(bucket);
  state.positions.push(0);
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
