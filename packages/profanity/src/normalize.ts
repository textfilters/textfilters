const ZERO_WIDTH_RE = /^[\u200b-\u200f\u2060\ufeff]$/u;
const LETTER_OR_NUMBER_RE = /^[\p{L}\p{N}]$/u;
const WHITESPACE_RE = /^\s$/u;

const graphemeSegmenter = new Intl.Segmenter("und", {
  granularity: "grapheme",
});

export interface NormalizedUnit {
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

export interface NormalizedSource {
  readonly source: string;
  readonly units: readonly NormalizedUnit[];
}

export interface ExactView {
  readonly units: readonly NormalizedUnit[];
  readonly key: string;
}

export interface CompactCharacter extends NormalizedUnit {
  readonly unitIndex: number;
  readonly removedBefore: number;
  readonly hasWhitespaceBefore: boolean;
}

export interface CompactRun {
  readonly value: string;
  readonly count: number;
  readonly start: number;
  readonly end: number;
  readonly unitStart: number;
  readonly unitEnd: number;
  readonly characterStart: number;
  readonly characterEnd: number;
  readonly removedBefore: number;
  readonly removedWithin: number;
}

export interface CompactView {
  readonly characters: readonly CompactCharacter[];
  readonly runs: readonly CompactRun[];
  readonly key: string;
}

export function normalizeSource(source: string): NormalizedSource {
  const normalizedGraphemes: NormalizedUnit[] = [];
  let normalizedText = "";

  for (const segment of graphemeSegmenter.segment(source)) {
    const start = segment.index;
    const end = start + segment.segment.length;
    const normalized = segment.segment.normalize("NFKC");

    if (normalized === segment.segment) {
      normalizedGraphemes.push({ value: normalized, start, end });
      normalizedText += normalized;
      continue;
    }

    for (const normalizedSegment of graphemeSegmenter.segment(normalized)) {
      normalizedGraphemes.push({
        value: normalizedSegment.segment,
        start,
        end,
      });
      normalizedText += normalizedSegment.segment;
    }
  }

  const lowercasedText = normalizedText.toLowerCase();
  const units: NormalizedUnit[] = [];
  let lowercasedOffset = 0;
  let hasUnambiguousMapping = true;

  for (const part of normalizedGraphemes) {
    const contributionEnd = lowercasedOffset + part.value.toLowerCase().length;
    if (contributionEnd > lowercasedText.length) {
      hasUnambiguousMapping = false;
      break;
    }

    while (lowercasedOffset < contributionEnd) {
      const codePoint = lowercasedText.codePointAt(lowercasedOffset);
      if (codePoint === undefined) {
        hasUnambiguousMapping = false;
        break;
      }
      const value = String.fromCodePoint(codePoint);
      if (lowercasedOffset + value.length > contributionEnd) {
        hasUnambiguousMapping = false;
        break;
      }
      if (!ZERO_WIDTH_RE.test(value)) {
        units.push({ value, start: part.start, end: part.end });
      }
      lowercasedOffset += value.length;
    }

    if (!hasUnambiguousMapping) break;
  }

  if (hasUnambiguousMapping && lowercasedOffset === lowercasedText.length) {
    return { source, units };
  }

  units.length = 0;
  for (const part of normalizedGraphemes) {
    for (const value of part.value.toLowerCase()) {
      if (ZERO_WIDTH_RE.test(value)) continue;
      units.push({ value, start: part.start, end: part.end });
    }
  }

  return { source, units };
}

export function applyAliases(
  source: NormalizedSource,
  aliases: ReadonlyMap<string, string>,
): readonly NormalizedUnit[] {
  return source.units.map((unit) => ({
    ...unit,
    value: aliases.get(unit.value) ?? unit.value,
  }));
}

export function createExactView(units: readonly NormalizedUnit[]): ExactView {
  const exact: NormalizedUnit[] = [];

  for (const unit of units) {
    if (!WHITESPACE_RE.test(unit.value)) {
      exact.push(unit);
      continue;
    }

    const previous = exact.at(-1);
    if (previous?.value === " ") {
      exact[exact.length - 1] = { ...previous, end: unit.end };
    } else {
      exact.push({ ...unit, value: " " });
    }
  }

  return {
    units: exact,
    key: exact.map(({ value }) => value).join(""),
  };
}

export function createCompactView(
  units: readonly NormalizedUnit[],
): CompactView {
  const characters: CompactCharacter[] = [];
  let removed = 0;
  let removedWhitespace = false;

  for (const [unitIndex, unit] of units.entries()) {
    if (!isLetterOrNumber(unit.value)) {
      removed++;
      removedWhitespace ||= WHITESPACE_RE.test(unit.value);
      continue;
    }

    characters.push({
      ...unit,
      unitIndex,
      removedBefore: characters.length === 0 ? 0 : removed,
      hasWhitespaceBefore: characters.length === 0 ? false : removedWhitespace,
    });
    removed = 0;
    removedWhitespace = false;
  }

  return {
    characters,
    runs: createRuns(characters),
    key: characters.map(({ value }) => value).join(""),
  };
}

export function normalizeAliasSymbol(value: string): string | undefined {
  const normalized = normalizeSource(value).units;
  if (normalized.length !== 1) return undefined;
  return isLetterOrNumber(normalized[0].value)
    ? normalized[0].value
    : undefined;
}

export function hasWordBoundaryBefore(
  units: readonly NormalizedUnit[],
  unitIndex: number,
): boolean {
  return (
    unitIndex === 0 || !isWordBoundaryCharacter(units[unitIndex - 1].value)
  );
}

export function hasWordBoundaryAfter(
  units: readonly NormalizedUnit[],
  unitIndex: number,
): boolean {
  return (
    unitIndex + 1 >= units.length ||
    !isWordBoundaryCharacter(units[unitIndex + 1].value)
  );
}

export function isLetterOrNumber(value: string): boolean {
  return LETTER_OR_NUMBER_RE.test(value);
}

function isWordBoundaryCharacter(value: string): boolean {
  return LETTER_OR_NUMBER_RE.test(value);
}

function createRuns(
  characters: readonly CompactCharacter[],
): readonly CompactRun[] {
  const runs: CompactRun[] = [];

  for (const [characterIndex, character] of characters.entries()) {
    const previous = runs.at(-1);
    if (previous?.value === character.value) {
      runs[runs.length - 1] = {
        ...previous,
        count: previous.count + 1,
        end: character.end,
        unitEnd: character.unitIndex,
        characterEnd: characterIndex,
        removedWithin: previous.removedWithin + character.removedBefore,
      };
      continue;
    }

    runs.push({
      value: character.value,
      count: 1,
      start: character.start,
      end: character.end,
      unitStart: character.unitIndex,
      unitEnd: character.unitIndex,
      characterStart: characterIndex,
      characterEnd: characterIndex,
      removedBefore: character.removedBefore,
      removedWithin: 0,
    });
  }

  return runs;
}
