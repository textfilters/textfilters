import {
  lowerNfkc,
  stripZeroWidth,
  type TextCodePointRange,
} from "@textfilters/core";

import {
  DOT_CHAR_SET,
  HOST_LABEL_CHAR_RE,
  LETTER_OR_DIGIT_RE,
  LOOKALIKE_TO_ASCII,
  UNICODE_MARK_RE,
  WHITESPACE_RE,
} from "./chars.js";
import {
  TLD_AMBIGUOUS_ASCII,
  TLD_CONFUSABLE_TO_ASCII,
  TLD_ORIGINAL_CONFUSABLE_TO_ASCII,
} from "./tld-confusables.js";
import { DEFAULT_TLDS, DEFAULT_TLD_SET } from "./tlds.js";

export interface TextMeta {
  readonly codePoints: readonly string[];
  readonly raw: readonly string[];
  readonly skeleton: readonly string[];
  readonly symbol: readonly string[];
  readonly zeroWidth: readonly boolean[];
  readonly whitespace: readonly boolean[];
  readonly alphaNum: readonly boolean[];
  readonly labelChar: readonly boolean[];
  readonly separator: readonly boolean[];
  readonly labelJoinSeparator: readonly boolean[];
}

export interface Match {
  readonly start: number;
  readonly end: number;
  readonly pos: number;
}

export interface Label extends Match {
  readonly raw: string;
  readonly skeleton: string;
  readonly source?: string;
}

export interface LabelText {
  readonly raw: string;
  readonly skeleton: string;
  readonly source?: string;
}

export interface DomainMatch extends Match {
  readonly labels: readonly Label[];
}

export type CodePointRange = TextCodePointRange;

export const toRawChar = (ch: string): string => lowerNfkc(ch);

export const toSkeleton = (value: unknown): string =>
  Array.from(lowerNfkc(value))
    .map((ch) => LOOKALIKE_TO_ASCII[ch] ?? ch)
    .join("");

export const toRawChars = (value: string): string[] =>
  Array.from(lowerNfkc(value));

export const toSkeletonChars = (value: string): string[] =>
  toRawChars(value).map((ch) => LOOKALIKE_TO_ASCII[ch] ?? ch);

type TldSkeletonPattern = readonly (readonly string[])[];

interface OriginalSourceTldAlternative {
  readonly reading: string;
  readonly usesOriginalMapping: boolean;
}

type OriginalSourceTldPattern =
  readonly (readonly OriginalSourceTldAlternative[])[];

interface IndexedTldSkeletonPattern {
  readonly pattern: TldSkeletonPattern;
  readonly sourceAwareTargetPattern: TldSkeletonPattern;
  readonly minLength: number;
  readonly maxLength: number;
}

interface TldSkeletonIndex {
  readonly sourceTlds: readonly string[];
  readonly patternsByBoundary: ReadonlyMap<
    string,
    readonly IndexedTldSkeletonPattern[]
  >;
  readonly matchCache: Map<string, boolean>;
}

const TLD_MATCH_CACHE_LIMIT = 512;
const ASCII_CODE_POINT_RE = /^[\x00-\x7f]$/u;
const SOURCE_READING_POSITIONAL_ALTERNATIVE: Readonly<Record<string, string>> =
  {
    "0": "o",
    "1": "l",
    l: "1",
    m: "rn",
    o: "0",
    rn: "m",
  };

const createNormalizedTldReadings = (value: string): readonly string[] => {
  let readings = [""];
  for (const ch of Array.from(lowerNfkc(value))) {
    const unicodeMapping = TLD_CONFUSABLE_TO_ASCII[ch];
    const legacyMapping = LOOKALIKE_TO_ASCII[ch];
    const primary = unicodeMapping ?? legacyMapping ?? ch;
    const alternatives = new Set<string>([primary]);
    if (legacyMapping) alternatives.add(legacyMapping);
    for (const alternative of TLD_AMBIGUOUS_ASCII[ch] ?? []) {
      alternatives.add(alternative);
    }
    readings = readings.flatMap((prefix) =>
      Array.from(alternatives, (alternative) => prefix + alternative),
    );
  }
  return readings;
};

const createTldSkeletonPattern = (
  value: string,
  includeAsciiOriginalMappings = true,
): TldSkeletonPattern =>
  Array.from(value, (source) => {
    const alternatives = new Set(createNormalizedTldReadings(source));
    const originalMapping = TLD_ORIGINAL_CONFUSABLE_TO_ASCII[source];
    if (
      originalMapping &&
      (includeAsciiOriginalMappings || !ASCII_CODE_POINT_RE.test(source))
    ) {
      alternatives.add(originalMapping);
    }
    return Array.from(alternatives);
  });

const createOriginalSourceTldPattern = (
  value: string,
): OriginalSourceTldPattern =>
  Array.from(value, (source) => {
    const alternatives = new Map<string, boolean>();
    for (const reading of createNormalizedTldReadings(source)) {
      alternatives.set(reading, false);
    }
    if (!ASCII_CODE_POINT_RE.test(source)) {
      const originalMapping = TLD_ORIGINAL_CONFUSABLE_TO_ASCII[source];
      if (originalMapping !== undefined) {
        alternatives.set(originalMapping, true);
      }
      for (const reading of Array.from(alternatives.keys())) {
        const positionalAlternative =
          SOURCE_READING_POSITIONAL_ALTERNATIVE[reading];
        if (positionalAlternative !== undefined) {
          alternatives.set(positionalAlternative, true);
        }
      }
    }
    return Array.from(alternatives, ([reading, usesOriginalMapping]) => ({
      reading,
      usesOriginalMapping,
    }));
  });

const createSourcePositionAwareTldPattern = (
  value: string,
): TldSkeletonPattern =>
  createOriginalSourceTldPattern(value).map((alternatives) =>
    alternatives.map((alternative) => alternative.reading),
  );

const patternsIntersect = (
  left: TldSkeletonPattern,
  right: TldSkeletonPattern,
): boolean => {
  const seen = new Set<string>();
  const visit = (
    leftIndex: number,
    leftRemainder: string,
    rightIndex: number,
    rightRemainder: string,
  ): boolean => {
    const state = `${leftIndex}\u0000${leftRemainder}\u0000${rightIndex}\u0000${rightRemainder}`;
    if (seen.has(state)) return false;
    seen.add(state);

    if (!leftRemainder) {
      if (leftIndex >= left.length) {
        return !rightRemainder && rightIndex >= right.length;
      }
      return left[leftIndex].some((alternative) =>
        visit(leftIndex + 1, alternative, rightIndex, rightRemainder),
      );
    }
    if (!rightRemainder) {
      if (rightIndex >= right.length) return false;
      return right[rightIndex].some((alternative) =>
        visit(leftIndex, leftRemainder, rightIndex + 1, alternative),
      );
    }

    const sharedLength = Math.min(leftRemainder.length, rightRemainder.length);
    if (
      leftRemainder.slice(0, sharedLength) !==
      rightRemainder.slice(0, sharedLength)
    ) {
      return false;
    }
    return visit(
      leftIndex,
      leftRemainder.slice(sharedLength),
      rightIndex,
      rightRemainder.slice(sharedLength),
    );
  };

  return visit(0, "", 0, "");
};

const originalSourcePatternIntersects = (
  left: OriginalSourceTldPattern,
  right: TldSkeletonPattern,
): boolean => {
  const seen = new Set<string>();
  const visit = (
    leftIndex: number,
    leftRemainder: string,
    rightIndex: number,
    rightRemainder: string,
    usedOriginalMapping: boolean,
  ): boolean => {
    const state = `${leftIndex}\u0000${leftRemainder}\u0000${rightIndex}\u0000${rightRemainder}\u0000${usedOriginalMapping ? "1" : "0"}`;
    if (seen.has(state)) return false;
    seen.add(state);

    if (!leftRemainder) {
      if (leftIndex >= left.length) {
        return (
          usedOriginalMapping && !rightRemainder && rightIndex >= right.length
        );
      }
      return left[leftIndex].some((alternative) =>
        visit(
          leftIndex + 1,
          alternative.reading,
          rightIndex,
          rightRemainder,
          usedOriginalMapping || alternative.usesOriginalMapping,
        ),
      );
    }
    if (!rightRemainder) {
      if (rightIndex >= right.length) return false;
      return right[rightIndex].some((alternative) =>
        visit(
          leftIndex,
          leftRemainder,
          rightIndex + 1,
          alternative,
          usedOriginalMapping,
        ),
      );
    }

    const sharedLength = Math.min(leftRemainder.length, rightRemainder.length);
    if (
      leftRemainder.slice(0, sharedLength) !==
      rightRemainder.slice(0, sharedLength)
    ) {
      return false;
    }
    return visit(
      leftIndex,
      leftRemainder.slice(sharedLength),
      rightIndex,
      rightRemainder.slice(sharedLength),
      usedOriginalMapping,
    );
  };

  return visit(0, "", 0, "", false);
};

const indexTldSkeletonPattern = (
  pattern: TldSkeletonPattern,
  sourceAwareTargetPattern: TldSkeletonPattern = pattern,
): IndexedTldSkeletonPattern => {
  let minLength = 0;
  let maxLength = 0;
  for (const alternatives of pattern) {
    const lengths = alternatives.map((alternative) => alternative.length);
    minLength += Math.min(...lengths);
    maxLength += Math.max(...lengths);
  }
  return { pattern, sourceAwareTargetPattern, minLength, maxLength };
};

const createBoundaryKeys = (pattern: TldSkeletonPattern): string[] => {
  const first = pattern[0];
  const last = pattern[pattern.length - 1];
  if (!first || !last) return [];

  const keys = new Set<string>();
  for (const firstAlternative of first) {
    const firstCodePoint = Array.from(firstAlternative)[0];
    if (!firstCodePoint) continue;
    for (const lastAlternative of last) {
      const lastCodePoints = Array.from(lastAlternative);
      const lastCodePoint = lastCodePoints[lastCodePoints.length - 1];
      if (lastCodePoint) keys.add(`${firstCodePoint}\u0000${lastCodePoint}`);
    }
  }
  return Array.from(keys);
};

const createTldSkeletonIndex = (tlds: Iterable<string>): TldSkeletonIndex => {
  const sourceTlds = Array.from(tlds);
  const patternsByBoundary = new Map<string, IndexedTldSkeletonPattern[]>();
  for (const tld of sourceTlds) {
    const target = indexTldSkeletonPattern(
      createTldSkeletonPattern(tld),
      createTldSkeletonPattern(tld, false),
    );
    for (const key of createBoundaryKeys(target.pattern)) {
      const bucket = patternsByBoundary.get(key);
      if (bucket) bucket.push(target);
      else patternsByBoundary.set(key, [target]);
    }
  }
  return {
    sourceTlds,
    patternsByBoundary,
    matchCache: new Map<string, boolean>(),
  };
};

const DEFAULT_TLD_SKELETON_INDEX = createTldSkeletonIndex(DEFAULT_TLDS);
// Weak keys keep custom indexes scoped to their set lifetime. Scanner entry
// points refresh an index if a low-level caller mutates the set between scans.
const CUSTOM_TLD_SKELETON_INDEXES = new WeakMap<
  ReadonlySet<string>,
  TldSkeletonIndex
>();

const hasSameTlds = (
  index: TldSkeletonIndex,
  tlds: ReadonlySet<string>,
): boolean => {
  if (index.sourceTlds.length !== tlds.size) return false;
  let position = 0;
  for (const tld of tlds) {
    if (index.sourceTlds[position] !== tld) return false;
    position++;
  }
  return true;
};

export const prepareTldSkeletonIndex = (tlds: ReadonlySet<string>): void => {
  if (tlds === DEFAULT_TLD_SET) return;
  const cached = CUSTOM_TLD_SKELETON_INDEXES.get(tlds);
  if (!cached || !hasSameTlds(cached, tlds)) {
    CUSTOM_TLD_SKELETON_INDEXES.set(tlds, createTldSkeletonIndex(tlds));
  }
};

const lengthsCanIntersect = (
  left: IndexedTldSkeletonPattern,
  right: IndexedTldSkeletonPattern,
): boolean =>
  left.minLength <= right.maxLength && right.minLength <= left.maxLength;

const getTldSkeletonIndex = (tlds: ReadonlySet<string>): TldSkeletonIndex => {
  if (tlds === DEFAULT_TLD_SET) return DEFAULT_TLD_SKELETON_INDEX;
  const cached = CUSTOM_TLD_SKELETON_INDEXES.get(tlds);
  if (cached) return cached;
  const created = createTldSkeletonIndex(tlds);
  CUSTOM_TLD_SKELETON_INDEXES.set(tlds, created);
  return created;
};

const hasIndexedTldSkeletonMatch = (
  value: string,
  index: TldSkeletonIndex,
): boolean => {
  const cached = index.matchCache.get(value);
  if (cached !== undefined) return cached;

  const candidate = indexTldSkeletonPattern(
    createSourcePositionAwareTldPattern(value),
  );
  const targets = new Set<IndexedTldSkeletonPattern>();
  for (const key of createBoundaryKeys(candidate.pattern)) {
    for (const target of index.patternsByBoundary.get(key) ?? []) {
      if (lengthsCanIntersect(candidate, target)) targets.add(target);
    }
  }
  const result = Array.from(targets).some((target) =>
    patternsIntersect(candidate.pattern, target.sourceAwareTargetPattern),
  );

  index.matchCache.set(value, result);
  if (index.matchCache.size > TLD_MATCH_CACHE_LIMIT) {
    const oldest = index.matchCache.keys().next().value;
    if (oldest !== undefined) index.matchCache.delete(oldest);
  }
  return result;
};

const hasIndexedOriginalSourceTldMatch = (
  value: string,
  index: TldSkeletonIndex,
): boolean => {
  const cacheKey = `original\u0000${value}`;
  const cached = index.matchCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const sourcePattern = createOriginalSourceTldPattern(value);
  const candidate = indexTldSkeletonPattern(
    sourcePattern.map((alternatives) =>
      alternatives.map((alternative) => alternative.reading),
    ),
  );
  const targets = new Set<IndexedTldSkeletonPattern>();
  for (const key of createBoundaryKeys(candidate.pattern)) {
    for (const target of index.patternsByBoundary.get(key) ?? []) {
      if (lengthsCanIntersect(candidate, target)) targets.add(target);
    }
  }
  const result = Array.from(targets).some((target) =>
    originalSourcePatternIntersects(
      sourcePattern,
      target.sourceAwareTargetPattern,
    ),
  );

  index.matchCache.set(cacheKey, result);
  if (index.matchCache.size > TLD_MATCH_CACHE_LIMIT) {
    const oldest = index.matchCache.keys().next().value;
    if (oldest !== undefined) index.matchCache.delete(oldest);
  }
  return result;
};

export const hasTldSkeletonMatch = (
  value: string,
  tlds: ReadonlySet<string>,
): boolean => hasIndexedTldSkeletonMatch(value, getTldSkeletonIndex(tlds));

export const hasOriginalSourceTldSkeletonMatch = (
  value: string,
  tlds: ReadonlySet<string>,
): boolean =>
  hasIndexedOriginalSourceTldMatch(value, getTldSkeletonIndex(tlds));

const sourceTldPatternMatchesTarget = (
  source: string,
  target: string,
): boolean =>
  patternsIntersect(
    createSourcePositionAwareTldPattern(source),
    createTldSkeletonPattern(target, false),
  );

export const haveConfusableTldMatch = (left: string, right: string): boolean =>
  sourceTldPatternMatchesTarget(left, right) ||
  sourceTldPatternMatchesTarget(right, left);

// TextMeta stores parallel per-code-point views so later parsers can reason in
// stable code-point offsets while still preserving UTF-16 lengths when masking.
export const createMeta = (source: string): TextMeta => {
  const codePoints = Array.from(source);
  const raw: string[] = new Array(codePoints.length);
  const skeleton: string[] = new Array(codePoints.length);
  const symbol: string[] = new Array(codePoints.length);
  const zeroWidth: boolean[] = new Array(codePoints.length);
  const whitespace: boolean[] = new Array(codePoints.length);
  const alphaNum: boolean[] = new Array(codePoints.length);
  const labelChar: boolean[] = new Array(codePoints.length);
  const separator: boolean[] = new Array(codePoints.length);
  const labelJoinSeparator: boolean[] = new Array(codePoints.length);

  for (let i = 0; i < codePoints.length; i++) {
    const ch = codePoints[i];
    const rawChar = toRawChar(ch);
    const rawChars = Array.from(rawChar);
    const skeletonChar = toSkeleton(rawChar);
    const isDotSymbol =
      rawChars.length > 0 &&
      rawChars.every((normalizedChar) => DOT_CHAR_SET.has(normalizedChar));
    const symbolChar = isDotSymbol ? "." : rawChar === "\\" ? "/" : rawChar;
    const isZeroWidth = ch !== "" && stripZeroWidth(ch) === "";
    const isWhitespace = WHITESPACE_RE.test(ch);
    const isAlphaNum =
      rawChars.length > 0 &&
      rawChars.every((normalizedChar) =>
        LETTER_OR_DIGIT_RE.test(normalizedChar),
      );
    const isLabelChar =
      HOST_LABEL_CHAR_RE.test(ch) ||
      (rawChars.length > 0 &&
        rawChars.every((normalizedChar) =>
          HOST_LABEL_CHAR_RE.test(normalizedChar),
        ));

    raw[i] = rawChar;
    skeleton[i] = skeletonChar;
    symbol[i] = symbolChar;
    zeroWidth[i] = isZeroWidth;
    whitespace[i] = isWhitespace;
    alphaNum[i] = isAlphaNum;
    labelChar[i] = isLabelChar;
    separator[i] = isZeroWidth || !isAlphaNum;
    // Dots and path delimiters terminate labels; other separators may be
    // obfuscation joins inside a label.
    labelJoinSeparator[i] =
      isZeroWidth ||
      (!isLabelChar &&
        symbolChar !== "." &&
        symbolChar !== "/" &&
        symbolChar !== ":" &&
        symbolChar !== "?" &&
        symbolChar !== "#");
  }

  return {
    codePoints,
    raw,
    skeleton,
    symbol,
    zeroWidth,
    whitespace,
    alphaNum,
    labelChar,
    separator,
    labelJoinSeparator,
  };
};

export const skipSeparators = (meta: TextMeta, start: number): number => {
  let pos = start;
  while (pos < meta.codePoints.length && meta.separator[pos]) pos++;
  return pos;
};

export const isTokenDelimiterPadding = (meta: TextMeta, pos: number): boolean =>
  meta.zeroWidth[pos] ||
  meta.whitespace[pos] ||
  UNICODE_MARK_RE.test(meta.codePoints[pos] ?? "");

export const skipTokenSuffixMarks = (
  meta: TextMeta,
  start: number,
): { readonly pos: number; readonly hasWhitespace: boolean } => {
  let pos = start;
  let sawMark = false;
  let hasWhitespace = false;
  let lastMarkEnd = start;
  while (pos < meta.codePoints.length && isTokenDelimiterPadding(meta, pos)) {
    const isMark = UNICODE_MARK_RE.test(meta.codePoints[pos] ?? "");
    sawMark ||= isMark;
    hasWhitespace ||= meta.whitespace[pos];
    if (isMark) lastMarkEnd = pos + 1;
    pos++;
  }
  return sawMark
    ? { pos: lastMarkEnd, hasWhitespace }
    : { pos: start, hasWhitespace: false };
};

export const consumeWord = (
  meta: TextMeta,
  start: number,
  expectedChars: readonly string[],
  mode: "raw" | "skeleton" = "skeleton",
): Match | null => {
  let pos = start;
  let first = -1;
  let last = -1;
  let expectedPos = 0;
  while (expectedPos < expectedChars.length) {
    pos = skipSeparators(meta, pos);
    if (pos >= meta.codePoints.length) return null;
    const actual = mode === "raw" ? meta.raw[pos] : meta.skeleton[pos];
    const actualChars = Array.from(actual);
    if (actualChars.length === 0) return null;
    for (const actualChar of actualChars) {
      if (actualChar !== expectedChars[expectedPos]) return null;
      expectedPos++;
    }
    if (first < 0) first = pos;
    last = pos;
    pos++;
  }
  return first < 0 ? null : { start: first, end: last + 1, pos };
};

export const consumeSymbol = (
  meta: TextMeta,
  start: number,
  expected: string,
): Match | null => {
  let pos = start;
  while (pos < meta.codePoints.length && isTokenDelimiterPadding(meta, pos)) {
    pos++;
  }
  if (pos >= meta.codePoints.length) return null;
  if (meta.symbol[pos] !== expected) return null;
  return { start: pos, end: pos + 1, pos: pos + 1 };
};

export const matchesRawChars = (
  meta: TextMeta,
  start: number,
  expectedChars: readonly string[],
): boolean => {
  if (start + expectedChars.length > meta.codePoints.length) return false;
  for (let i = 0; i < expectedChars.length; i++) {
    if (meta.raw[start + i] !== expectedChars[i]) return false;
  }
  return true;
};
