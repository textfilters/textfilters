import {
  lowerNfkc,
  stripZeroWidth,
  type TextCodePointRange,
} from "@textfilters/core";

import {
  DOT_CHAR_SET,
  DOT_LITERALS,
  DOT_WORDS_RAW,
  DOT_WORDS_SKELETON,
  LETTER_OR_DIGIT_RE,
} from "./chars.js";
import {
  URL_FILTER_NAME,
  type AmbiguousSpacedDotPolicy,
  type UrlRangeMatchSink,
  type UrlRangeScanner,
  type UrlScanInput,
  type UrlScannerConfig,
} from "./contracts.js";
import {
  EMPTY_ALLOWED_DOMAINS,
  normalizeAllowedDomains,
} from "./allowed-domains.js";
import { createMeta, toSkeletonFromNormalized } from "./meta.js";
import {
  collectRangeMatches,
  collectRanges,
  type UrlMatchPolicy,
} from "./ranges.js";
import {
  createTldLookups,
  DEFAULT_TLD_LOOKUPS,
  resolveTldLookups,
  type TldLookups,
} from "./tlds.js";

const ASCII_ONLY_RE = /^[\x00-\x7f]*$/u;

const toCandidateSkeleton = (normalized: string): string =>
  ASCII_ONLY_RE.test(normalized)
    ? normalized
    : toSkeletonFromNormalized(normalized);

const normalizeAmbiguousSpacedDots = (
  value: unknown,
): AmbiguousSpacedDotPolicy => (value === "block" ? "block" : "preserve");

const createMatchPolicy = (
  tldLookups: TldLookups,
  allowedDomains: ReadonlySet<string>,
  ambiguousSpacedDots: unknown,
): UrlMatchPolicy => ({
  ...tldLookups,
  allowedDomains,
  ambiguousSpacedDots: normalizeAmbiguousSpacedDots(ambiguousSpacedDots),
});

const createPositionalMatchPolicy = (
  listedTlds: ReadonlySet<string>,
  asciiTldTargets: ReadonlySet<string> | undefined,
  allowedDomains: ReadonlySet<string>,
  ambiguousSpacedDots: unknown,
): UrlMatchPolicy => {
  // Retain the positional argument for source compatibility, but never let it
  // replace targets derived from the authoritative listed-TLD set.
  void asciiTldTargets;
  return createMatchPolicy(
    createTldLookups(listedTlds),
    allowedDomains,
    ambiguousSpacedDots,
  );
};

export function createUrlScanner(
  config: UrlScannerConfig = {},
): UrlRangeScanner {
  const policy = createMatchPolicy(
    resolveTldLookups(config.tlds),
    normalizeAllowedDomains(config.allowedDomains),
    config.ambiguousSpacedDots,
  );

  function scan(input: UrlScanInput): { ranges: readonly TextCodePointRange[] };
  function scan(input: UrlScanInput, sink: UrlRangeMatchSink): boolean;
  function scan(input: UrlScanInput, sink?: UrlRangeMatchSink) {
    if (sink === undefined) {
      return {
        ranges: scanUrlRangesWithPolicy(input.text, policy),
      };
    }

    return scanUrlRangeMatchesWithPolicy(input, sink, policy);
  }

  return {
    name: URL_FILTER_NAME,
    allocationAware: true,
    check(input) {
      return checkUrlRangesWithPolicy(input, policy);
    },
    scan,
  };
}

export function scanUrlRanges(
  text: unknown,
  listedTlds: ReadonlySet<string> = DEFAULT_TLD_LOOKUPS.listedTlds,
  asciiTldTargets?: ReadonlySet<string>,
  allowedDomains: ReadonlySet<string> = EMPTY_ALLOWED_DOMAINS,
  ambiguousSpacedDots: AmbiguousSpacedDotPolicy = "preserve",
): readonly TextCodePointRange[] {
  return scanUrlRangesWithPolicy(
    text,
    createPositionalMatchPolicy(
      listedTlds,
      asciiTldTargets,
      allowedDomains,
      ambiguousSpacedDots,
    ),
  );
}

const scanUrlRangesWithPolicy = (
  text: unknown,
  policy: UrlMatchPolicy,
): readonly TextCodePointRange[] => {
  const source = String(text ?? "");
  if (!source || !hasUrlCandidate(source)) return [];

  const meta = createMeta(source);
  return collectRanges(meta, policy);
};

export function checkUrlRanges(
  input: UrlScanInput,
  listedTlds: ReadonlySet<string> = DEFAULT_TLD_LOOKUPS.listedTlds,
  asciiTldTargets?: ReadonlySet<string>,
  allowedDomains: ReadonlySet<string> = EMPTY_ALLOWED_DOMAINS,
  ambiguousSpacedDots: AmbiguousSpacedDotPolicy = "preserve",
): boolean {
  return checkUrlRangesWithPolicy(
    input,
    createPositionalMatchPolicy(
      listedTlds,
      asciiTldTargets,
      allowedDomains,
      ambiguousSpacedDots,
    ),
  );
}

const checkUrlRangesWithPolicy = (
  input: UrlScanInput,
  policy: UrlMatchPolicy,
): boolean => {
  if (!hasUrlCandidateInput(input)) return false;

  const meta = createMeta(input.text);
  let found = false;
  collectRangeMatches(meta, policy, () => {
    found = true;
    return false;
  });
  return found;
};

export function scanUrlRangeMatches(
  input: UrlScanInput,
  sink: UrlRangeMatchSink,
  listedTlds: ReadonlySet<string> = DEFAULT_TLD_LOOKUPS.listedTlds,
  asciiTldTargets?: ReadonlySet<string>,
  allowedDomains: ReadonlySet<string> = EMPTY_ALLOWED_DOMAINS,
  ambiguousSpacedDots: AmbiguousSpacedDotPolicy = "preserve",
): boolean {
  return scanUrlRangeMatchesWithPolicy(
    input,
    sink,
    createPositionalMatchPolicy(
      listedTlds,
      asciiTldTargets,
      allowedDomains,
      ambiguousSpacedDots,
    ),
  );
}

const scanUrlRangeMatchesWithPolicy = (
  input: UrlScanInput,
  sink: UrlRangeMatchSink,
  policy: UrlMatchPolicy,
): boolean => {
  if (!hasUrlCandidateInput(input)) return true;

  const meta = createMeta(input.text);
  return collectRangeMatches(meta, policy, (range) => sink({ range }));
};

function hasUrlCandidateInput(input: UrlScanInput): boolean {
  if (!input.text) return false;

  const hints = input.hints;
  if (
    hints !== undefined &&
    hints.hasDot === false &&
    hints.hasSlash === false &&
    hints.hasColon === false &&
    hints.hasNonAscii === false &&
    !hasUrlWordCandidate(input.text)
  ) {
    return false;
  }

  return hasUrlCandidate(input.text);
}

function hasUrlCandidate(source: string): boolean {
  const normalized = stripZeroWidth(lowerNfkc(source));
  const skeleton = toCandidateSkeleton(normalized);
  return (
    hasLikelyDomainDot(normalized) ||
    normalized.includes(":") ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("[") ||
    normalized.includes("]") ||
    DOT_LITERALS.some((literal) => normalized.includes(literal)) ||
    /\bdot\b/.test(normalized) ||
    /\bd0t\b/.test(normalized) ||
    DOT_WORDS_SKELETON.some((word) => hasSplitWordCandidate(skeleton, word)) ||
    DOT_WORDS_RAW.some((word) => hasSplitWordCandidate(normalized, word)) ||
    normalized.includes("http") ||
    normalized.includes("hxxp")
  );
}

function hasUrlWordCandidate(source: string): boolean {
  const normalized = stripZeroWidth(lowerNfkc(source));
  const skeleton = toCandidateSkeleton(normalized);
  return (
    normalized.includes("http") ||
    normalized.includes("hxxp") ||
    DOT_WORDS_SKELETON.some((word) => hasSplitWordCandidate(skeleton, word)) ||
    DOT_WORDS_RAW.some((word) => hasSplitWordCandidate(normalized, word))
  );
}

function hasLikelyDomainDot(value: string): boolean {
  const chars = Array.from(value);
  for (let i = 1; i < chars.length - 1; i++) {
    if (!DOT_CHAR_SET.has(chars[i])) continue;

    let left = i - 1;
    while (left >= 0 && !LETTER_OR_DIGIT_RE.test(chars[left])) left--;
    if (left < 0) continue;

    let right = i + 1;
    while (right < chars.length && !LETTER_OR_DIGIT_RE.test(chars[right])) {
      right++;
    }
    if (right >= chars.length) continue;

    if (
      LETTER_OR_DIGIT_RE.test(chars[left]) &&
      LETTER_OR_DIGIT_RE.test(chars[right])
    ) {
      return true;
    }
  }

  return false;
}

function hasSplitWordCandidate(value: string, word: string): boolean {
  for (let start = 0; start < value.length; start++) {
    if (value[start] !== word[0]) continue;
    if (start > 0 && LETTER_OR_DIGIT_RE.test(value[start - 1])) continue;

    let pos = start + 1;
    let matched = true;
    for (let wordIndex = 1; wordIndex < word.length; wordIndex++) {
      while (pos < value.length && !LETTER_OR_DIGIT_RE.test(value[pos])) {
        pos++;
      }
      if (value[pos] !== word[wordIndex]) {
        matched = false;
        break;
      }
      pos++;
    }

    if (matched && !LETTER_OR_DIGIT_RE.test(value[pos] ?? "")) {
      return true;
    }
  }

  return false;
}
