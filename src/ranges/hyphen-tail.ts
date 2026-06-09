import type { TextRange } from "@textfilters/core";
import type { StrictPatternSet } from "../matchers/build.js";
import type { CompiledPattern } from "../matchers/compile.js";
import { nextCodePointEnd } from "../normalization/text.js";
import { isWordCharAt, SPLIT_TOKEN_CHAR_RE } from "../token-ranges.js";
import { collectStrictRanges } from "./strict.js";

interface LooseRangePatterns {
  readonly loose: readonly CompiledPattern[];
  readonly strict: StrictPatternSet;
}

interface HyphenSuffixRange {
  readonly emitEnd: number;
  readonly boundaryEnd: number;
}

type LooseTailMatchEnd = (
  normalized: string,
  start: number,
  end: number,
  pattern: CompiledPattern,
  patterns: LooseRangePatterns,
) => number | null;

const HYPHEN_TAIL_SCAN_LOOKAHEAD = 64;
const HYPHEN_TAIL_SCAN_MAX = 512;
const HYPHEN_TAIL_SCAN_WORDS = 3;

export const knownHyphenatedSuffixRange = (
  normalized: string,
  start: number,
  end: number,
  patterns: LooseRangePatterns,
  looseTailMatchEnd: LooseTailMatchEnd,
): HyphenSuffixRange => {
  const prefixEnd = hyphenatedHuinPrefixEnd(normalized, start, end);
  if (prefixEnd === null) return { emitEnd: end, boundaryEnd: end };

  const tailStart = prefixEnd + 1;
  if (normalized[prefixEnd] !== "-" || !isWordCharAt(normalized, tailStart)) {
    return { emitEnd: end, boundaryEnd: end };
  }

  const tailTokenEnd = wordRunEnd(normalized, tailStart);
  const scanEnd = hyphenTailScanEnd(normalized, tailTokenEnd);
  const profaneTailEnd = profanityTailEnd(
    normalized.slice(tailStart, scanEnd),
    tailTokenEnd - tailStart,
    patterns,
    looseTailMatchEnd,
  );

  if (profaneTailEnd !== null) {
    const end = tailStart + profaneTailEnd;
    return { emitEnd: end, boundaryEnd: end };
  }

  return { emitEnd: prefixEnd, boundaryEnd: tailTokenEnd };
};

const profanityTailEnd = (
  normalized: string,
  tailTokenLength: number,
  patterns: LooseRangePatterns,
  looseTailMatchEnd: LooseTailMatchEnd,
): number | null => {
  let profaneEnd: number | null = strictTailEnd(
    normalized,
    tailTokenLength,
    patterns.strict,
  );

  for (const pattern of patterns.loose) {
    const re = new RegExp(pattern.re.source, pattern.re.flags);
    let match: RegExpExecArray | null;

    while ((match = re.exec(normalized)) !== null) {
      const end = match.index + match[0].length;

      if (match[0].length === 0) {
        re.lastIndex = nextCodePointEnd(normalized, match.index);
        continue;
      }

      const tailEnd = looseTailMatchEnd(
        normalized,
        match.index,
        end,
        pattern,
        patterns,
      );
      if (tailEnd !== null && match.index < tailTokenLength) {
        profaneEnd = Math.max(profaneEnd ?? 0, tailTokenLength, tailEnd);
      }
    }
  }

  return profaneEnd;
};

const strictTailEnd = (
  normalized: string,
  tailTokenLength: number,
  patterns: StrictPatternSet,
): number | null => {
  let end =
    strictTailSegmentEnd(normalized, 0, patterns) ??
    strictFirstSplitSegmentEnd(normalized, tailTokenLength, patterns);

  for (let position = 1; position < tailTokenLength; ) {
    if (SPLIT_TOKEN_CHAR_RE.test(normalized[position - 1] ?? "")) {
      const segmentEnd = strictTailSegmentEnd(normalized, position, patterns);
      if (segmentEnd !== null) {
        end = Math.max(end ?? 0, tailTokenLength, segmentEnd);
      }
    }
    position = nextCodePointEnd(normalized, position);
  }

  return end;
};

const strictFirstSplitSegmentEnd = (
  normalized: string,
  tailTokenLength: number,
  patterns: StrictPatternSet,
): number | null => {
  for (let position = 0; position < tailTokenLength; ) {
    const charEnd = nextCodePointEnd(normalized, position);

    if (SPLIT_TOKEN_CHAR_RE.test(normalized.slice(position, charEnd))) {
      return strictTailSegmentEnd(normalized.slice(0, position), 0, patterns);
    }

    position = charEnd;
  }

  return null;
};

const hyphenatedHuinPrefixEnd = (
  normalized: string,
  start: number,
  end: number,
): number | null => {
  const scanEnd = Math.min(normalized.length, Math.max(end, start + 64));
  let compact = "";

  for (let position = start; position < scanEnd; ) {
    const charEnd = nextCodePointEnd(normalized, position);
    const char = normalized.slice(position, charEnd);

    if (char === "-" && isWordCharAt(normalized, charEnd)) {
      if (/^хуйн[а-яё]+$/iu.test(compact)) {
        return position;
      }
      position = charEnd;
      continue;
    }

    if (/[\p{L}\p{N}]/u.test(char)) {
      compact += char;
      if (!/^хуйн?[а-яё]*$/iu.test(compact) && !/^ху?$/iu.test(compact)) {
        break;
      }
    }

    position = charEnd;
  }

  return null;
};

const hyphenTailScanEnd = (
  normalized: string,
  tailTokenEnd: number,
): number => {
  let position = tailTokenEnd;
  let words = 0;
  const maxEnd = Math.min(
    normalized.length,
    tailTokenEnd + HYPHEN_TAIL_SCAN_MAX,
  );

  while (position < maxEnd && words < HYPHEN_TAIL_SCAN_WORDS) {
    while (position < maxEnd && !isWordCharAt(normalized, position)) {
      position = nextCodePointEnd(normalized, position);
    }

    if (position >= maxEnd) break;

    words++;
    while (position < maxEnd && isWordCharAt(normalized, position)) {
      position = nextCodePointEnd(normalized, position);
    }
  }

  return Math.max(
    position,
    Math.min(normalized.length, tailTokenEnd + HYPHEN_TAIL_SCAN_LOOKAHEAD),
  );
};

const strictTailSegmentEnd = (
  normalized: string,
  start: number,
  patterns: StrictPatternSet,
): number | null => {
  const ranges: TextRange[] = [];
  collectStrictRanges(normalized.slice(start), patterns, ranges);

  return ranges.reduce<number | null>(
    (end, range) =>
      range[0] === 0 ? Math.max(end ?? 0, start + range[1]) : end,
    null,
  );
};

const wordRunEnd = (normalized: string, start: number): number => {
  let end = start;
  while (end < normalized.length && isWordCharAt(normalized, end)) {
    end = nextCodePointEnd(normalized, end);
  }
  return end;
};
