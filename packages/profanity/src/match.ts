import type { TextRange } from "@textfilters/core";

import type {
  CompiledDenyEntry,
  CompiledDictionary,
  DenyTrieNode,
} from "./compile.js";
import {
  applyAliases,
  createCompactView,
  createExactView,
  hasWordBoundaryAfter,
  hasWordBoundaryBefore,
  type CompactCharacter,
  type CompactRun,
  type ExactView,
  type NormalizedSource,
  type NormalizedUnit,
} from "./normalize.js";

const MAX_SKIPPED_SEPARATORS = 16;

export interface InternalProfanityMatch {
  readonly start: number;
  readonly end: number;
  readonly dictionary: string;
  readonly dictionaryOrder: number;
  readonly term: string;
}

interface DenyCandidate {
  readonly start: number;
  readonly end: number;
  readonly runEnd: number;
  readonly entry: CompiledDenyEntry;
}

export function hasAcceptedDeny(
  source: NormalizedSource,
  dictionary: CompiledDictionary,
): boolean {
  const units = applyAliases(source, dictionary.aliases);
  const allowRanges = findAllowRanges(createExactView(units), dictionary);
  let accepted = false;

  scanAcceptedDeny(units, dictionary, allowRanges, () => {
    accepted = true;
    return false;
  });

  return accepted;
}

export function findDictionaryMatches(
  source: NormalizedSource,
  dictionary: CompiledDictionary,
): readonly InternalProfanityMatch[] {
  const units = applyAliases(source, dictionary.aliases);
  const allowRanges = findAllowRanges(createExactView(units), dictionary);
  const matches: InternalProfanityMatch[] = [];

  scanAcceptedDeny(units, dictionary, allowRanges, (candidate) => {
    matches.push({
      start: candidate.start,
      end: candidate.end,
      dictionary: dictionary.id,
      dictionaryOrder: dictionary.order,
      term: candidate.entry.term,
    });
  });

  return matches;
}

function findAllowRanges(
  view: ExactView,
  dictionary: CompiledDictionary,
): readonly TextRange[] {
  if (dictionary.maxAllowLength === 0) return [];

  const ranges: TextRange[] = [];
  const { units } = view;

  for (let start = 0; start < units.length; start++) {
    let node = dictionary.allow;
    const limit = Math.min(units.length, start + dictionary.maxAllowLength);

    for (let end = start; end < limit; end++) {
      const child = node.children.get(units[end].value);
      if (!child) break;
      node = child;
      if (node.terms.length === 0) continue;
      if (!hasWordBoundaryBefore(units, start)) continue;
      if (!hasWordBoundaryAfter(units, end)) continue;

      ranges.push([units[start].start, units[end].end]);
    }
  }

  return ranges.sort(compareRanges);
}

function scanAcceptedDeny(
  units: readonly NormalizedUnit[],
  dictionary: CompiledDictionary,
  allowRanges: readonly TextRange[],
  sink: (candidate: DenyCandidate) => boolean | void,
): boolean {
  const compact = createCompactView(units);
  const { characters, runs } = compact;
  let start = 0;
  let allowIndex = 0;
  let maximumAllowEnd = -1;

  while (start < runs.length) {
    const candidate = findLongestCandidate(
      units,
      characters,
      runs,
      start,
      dictionary.deny,
    );

    if (!candidate) {
      start++;
      continue;
    }

    while (
      allowIndex < allowRanges.length &&
      allowRanges[allowIndex][0] <= candidate.start
    ) {
      maximumAllowEnd = Math.max(maximumAllowEnd, allowRanges[allowIndex][1]);
      allowIndex++;
    }

    if (candidate.end <= maximumAllowEnd) {
      start++;
      continue;
    }

    if (sink(candidate) === false) return false;
    start = candidate.runEnd + 1;
  }

  return true;
}

function findLongestCandidate(
  units: readonly NormalizedUnit[],
  characters: readonly CompactCharacter[],
  runs: readonly CompactRun[],
  start: number,
  root: DenyTrieNode,
): DenyCandidate | undefined {
  const firstRun = runs[start];
  if (!hasWordBoundaryBefore(units, firstRun.unitStart)) return undefined;

  let node = root;
  let skippedSeparators = 0;
  let selected: DenyCandidate | undefined;

  for (let end = start; end < runs.length; end++) {
    const run = runs[end];
    skippedSeparators +=
      run.removedWithin + (end === start ? 0 : run.removedBefore);
    if (skippedSeparators > MAX_SKIPPED_SEPARATORS) break;

    const child = node.children.get(run.value);
    if (!child) break;
    node = child;
    if (node.entries.length === 0) continue;
    if (!hasWordBoundaryAfter(units, run.unitEnd)) continue;

    for (const entry of node.entries) {
      if (!hasMinimumRunCounts(entry, runs, start)) continue;
      if (!hasAllowedWhitespace(entry, characters, runs, start, end)) continue;

      const candidate = {
        start: firstRun.start,
        end: run.end,
        runEnd: end,
        entry,
      };
      if (!selected || compareCandidates(candidate, selected) < 0) {
        selected = candidate;
      }
    }
  }

  return selected;
}

function hasAllowedWhitespace(
  entry: CompiledDenyEntry,
  characters: readonly CompactCharacter[],
  runs: readonly CompactRun[],
  runStart: number,
  runEnd: number,
): boolean {
  const characterStart = runs[runStart].characterStart;
  const characterEnd = runs[runEnd].characterEnd;
  const whitespaceOffsets: number[] = [];

  for (let index = characterStart + 1; index <= characterEnd; index++) {
    if (characters[index].hasWhitespaceBefore) {
      whitespaceOffsets.push(index - characterStart);
    }
  }

  if (whitespaceOffsets.length === 0) return true;

  const characterCount = characterEnd - characterStart + 1;
  if (whitespaceOffsets.length === characterCount - 1) return true;

  const boundaryRanges = entry.wordBoundaries.map(
    ({ groupIndex, minimumBefore, minimumAfter }) => {
      let groupOffset = 0;
      for (let index = 0; index < groupIndex; index++) {
        groupOffset += runs[runStart + index].count;
      }
      const inputCount = runs[runStart + groupIndex].count;
      return [
        groupOffset + minimumBefore,
        groupOffset + inputCount - minimumAfter,
      ] as const;
    },
  );

  let boundaryIndex = 0;
  for (const whitespaceOffset of whitespaceOffsets) {
    while (
      boundaryIndex < boundaryRanges.length &&
      boundaryRanges[boundaryIndex][1] < whitespaceOffset
    ) {
      boundaryIndex++;
    }

    const boundary = boundaryRanges[boundaryIndex];
    if (!boundary || whitespaceOffset < boundary[0]) return false;
    boundaryIndex++;
  }

  return true;
}

function hasMinimumRunCounts(
  entry: CompiledDenyEntry,
  runs: readonly CompactRun[],
  start: number,
): boolean {
  return entry.groups.every(
    ([, minimumCount], index) => runs[start + index].count >= minimumCount,
  );
}

function compareCandidates(left: DenyCandidate, right: DenyCandidate): number {
  return (
    right.end - left.end ||
    right.entry.minimumLength - left.entry.minimumLength ||
    compareStrings(left.entry.term, right.entry.term)
  );
}

function compareRanges(left: TextRange, right: TextRange): number {
  return left[0] - right[0] || right[1] - left[1];
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
