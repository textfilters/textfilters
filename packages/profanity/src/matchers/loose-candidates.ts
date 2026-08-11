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

interface LooseSignatureOutput {
  readonly patternId: number;
  readonly length: number;
}

interface LooseSignatureNode {
  readonly transitions: Map<string, number>;
  failure: number;
  readonly outputs: LooseSignatureOutput[];
}

interface LooseSignatureAutomaton {
  readonly nodes: readonly LooseSignatureNode[];
  readonly characterIds: ReadonlyMap<string, number>;
  readonly transitionTable: Uint16Array | Uint32Array;
  readonly alphabetSize: number;
  readonly transitionCount: number;
  readonly signatureCount: number;
  readonly signatureUtf16Bytes: number;
  readonly maxSignatureLength: number;
}

export interface LooseCandidateIndex {
  readonly patterns: readonly IndexedLoosePattern[];
  readonly fallbackBits: Uint32Array;
  readonly signaturePatternBits: Uint32Array;
  readonly patternsWithSecondCharBits: Uint32Array;
  readonly firstCharMasks: ReadonlyMap<string, FirstCharPatternMasks>;
  readonly secondCharMasks: ReadonlyMap<string, Uint32Array>;
  readonly signatureAutomaton: LooseSignatureAutomaton;
  readonly bitWordCount: number;
}

export interface InputScanFacts {
  readonly looseCandidateBits: Uint32Array;
  readonly looseCandidateStartPositions: readonly number[];
  readonly looseCandidateStartPositionsByPattern: ReadonlyMap<
    number,
    readonly number[]
  >;
}

export interface InputScanFactCollector {
  readonly visit: (normalizedChar: string, sourcePosition: number) => void;
  readonly finish: () => InputScanFacts;
}

export interface LoosePatternCandidate {
  readonly pattern: CompiledPattern;
  readonly startPositions?: readonly number[];
}

export interface LooseCandidateIndexStats {
  readonly patternCount: number;
  readonly candidateIndexedPatternCount: number;
  readonly globalScanFallbackPatternCount: number;
  readonly signatureCount: number;
  readonly automatonNodeCount: number;
  readonly automatonTransitionCount: number;
  readonly automatonOutputCount: number;
  readonly trackedByteLength: number;
}

export type LooseGlobalScanFallbackReason =
  | "missing-safe-leading-signature"
  | "unsupported-signature-length"
  | "adjacent-repeated-signature-character";

export type LooseCandidateIndexDiagnostic =
  | {
      readonly patternId: number;
      readonly ruleId?: string;
      readonly strategy: "candidate-indexed";
    }
  | {
      readonly patternId: number;
      readonly ruleId?: string;
      readonly strategy: "global-scan-fallback";
      readonly reason: LooseGlobalScanFallbackReason;
    };

interface WordGroup {
  char: string;
  readonly positions: number[];
  readonly prefixAllowed: boolean[];
}

const BIT_WORD_SIZE = 32;
const SCAN_PREFIX_LETTER_RE = /\p{L}/u;
const SCAN_DIGIT_RE = /\p{N}/u;

export const buildLooseCandidateIndex = (
  patterns: readonly CompiledPattern[],
): LooseCandidateIndex => {
  const indexedPatterns = patterns.map((pattern, id) => ({ id, pattern }));
  const bitWordCount = Math.ceil(indexedPatterns.length / BIT_WORD_SIZE);
  const fallbackBits = new Uint32Array(bitWordCount);
  const signaturePatternBits = new Uint32Array(bitWordCount);
  const patternsWithSecondCharBits = new Uint32Array(bitWordCount);
  const firstCharMasks = new Map<string, FirstCharPatternMasks>();
  const secondCharMasks = new Map<string, Uint32Array>();
  const signatureAutomaton = createLooseSignatureAutomaton(indexedPatterns);

  for (const indexed of indexedPatterns) {
    const { id, pattern } = indexed;
    if (hasIndexableSignatures(pattern)) {
      setBit(signaturePatternBits, id);
      continue;
    }

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
    signaturePatternBits,
    patternsWithSecondCharBits,
    firstCharMasks,
    secondCharMasks,
    signatureAutomaton,
    bitWordCount,
  };
};

export const createInputScanFactCollector = (
  index: LooseCandidateIndex,
): InputScanFactCollector => {
  const looseCandidateBits = new Uint32Array(index.fallbackBits);
  const pendingSecondCharBits = new Uint32Array(index.bitWordCount);
  const looseCandidateStartPositions: number[] = [];
  const startsByPattern = new Map<number, number[]>();
  const recentWordGroups: WordGroup[] = [];
  let collapsedAutomatonState = 0;
  let previousIsLetter = false;

  const recordSignatureOutputs = (
    state: number,
    wordGroups: readonly WordGroup[],
  ): void => {
    for (const output of index.signatureAutomaton.nodes[state]!.outputs) {
      const starts = candidateStartsForSignature(
        index.patterns[output.patternId]!.pattern,
        wordGroups,
        output.length,
      );
      if (starts.length === 0) continue;

      setBit(looseCandidateBits, output.patternId);
      const existing = startsByPattern.get(output.patternId);
      if (existing === undefined) {
        startsByPattern.set(output.patternId, starts);
      } else {
        existing.push(...starts);
      }
      looseCandidateStartPositions.push(...starts);
    }
  };

  const visit = (char: string, position: number): void => {
    const firstMasks = index.firstCharMasks.get(char);
    const secondMask = index.secondCharMasks.get(char);
    const isLetter = SCAN_PREFIX_LETTER_RE.test(char);
    const isSignatureChar = isLetter;
    const isDigit = !isLetter && SCAN_DIGIT_RE.test(char);
    const isWordChar = isLetter || isDigit;
    const prefixAllowed = position === 0 || !previousIsLetter;
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

    if (isSignatureChar && index.signatureAutomaton.maxSignatureLength > 0) {
      const previousCollapsedChar =
        recentWordGroups[recentWordGroups.length - 1]?.char;
      if (
        previousCollapsedChar !== undefined &&
        sameScanChar(previousCollapsedChar, char)
      ) {
        const group = recentWordGroups[recentWordGroups.length - 1]!;
        group.positions.push(position);
        group.prefixAllowed.push(prefixAllowed);
      } else {
        collapsedAutomatonState = nextAutomatonState(
          index.signatureAutomaton,
          collapsedAutomatonState,
          char,
        );
        if (collapsedAutomatonState === 0) {
          recentWordGroups.length = 0;
          previousIsLetter = isLetter;
          return;
        }

        const group =
          recentWordGroups.length ===
          index.signatureAutomaton.maxSignatureLength
            ? recentWordGroups.shift()!
            : { char, positions: [], prefixAllowed: [] };
        group.char = char;
        group.positions.length = 0;
        group.prefixAllowed.length = 0;
        group.positions.push(position);
        group.prefixAllowed.push(prefixAllowed);
        recentWordGroups.push(group);
        recordSignatureOutputs(collapsedAutomatonState, recentWordGroups);
      }
    }

    previousIsLetter = isLetter;
  };

  return {
    visit,
    finish: () => {
      for (const [patternId, starts] of startsByPattern) {
        startsByPattern.set(patternId, sortedUniqueNumbers(starts));
      }

      return {
        looseCandidateBits,
        looseCandidateStartPositions: sortedUniqueNumbers(
          looseCandidateStartPositions,
        ),
        looseCandidateStartPositionsByPattern: startsByPattern,
      };
    },
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

export const loosePatternCandidates = (
  index: LooseCandidateIndex,
  facts: InputScanFacts,
): LoosePatternCandidate[] => {
  const candidates: LoosePatternCandidate[] = [];

  for (const indexed of index.patterns) {
    if (!hasBit(facts.looseCandidateBits, indexed.id)) continue;

    if (hasBit(index.signaturePatternBits, indexed.id)) {
      const startPositions = facts.looseCandidateStartPositionsByPattern.get(
        indexed.id,
      );
      if (startPositions !== undefined && startPositions.length > 0) {
        candidates.push({ pattern: indexed.pattern, startPositions });
      }
      continue;
    }

    candidates.push({ pattern: indexed.pattern });
  }

  return candidates;
};

export const looseCandidateIndexStats = (
  index: LooseCandidateIndex,
): LooseCandidateIndexStats => {
  const nodes = index.signatureAutomaton.nodes;
  const automatonOutputCount = nodes.reduce(
    (count, node) => count + node.outputs.length,
    0,
  );
  const candidateIndexedPatternCount = index.patterns.filter(({ id }) =>
    hasBit(index.signaturePatternBits, id),
  ).length;
  const bitsetByteLength =
    index.fallbackBits.byteLength +
    index.signaturePatternBits.byteLength +
    index.patternsWithSecondCharBits.byteLength +
    [...index.firstCharMasks.values()].reduce(
      (bytes, masks) =>
        bytes +
        masks.all.byteLength +
        masks.unrestricted.byteLength +
        masks.requiresNonLetterPrefix.byteLength,
      0,
    ) +
    [...index.secondCharMasks.values()].reduce(
      (bytes, bits) => bytes + bits.byteLength,
      0,
    );

  return {
    patternCount: index.patterns.length,
    candidateIndexedPatternCount,
    globalScanFallbackPatternCount:
      index.patterns.length - candidateIndexedPatternCount,
    signatureCount: index.signatureAutomaton.signatureCount,
    automatonNodeCount: nodes.length,
    automatonTransitionCount: index.signatureAutomaton.transitionCount,
    automatonOutputCount,
    trackedByteLength:
      bitsetByteLength +
      index.signatureAutomaton.signatureUtf16Bytes +
      index.signatureAutomaton.transitionTable.byteLength,
  };
};

export const looseCandidateIndexDiagnostics = (
  index: LooseCandidateIndex,
): LooseCandidateIndexDiagnostic[] =>
  index.patterns.map(({ id, pattern }) => {
    const reason = globalScanFallbackReason(pattern);
    const identity = {
      patternId: id,
      ...(pattern.ruleId === undefined ? {} : { ruleId: pattern.ruleId }),
    };

    return reason === undefined
      ? { ...identity, strategy: "candidate-indexed" }
      : { ...identity, strategy: "global-scan-fallback", reason };
  });

const createLooseSignatureAutomaton = (
  patterns: readonly IndexedLoosePattern[],
): LooseSignatureAutomaton => {
  const nodes: LooseSignatureNode[] = [createSignatureNode()];
  let signatureCount = 0;
  let signatureUtf16Bytes = 0;
  let maxSignatureLength = 0;

  for (const { id, pattern } of patterns) {
    if (!hasIndexableSignatures(pattern)) continue;

    for (const signature of pattern.scanSignatures ?? []) {
      const chars = Array.from(signature);
      if (chars.length < 2) continue;

      let nodeIndex = 0;
      for (const char of chars) {
        const scanKey = scanCaseKey(char);
        const node = nodes[nodeIndex]!;
        const existing = node.transitions.get(scanKey);
        if (existing !== undefined) {
          nodeIndex = existing;
          continue;
        }

        nodeIndex = nodes.length;
        node.transitions.set(scanKey, nodeIndex);
        nodes.push(createSignatureNode());
      }

      nodes[nodeIndex]!.outputs.push({
        patternId: id,
        length: chars.length,
      });
      signatureCount++;
      signatureUtf16Bytes += signature.length * Uint16Array.BYTES_PER_ELEMENT;
      maxSignatureLength = Math.max(maxSignatureLength, chars.length);
    }
  }

  const queue: number[] = [];
  for (const child of nodes[0]!.transitions.values()) {
    queue.push(child);
  }

  for (let offset = 0; offset < queue.length; offset += 1) {
    const nodeIndex = queue[offset]!;
    const node = nodes[nodeIndex]!;

    for (const [char, childIndex] of node.transitions) {
      queue.push(childIndex);
      let failure = node.failure;

      while (failure !== 0 && !nodes[failure]!.transitions.has(char)) {
        failure = nodes[failure]!.failure;
      }

      const fallback = nodes[failure]!.transitions.get(char);
      nodes[childIndex]!.failure =
        fallback === undefined || fallback === childIndex ? 0 : fallback;
      nodes[childIndex]!.outputs.push(
        ...nodes[nodes[childIndex]!.failure]!.outputs,
      );
    }
  }

  const characters = [
    ...new Set(nodes.flatMap((node) => [...node.transitions.keys()])),
  ];
  const characterIds = new Map<string, number>();
  characters.forEach((char, id) => {
    characterIds.set(char, id);
    characterIds.set(char.toLowerCase(), id);
    characterIds.set(char.toUpperCase(), id);
  });
  const alphabetSize = characters.length;
  const transitionTable =
    nodes.length <= 0xffff
      ? new Uint16Array(nodes.length * alphabetSize)
      : new Uint32Array(nodes.length * alphabetSize);
  const transitionCount = nodes.reduce(
    (count, node) => count + node.transitions.size,
    0,
  );

  for (const nodeIndex of [0, ...queue]) {
    const node = nodes[nodeIndex]!;
    for (const [charId, char] of characters.entries()) {
      const direct = node.transitions.get(char);
      transitionTable[nodeIndex * alphabetSize + charId] =
        direct ??
        (nodeIndex === 0
          ? 0
          : transitionTable[node.failure * alphabetSize + charId]!);
    }
  }
  for (const node of nodes) node.transitions.clear();

  return {
    nodes,
    characterIds,
    transitionTable,
    alphabetSize,
    transitionCount,
    signatureCount,
    signatureUtf16Bytes,
    maxSignatureLength,
  };
};

const createSignatureNode = (): LooseSignatureNode => ({
  transitions: new Map(),
  failure: 0,
  outputs: [],
});

const nextAutomatonState = (
  automaton: LooseSignatureAutomaton,
  state: number,
  char: string,
): number => {
  const charId =
    automaton.characterIds.get(char) ??
    automaton.characterIds.get(scanCaseKey(char));
  return charId === undefined
    ? 0
    : automaton.transitionTable[state * automaton.alphabetSize + charId]!;
};

const candidateStartsForSignature = (
  pattern: CompiledPattern,
  wordGroups: readonly WordGroup[],
  signatureLength: number,
): number[] => {
  const signatureStart = wordGroups.length - signatureLength;
  if (signatureStart < 0) return [];

  const firstGroup = wordGroups[signatureStart]!;

  const firstChars = pattern.scanFirstChars;
  if (firstChars === undefined) {
    return [firstGroup.positions[0]!];
  }

  if (!firstChars.some((char) => sameScanChar(char, firstGroup.char))) {
    return [];
  }

  const starts: number[] = [];
  for (let index = 0; index < firstGroup.positions.length; index += 1) {
    if (
      pattern.scanFirstCharRequiresNonLetterPrefix !== true ||
      firstGroup.prefixAllowed[index] === true
    ) {
      starts.push(firstGroup.positions[index]!);
    }
  }
  return starts;
};

const sameScanChar = (left: string, right: string): boolean =>
  left === right ||
  left.toLowerCase() === right.toLowerCase() ||
  left.toUpperCase() === right.toUpperCase();

const scanCaseKey = (char: string): string => {
  const lower = char.toLowerCase();
  const upperLower = char.toUpperCase().toLowerCase();

  if (isSingleCodePoint(upperLower)) return upperLower;
  return isSingleCodePoint(lower) ? lower : char;
};

const isSingleCodePoint = (value: string): boolean => {
  const code = value.codePointAt(0);
  return code !== undefined && value.length === (code > 0xffff ? 2 : 1);
};

const globalScanFallbackReason = (
  pattern: CompiledPattern,
): LooseGlobalScanFallbackReason | undefined => {
  const signatures = pattern.scanSignatures;
  if (signatures === undefined || signatures.length === 0) {
    return "missing-safe-leading-signature";
  }

  for (const signature of signatures) {
    const chars = Array.from(signature);
    if (chars.length !== 2 && chars.length !== 3) {
      return "unsupported-signature-length";
    }

    if (
      chars.some(
        (char, index) => index > 0 && sameScanChar(chars[index - 1]!, char),
      )
    ) {
      return "adjacent-repeated-signature-character";
    }
  }

  return undefined;
};

const hasIndexableSignatures = (pattern: CompiledPattern): boolean =>
  globalScanFallbackReason(pattern) === undefined;

const sortedUniqueNumbers = (values: readonly number[]): number[] =>
  [...new Set(values)].sort((left, right) => left - right);

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
