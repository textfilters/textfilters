import { nextCodePointEnd } from "../normalization/text.js";
import type { CompiledPattern } from "./compile.js";

export interface IndexedLoosePattern {
  readonly id: number;
  readonly pattern: CompiledPattern;
}

interface FirstCharPatternMasks {
  readonly all: Uint32Array;
  readonly unrestricted: Uint32Array;
  readonly requiresNonLetterPrefix: Uint32Array;
}

export interface LooseCandidateIndex {
  readonly patterns: readonly IndexedLoosePattern[];
  readonly fallbackBits: Uint32Array;
  readonly patternsWithSecondCharBits: Uint32Array;
  readonly firstCharMasks: ReadonlyMap<string, FirstCharPatternMasks>;
  readonly secondCharMasks: ReadonlyMap<string, Uint32Array>;
  readonly bitWordCount: number;
}

export interface InputScanFacts {
  readonly looseCandidateBits: Uint32Array;
  readonly looseCandidateStartPositions: readonly number[];
}

export interface InputScanFactCollector {
  readonly visit: (normalizedChar: string, sourcePosition: number) => void;
  readonly finish: () => InputScanFacts;
}

const BIT_WORD_SIZE = 32;
const SCAN_PREFIX_LETTER_RE = /\p{L}/u;
const SCAN_WORD_CHAR_RE = /[\p{L}\p{N}]/u;
const SCAN_DIGIT_RE = /\p{N}/u;

export const buildLooseCandidateIndex = (
  patterns: readonly CompiledPattern[],
): LooseCandidateIndex => {
  const indexedPatterns = patterns.map((pattern, id) => ({ id, pattern }));
  const bitWordCount = Math.ceil(indexedPatterns.length / BIT_WORD_SIZE);
  const fallbackBits = new Uint32Array(bitWordCount);
  const patternsWithSecondCharBits = new Uint32Array(bitWordCount);
  const firstCharMasks = new Map<string, FirstCharPatternMasks>();
  const secondCharMasks = new Map<string, Uint32Array>();

  for (const indexed of indexedPatterns) {
    const { id, pattern } = indexed;
    if (pattern.scanFirstChars === undefined) {
      setBit(fallbackBits, id);
      continue;
    }

    if (pattern.scanSecondChars !== undefined) {
      setBit(patternsWithSecondCharBits, id);
      for (const char of new Set(pattern.scanSecondChars)) {
        setBit(maskForChar(secondCharMasks, char, bitWordCount), id);
      }
    }

    for (const char of new Set(pattern.scanFirstChars)) {
      const masks = firstMasksForChar(firstCharMasks, char, bitWordCount);
      setBit(masks.all, id);
      setBit(
        pattern.scanFirstCharRequiresNonLetterPrefix === true
          ? masks.requiresNonLetterPrefix
          : masks.unrestricted,
        id,
      );
    }
  }

  return {
    patterns: indexedPatterns,
    fallbackBits,
    patternsWithSecondCharBits,
    firstCharMasks,
    secondCharMasks,
    bitWordCount,
  };
};

export const createInputScanFactCollector = (
  index: LooseCandidateIndex,
): InputScanFactCollector => {
  const looseCandidateBits = new Uint32Array(index.fallbackBits);
  const pendingSecondCharBits = new Uint32Array(index.bitWordCount);
  const looseCandidateStartPositions: number[] = [];
  let previous = "";

  const visit = (char: string, position: number): void => {
    const firstMasks = index.firstCharMasks.get(char);
    const secondMask = index.secondCharMasks.get(char);
    const isWordChar = SCAN_WORD_CHAR_RE.test(char);
    const isDigit = SCAN_DIGIT_RE.test(char);
    const prefixAllowed =
      position === 0 || !SCAN_PREFIX_LETTER_RE.test(previous);
    let hasPossibleStart = false;

    for (let word = 0; word < index.bitWordCount; word += 1) {
      let candidates = looseCandidateBits[word] ?? 0;
      let pending = pendingSecondCharBits[word] ?? 0;

      if (isWordChar) {
        const matched = pending & (secondMask?.[word] ?? 0);
        candidates |= matched;
        pending &= ~matched;

        if (!isDigit) {
          pending &= firstMasks?.all[word] ?? 0;
        }
      }

      const possibleStarts =
        (firstMasks?.unrestricted[word] ?? 0) |
        (prefixAllowed ? (firstMasks?.requiresNonLetterPrefix[word] ?? 0) : 0);
      hasPossibleStart ||= possibleStarts !== 0;

      const newStarts = possibleStarts & ~candidates;
      candidates |= newStarts & ~index.patternsWithSecondCharBits[word]!;
      pending |= newStarts & index.patternsWithSecondCharBits[word]!;
      pending &= ~candidates;

      looseCandidateBits[word] = candidates;
      pendingSecondCharBits[word] = pending;
    }

    if (hasPossibleStart) {
      looseCandidateStartPositions.push(position);
    }

    previous = char;
  };

  return {
    visit,
    finish: () => ({ looseCandidateBits, looseCandidateStartPositions }),
  };
};

export const collectInputScanFacts = (
  normalized: string,
  index: LooseCandidateIndex,
): InputScanFacts => {
  const collector = createInputScanFactCollector(index);

  for (let position = 0; position < normalized.length; ) {
    const end = nextCodePointEnd(normalized, position);
    collector.visit(normalized.slice(position, end), position);
    position = end;
  }

  return collector.finish();
};

export const looseCandidatePatterns = (
  index: LooseCandidateIndex,
  facts: InputScanFacts,
): CompiledPattern[] => {
  const patterns: CompiledPattern[] = [];

  for (const indexed of index.patterns) {
    if (hasBit(facts.looseCandidateBits, indexed.id)) {
      patterns.push(indexed.pattern);
    }
  }

  return patterns;
};

const firstMasksForChar = (
  masks: Map<string, FirstCharPatternMasks>,
  char: string,
  bitWordCount: number,
): FirstCharPatternMasks => {
  const existing = masks.get(char);
  if (existing !== undefined) return existing;

  const created = {
    all: new Uint32Array(bitWordCount),
    unrestricted: new Uint32Array(bitWordCount),
    requiresNonLetterPrefix: new Uint32Array(bitWordCount),
  };
  masks.set(char, created);
  return created;
};

const maskForChar = (
  masks: Map<string, Uint32Array>,
  char: string,
  bitWordCount: number,
): Uint32Array => {
  const existing = masks.get(char);
  if (existing !== undefined) return existing;

  const created = new Uint32Array(bitWordCount);
  masks.set(char, created);
  return created;
};

const setBit = (bits: Uint32Array, id: number): void => {
  const word = id >>> 5;
  bits[word] = (bits[word] ?? 0) | (1 << (id & 31));
};

const hasBit = (bits: Uint32Array, id: number): boolean =>
  ((bits[id >>> 5] ?? 0) & (1 << (id & 31))) !== 0;
