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
  readonly characterEnd: number;
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
  let characterStart = 0;
  let allowIndex = 0;
  let maximumAllowEnd = -1;

  while (start < runs.length) {
    const candidate = findLongestCandidate(
      units,
      characters,
      runs,
      start,
      characterStart,
      dictionary.deny,
    );

    if (candidate) {
      while (
        allowIndex < allowRanges.length &&
        allowRanges[allowIndex][0] <= candidate.start
      ) {
        maximumAllowEnd = Math.max(maximumAllowEnd, allowRanges[allowIndex][1]);
        allowIndex++;
      }

      if (candidate.end > maximumAllowEnd) {
        if (sink(candidate) === false) return false;
        start = candidate.runEnd;
        characterStart = candidate.characterEnd + 1;
        if (characterStart > runs[start].characterEnd) {
          start++;
          characterStart = runs[start]?.characterStart ?? characters.length;
        }
        continue;
      }
    }

    if (
      runs[start].removedWithin > 0 &&
      characterStart < runs[start].characterEnd
    ) {
      characterStart++;
    } else {
      start++;
      characterStart = runs[start]?.characterStart ?? characters.length;
    }
  }

  return true;
}

function findLongestCandidate(
  units: readonly NormalizedUnit[],
  characters: readonly CompactCharacter[],
  runs: readonly CompactRun[],
  start: number,
  characterStart: number,
  root: DenyTrieNode,
): DenyCandidate | undefined {
  const firstCharacter = characters[characterStart];
  if (!hasWordBoundaryBefore(units, firstCharacter.unitIndex)) return undefined;

  let node = root;
  let skippedSeparators = 0;
  let selected: DenyCandidate | undefined;

  for (let end = start; end < runs.length; end++) {
    const run = runs[end];
    const child = node.children.get(run.value);
    if (!child) break;
    node = child;

    const first = end === start ? characterStart : run.characterStart;
    for (let last = first; last <= run.characterEnd; last++) {
      const character = characters[last];
      if (last !== characterStart) skippedSeparators += character.removedBefore;
      if (skippedSeparators > MAX_SKIPPED_SEPARATORS) return selected;
      if (node.entries.length === 0) continue;
      if (!hasWordBoundaryAfter(units, character.unitIndex)) continue;

      for (const entry of node.entries) {
        if (!hasMinimumRunCounts(entry, runs, start, characterStart, last)) {
          continue;
        }
        if (
          !hasAllowedWhitespace(
            entry,
            characters,
            runs,
            start,
            characterStart,
            last,
          )
        ) {
          continue;
        }

        const candidate = {
          start: firstCharacter.start,
          end: character.end,
          runEnd: end,
          characterEnd: last,
          entry,
        };
        if (!selected || compareCandidates(candidate, selected) < 0) {
          selected = candidate;
        }
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
  characterStart: number,
  characterEnd: number,
): boolean {
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
        groupOffset += matchedRunCount(
          runs[runStart + index],
          characterStart,
          characterEnd,
        );
      }
      const inputCount = matchedRunCount(
        runs[runStart + groupIndex],
        characterStart,
        characterEnd,
      );
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
  characterStart: number,
  characterEnd: number,
): boolean {
  return entry.groups.every(
    ([, minimumCount], index) =>
      matchedRunCount(runs[start + index], characterStart, characterEnd) >=
      minimumCount,
  );
}

function matchedRunCount(
  run: CompactRun,
  characterStart: number,
  characterEnd: number,
): number {
  return (
    Math.min(run.characterEnd, characterEnd) -
    Math.max(run.characterStart, characterStart) +
    1
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
