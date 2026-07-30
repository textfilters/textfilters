import type { TextRange } from "@textfilters/core";
import type { StrictPatternSet } from "../matchers/build.js";
import {
  patternMayStartBefore,
  type CompiledPattern,
} from "../matchers/compile.js";
import { nextCodePointEnd } from "../normalization/text.js";
import {
  isWordCharAt,
  SPLIT_TOKEN_CHAR_RE,
  wordRunEnd,
  wordStartAtOrAfter,
} from "../token-ranges.js";
import { collectStrictRanges } from "./strict.js";

interface LooseRangePatterns {
  readonly loose: readonly CompiledPattern[];
  readonly strict: StrictPatternSet;
}

interface HyphenSuffixRange {
  readonly emitEnd: number;
  readonly boundaryEnd: number;
}

interface HyphenTailScan {
  readonly prefixEnd: number;
  readonly tailStart: number;
  readonly tailTokenEnd: number;
  readonly scanEnd: number;
}

type LooseTailMatchEnd = (
  normalized: string,
  source: string,
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
  source: string,
  start: number,
  end: number,
  pattern: CompiledPattern,
  patterns: LooseRangePatterns,
  looseTailMatchEnd: LooseTailMatchEnd,
): HyphenSuffixRange => {
  const scan = hyphenTailScan(normalized, start, end, pattern);
  if (scan === null) return { emitEnd: end, boundaryEnd: end };

  const profaneTailEnd = profaneTailEndInScan(
    normalized.slice(scan.tailStart, scan.scanEnd),
    source.slice(scan.tailStart, scan.scanEnd),
    scan.tailTokenEnd - scan.tailStart,
    patterns,
    looseTailMatchEnd,
  );

  if (profaneTailEnd !== null) {
    const end = scan.tailStart + profaneTailEnd;
    return { emitEnd: end, boundaryEnd: Math.max(end, scan.tailTokenEnd) };
  }

  return { emitEnd: scan.prefixEnd, boundaryEnd: scan.tailTokenEnd };
};

const hyphenTailScan = (
  normalized: string,
  start: number,
  end: number,
  pattern: CompiledPattern,
): HyphenTailScan | null => {
  const prefixEnd = hyphenatedRulePrefixEnd(normalized, start, end, pattern);
  if (prefixEnd === null) return null;

  const tailStart = prefixEnd + 1;
  if (normalized[prefixEnd] !== "-" || !isWordCharAt(normalized, tailStart)) {
    return null;
  }

  const tailTokenEnd = wordRunEnd(normalized, tailStart);
  return {
    prefixEnd,
    tailStart,
    tailTokenEnd,
    scanEnd: hyphenTailScanEnd(normalized, tailTokenEnd),
  };
};

const profaneTailEndInScan = (
  normalized: string,
  source: string,
  tailTokenLength: number,
  patterns: LooseRangePatterns,
  looseTailMatchEnd: LooseTailMatchEnd,
): number | null => {
  let profaneEnd: number | null = strictProfaneTailEnd(
    normalized,
    tailTokenLength,
    patterns.strict,
  );

  for (const pattern of patterns.loose) {
    if (!patternMayStartBefore(pattern, normalized, tailTokenLength)) {
      continue;
    }

    const re = clonePatternRegExp(pattern);
    let match: RegExpExecArray | null;

    while ((match = re.exec(normalized)) !== null) {
      const end = match.index + match[0].length;

      if (match[0].length === 0) {
        re.lastIndex = nextCodePointEnd(normalized, match.index);
        continue;
      }

      if (match.index >= tailTokenLength) {
        break;
      }

      const tailEnd = looseTailMatchEnd(
        normalized,
        source,
        match.index,
        end,
        pattern,
        patterns,
      );
      if (tailEnd !== null) {
        profaneEnd = Math.max(profaneEnd ?? 0, tailTokenLength, tailEnd);
      }
    }
  }

  return profaneEnd;
};

const strictProfaneTailEnd = (
  normalized: string,
  tailTokenLength: number,
  patterns: StrictPatternSet,
): number | null => {
  let end =
    strictSegmentEnd(normalized, 0, patterns) ??
    strictFirstSplitPrefixEnd(normalized, tailTokenLength, patterns);

  for (let position = 1; position < tailTokenLength; ) {
    if (SPLIT_TOKEN_CHAR_RE.test(normalized[position - 1] ?? "")) {
      const segmentEnd = strictSegmentEnd(normalized, position, patterns);
      if (segmentEnd !== null) {
        end = Math.max(end ?? 0, tailTokenLength, segmentEnd);
      }
    }
    position = nextCodePointEnd(normalized, position);
  }

  return end;
};

const strictFirstSplitPrefixEnd = (
  normalized: string,
  tailTokenLength: number,
  patterns: StrictPatternSet,
): number | null => {
  for (let position = 0; position < tailTokenLength; ) {
    const charEnd = nextCodePointEnd(normalized, position);

    if (SPLIT_TOKEN_CHAR_RE.test(normalized.slice(position, charEnd))) {
      return strictSegmentEnd(normalized.slice(0, position), 0, patterns);
    }

    position = charEnd;
  }

  return null;
};

const hyphenatedRulePrefixEnd = (
  normalized: string,
  start: number,
  end: number,
  pattern: CompiledPattern,
): number | null => {
  const scanEnd = Math.min(normalized.length, Math.max(end, start + 64));
  let compact = "";

  for (let position = start; position < scanEnd; ) {
    const charEnd = nextCodePointEnd(normalized, position);
    const char = normalized.slice(position, charEnd);

    if (char === "-" && isWordCharAt(normalized, charEnd)) {
      if (patternMatchesFullPrefix(pattern, compact)) {
        return position;
      }
      position = charEnd;
      continue;
    }

    if (/[\p{L}\p{N}]/u.test(char)) {
      compact += char;
      if (!patternCanStartWithPrefix(pattern, compact)) {
        break;
      }
    }

    position = charEnd;
  }

  return null;
};

const patternMatchesFullPrefix = (
  pattern: CompiledPattern,
  compact: string,
): boolean => {
  if (Array.from(compact).length < (pattern.trimHyphenTailMin ?? 1)) {
    return false;
  }

  const re = clonePatternRegExp(pattern);
  const match = re.exec(compact);
  return (
    match !== null && match.index === 0 && match[0].length === compact.length
  );
};

const patternCanStartWithPrefix = (
  pattern: CompiledPattern,
  compact: string,
): boolean => {
  for (let end = nextCodePointEnd(compact, 0); end <= compact.length; ) {
    if (patternMatchesFullPrefix(pattern, compact.slice(0, end))) {
      return true;
    }

    if (end === compact.length) break;
    end = nextCodePointEnd(compact, end);
  }

  return compact.length <= HYPHEN_TAIL_SCAN_LOOKAHEAD;
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
    position = wordStartAtOrAfter(normalized, position, maxEnd);
    if (position >= maxEnd) break;

    words++;
    position = wordRunEnd(normalized, position, maxEnd);
  }

  return Math.max(
    position,
    Math.min(normalized.length, tailTokenEnd + HYPHEN_TAIL_SCAN_LOOKAHEAD),
  );
};

const strictSegmentEnd = (
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

const clonePatternRegExp = (pattern: CompiledPattern): RegExp =>
  new RegExp(pattern.re.source, pattern.re.flags);
