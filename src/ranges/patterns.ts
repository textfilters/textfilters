import {
  patternMayStartIn,
  type CompiledPattern,
} from "../matchers/compile.js";
import type { LoosePatternCandidate } from "../matchers/loose-candidates.js";
import { nextCodePointEnd } from "../normalization/text.js";

export interface PatternMatch {
  readonly start: number;
  readonly end: number;
  readonly pattern: CompiledPattern;
}

const stickyPatternExpressions = new WeakMap<CompiledPattern, RegExp>();

export function* iteratePatternMatches(
  normalized: string,
  patterns: readonly CompiledPattern[],
): IterableIterator<PatternMatch> {
  for (const pattern of patterns) {
    if (!patternMayStartIn(pattern, normalized)) {
      continue;
    }

    pattern.re.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.re.exec(normalized)) !== null) {
      const end = match.index + match[0].length;

      if (match[0].length === 0) {
        pattern.re.lastIndex = nextCodePointEnd(normalized, match.index);
        continue;
      }

      const nextIndex = pattern.re.lastIndex;
      yield { start: match.index, end, pattern };
      pattern.re.lastIndex = nextIndex;
    }
  }
}

export const forEachPatternMatch = (
  normalized: string,
  patterns: readonly CompiledPattern[],
  visit: (start: number, end: number, pattern: CompiledPattern) => void,
): void => {
  for (const { start, end, pattern } of iteratePatternMatches(
    normalized,
    patterns,
  )) {
    visit(start, end, pattern);
  }
};

export const somePatternMatch = (
  normalized: string,
  patterns: readonly CompiledPattern[],
  visit: (start: number, end: number, pattern: CompiledPattern) => boolean,
): boolean => {
  for (const pattern of patterns) {
    if (!patternMayStartIn(pattern, normalized)) {
      continue;
    }

    pattern.re.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.re.exec(normalized)) !== null) {
      const end = match.index + match[0].length;

      if (match[0].length === 0) {
        pattern.re.lastIndex = nextCodePointEnd(normalized, match.index);
        continue;
      }

      if (visit(match.index, end, pattern)) {
        return true;
      }
    }
  }

  return false;
};

export function* iteratePatternCandidateMatches(
  normalized: string,
  candidates: readonly LoosePatternCandidate[],
): IterableIterator<PatternMatch> {
  for (const candidate of candidates) {
    if (candidate.startPositions === undefined) {
      yield* iteratePatternMatches(normalized, [candidate.pattern]);
      continue;
    }

    const stickyRe = stickyPatternExpression(candidate.pattern);
    let nextAllowedStart = 0;
    for (const start of candidate.startPositions) {
      if (start < nextAllowedStart) continue;

      const match = stickyMatchAt(stickyRe, normalized, start);
      if (match === null || match[0].length === 0) continue;

      const end = start + match[0].length;
      nextAllowedStart = end;
      yield { start, end, pattern: candidate.pattern };
    }
  }
}

export const somePatternCandidateMatch = (
  normalized: string,
  candidates: readonly LoosePatternCandidate[],
  visit: (start: number, end: number, pattern: CompiledPattern) => boolean,
): boolean => {
  for (const { start, end, pattern } of iteratePatternCandidateMatches(
    normalized,
    candidates,
  )) {
    if (visit(start, end, pattern)) return true;
  }

  return false;
};

const stickyPatternExpression = (pattern: CompiledPattern): RegExp => {
  const existing = stickyPatternExpressions.get(pattern);
  if (existing !== undefined) return existing;

  const created = new RegExp(pattern.re.source, "iyu");
  stickyPatternExpressions.set(pattern, created);
  return created;
};

const stickyMatchAt = (
  re: RegExp,
  normalized: string,
  start: number,
): RegExpExecArray | null => {
  re.lastIndex = start;
  const match = re.exec(normalized);
  return match?.index === start ? match : null;
};
