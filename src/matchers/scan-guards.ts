import { nextCodePointEnd } from "../normalization/text.js";
import { readRuleAtoms } from "./rule-reader.js";
import { splitTopLevelAlternatives } from "./rule-scanner.js";

export interface PatternScanGuards {
  readonly scanFirstChars?: readonly string[];
  readonly scanSecondChars?: readonly string[];
  readonly scanFirstCharRequiresNonLetterPrefix?: boolean;
}

export const scanGuardsForSource = (source: string): PatternScanGuards => ({
  scanFirstChars: firstRequiredChars(source),
  scanSecondChars: secondRequiredChars(source),
  scanFirstCharRequiresNonLetterPrefix:
    source.startsWith(NON_LETTER_PREFIX_ASSERTION) || undefined,
});

export const patternMayStartIn = (
  pattern: PatternScanGuards,
  normalized: string,
): boolean => {
  if (pattern.scanFirstChars === undefined) return true;

  if (
    pattern.scanFirstCharRequiresNonLetterPrefix === true ||
    pattern.scanSecondChars !== undefined
  ) {
    return patternMayStartWhere(pattern, normalized, () => true);
  }

  for (const char of pattern.scanFirstChars) {
    if (normalized.includes(char)) return true;
  }

  return false;
};

export const patternMayStartBefore = (
  pattern: PatternScanGuards,
  normalized: string,
  endOffset: number,
): boolean => {
  if (pattern.scanFirstChars === undefined) return true;

  return patternMayStartWhere(
    pattern,
    normalized,
    (position) => position < endOffset,
  );
};

const patternMayStartWhere = (
  pattern: PatternScanGuards,
  normalized: string,
  canStartAt: (position: number) => boolean,
): boolean => {
  let previous = "";

  for (let position = 0; position < normalized.length; ) {
    const end = nextCodePointEnd(normalized, position);
    const char = normalized.slice(position, end);

    if (
      canStartAt(position) &&
      pattern.scanFirstChars?.includes(char) === true &&
      (pattern.scanFirstCharRequiresNonLetterPrefix !== true ||
        position === 0 ||
        !SCAN_PREFIX_LETTER_RE.test(previous)) &&
      scanSecondCharMayFollow(pattern, normalized, end)
    ) {
      return true;
    }

    previous = char;
    position = end;
  }

  return false;
};

const scanSecondCharMayFollow = (
  pattern: PatternScanGuards,
  normalized: string,
  start: number,
): boolean => {
  if (pattern.scanSecondChars === undefined) return true;

  for (let position = start; position < normalized.length; ) {
    const end = nextCodePointEnd(normalized, position);
    const char = normalized.slice(position, end);

    if (!SCAN_WORD_CHAR_RE.test(char)) {
      position = end;
      continue;
    }

    if (pattern.scanSecondChars.includes(char)) {
      return true;
    }

    if (pattern.scanFirstChars?.includes(char) === true) {
      position = end;
      continue;
    }

    if (SCAN_DIGIT_RE.test(char)) {
      position = end;
      continue;
    }

    return false;
  }

  return false;
};

const firstRequiredChars = (source: string): readonly string[] | undefined => {
  const alternatives = splitTopLevelAlternatives(source);
  if (alternatives.length > 1) {
    const chars = new Set<string>();

    for (const alternative of alternatives) {
      const alternativeChars = firstRequiredChars(alternative);
      if (alternativeChars === undefined) return undefined;
      for (const char of alternativeChars) chars.add(char);
    }

    return chars.size === 0 ? undefined : [...chars];
  }

  const atoms = readRuleAtoms(source);
  const lookaheadChars = leadingLookaheadBackreferenceFirstChars(atoms);

  if (lookaheadChars !== null && lookaheadChars.size > 0) {
    return [...caseInsensitiveChars(lookaheadChars)];
  }

  let atomIndex = 0;

  while (isZeroWidthAssertion(atoms[atomIndex]?.base)) {
    atomIndex++;
  }

  const chars = firstCharsFromAtoms(atoms.slice(atomIndex));
  return chars === null || chars.size === 0
    ? undefined
    : [...caseInsensitiveChars(chars)];
};

const secondRequiredChars = (source: string): readonly string[] | undefined => {
  const [, chars] = leadingRequiredWordCharSets(source, 2) ?? [];
  return chars === undefined || chars.size === 0
    ? undefined
    : [...caseInsensitiveChars(chars)];
};

const NON_LETTER_PREFIX_ASSERTION = String.raw`(?<!\p{L})`;
const SCAN_PREFIX_LETTER_RE = /\p{L}/u;
const SCAN_WORD_CHAR_RE = /[\p{L}\p{N}]/u;
const SCAN_DIGIT_RE = /\p{N}/u;

const leadingLookaheadBackreferenceFirstChars = (
  atoms: ReturnType<typeof readRuleAtoms>,
): Set<string> | null => {
  const [lookahead, backreference] = atoms;
  if (
    lookahead === undefined ||
    backreference === undefined ||
    backreference.source !== String.raw`\1` ||
    !lookahead.base.startsWith("(?=(") ||
    !lookahead.base.endsWith("))")
  ) {
    return null;
  }

  return firstAtomChars(lookahead.base.slice("(?=".length, -1));
};

const firstCharsFromAtoms = (
  atoms: ReturnType<typeof readRuleAtoms>,
): Set<string> | null => {
  const [atom, ...rest] = atoms;
  if (atom === undefined) return null;

  if (isSkippableSeparatorAtom(atom)) {
    return firstCharsFromAtoms(rest);
  }

  if (atom.source === `${atom.base}?`) {
    const optionalChars = firstAtomChars(atom.base);
    const nextChars = firstCharsFromAtoms(rest);
    if (optionalChars === null || nextChars === null) return null;

    return new Set([...optionalChars, ...nextChars]);
  }

  return firstAtomChars(atom.source);
};

const isSkippableSeparatorAtom = ({
  base,
  source,
}: ReturnType<typeof readRuleAtoms>[number]): boolean =>
  source === `${base}*` &&
  (base.startsWith(String.raw`[^\p{L}\p{N}`) || base === "[-._]");

const leadingRequiredWordCharSets = (
  source: string,
  limit: number,
): readonly Set<string>[] | null => {
  const result: Set<string>[] = [];

  for (const atom of readRuleAtoms(source)) {
    if (
      isZeroWidthAssertion(atom.base) ||
      isSkippableSeparatorAtom(atom) ||
      isRequiredWordSeparatorAtom(atom) ||
      isSkippableRepeatedWordAtom(atom)
    ) {
      continue;
    }

    if (atom.source !== atom.base) return null;

    const chars = wordCharSetsFromAtom(atom.base, limit - result.length);
    if (chars === null || chars.length === 0) return null;

    result.push(...chars);
    if (result.length >= limit) {
      return result.slice(0, limit);
    }
  }

  return result.length === 0 ? null : result;
};

const wordCharSetsFromAtom = (
  source: string,
  limit: number,
): readonly Set<string>[] | null => {
  const chars = firstAtomChars(source);
  if (chars === null) return null;

  if (isPlainCapturingGroup(source) || source.startsWith("(?:")) {
    const bodyStart = source.startsWith("(?:") ? 3 : 1;
    return groupedLeadingWordCharSets(source.slice(bodyStart, -1), limit);
  }

  return [chars];
};

const groupedLeadingWordCharSets = (
  source: string,
  limit: number,
): readonly Set<string>[] | null => {
  const alternatives = splitTopLevelAlternatives(source).map((alternative) =>
    leadingRequiredWordCharSets(alternative, limit),
  );

  if (alternatives.some((sets) => sets === null || sets.length < limit)) {
    return null;
  }

  const result: Set<string>[] = Array.from(
    { length: limit },
    () => new Set<string>(),
  );

  for (const sets of alternatives) {
    for (let index = 0; index < limit; index++) {
      for (const char of sets![index]!) {
        result[index]!.add(char);
      }
    }
  }

  return result;
};

const isRequiredWordSeparatorAtom = ({
  base,
  source,
}: ReturnType<typeof readRuleAtoms>[number]): boolean =>
  (source === `${base}+` || source === `${base}*`) &&
  (base.startsWith("[^") || base === "[-._]");

const isSkippableRepeatedWordAtom = ({
  base,
  source,
}: ReturnType<typeof readRuleAtoms>[number]): boolean =>
  source === `${base}*` && base.startsWith(String.raw`(?:[^\p{L}\p{N}]*`);

const firstAtomChars = (source: string | undefined): Set<string> | null => {
  if (source === undefined || source.length === 0) return null;

  const [atom] = readRuleAtoms(source);
  if (atom === undefined || atom.source !== atom.base) return null;

  if (atom.base.startsWith("[") && atom.base.endsWith("]")) {
    return simpleClassChars(atom.base);
  }

  if (isPlainCapturingGroup(atom.base) || atom.base.startsWith("(?:")) {
    const bodyStart = atom.base.startsWith("(?:") ? 3 : 1;
    return alternativeFirstChars(atom.base.slice(bodyStart, -1));
  }

  if (atom.base.startsWith("(") || atom.base.startsWith("\\")) return null;
  return /^[\p{L}\p{N}]$/u.test(atom.base) ? new Set([atom.base]) : null;
};

const alternativeFirstChars = (source: string): Set<string> | null => {
  const result = new Set<string>();

  for (const alternative of splitTopLevelAlternatives(source)) {
    const chars = firstRequiredChars(alternative);
    if (chars === undefined) return null;

    for (const char of chars) {
      result.add(char);
    }
  }

  return result;
};

const simpleClassChars = (source: string): Set<string> | null => {
  const body = source.slice(1, -1);
  if (body.startsWith("^") || body.includes("-") || body.includes("\\")) {
    return null;
  }

  return new Set(Array.from(body));
};

const caseInsensitiveChars = (chars: Iterable<string>): Set<string> => {
  const result = new Set<string>();

  for (const char of chars) {
    result.add(char);
    result.add(char.toLowerCase());
    result.add(char.toUpperCase());
  }

  return result;
};

const isZeroWidthAssertion = (source: string | undefined): boolean =>
  source !== undefined && /^\(\?<?[!=]/u.test(source);

const isPlainCapturingGroup = (source: string): boolean =>
  source.startsWith("(") && !source.startsWith("(?");
