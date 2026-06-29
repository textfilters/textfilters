import {
  patternMayStartIn,
  type CompiledPattern,
} from "../matchers/compile.js";
import { nextCodePointEnd } from "../normalization/text.js";

export interface PatternMatch {
  readonly start: number;
  readonly end: number;
  readonly pattern: CompiledPattern;
}

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
