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
  type UrlRangeMatchSink,
  type UrlRangeScanner,
  type UrlScanInput,
} from "./contracts.js";
import {
  EMPTY_ALLOWED_DOMAINS,
  normalizeAllowedDomains,
} from "./allowed-domains.js";
import { createMeta, prepareTldSkeletonIndex, toSkeleton } from "./meta.js";
import { collectRangeMatches, collectRanges } from "./ranges.js";
import { DEFAULT_TLDS, DEFAULT_TLD_SET, normalizeTlds } from "./tlds.js";
const DEFAULT_TLD_SKELETON_SET: ReadonlySet<string> = new Set(
  DEFAULT_TLDS.map((tld) => toSkeleton(tld)),
);
const COMBINING_MARK_RE = /\p{M}/u;

const createPrefilterViews = (
  source: string,
): { readonly normalized: string; readonly skeleton: string } => {
  const normalized = stripZeroWidth(lowerNfkc(source));
  if (!COMBINING_MARK_RE.test(source)) {
    return { normalized, skeleton: toSkeleton(normalized) };
  }

  // Whole-string normalization can compose an inserted mark with the previous
  // token letter. Preserve original code-point boundaries so the full parser
  // can treat marks as skippable scheme and dot-word separators.
  return {
    normalized: Array.from(source, (char) =>
      stripZeroWidth(lowerNfkc(char)),
    ).join(""),
    skeleton: Array.from(source, (char) =>
      toSkeleton(stripZeroWidth(char)),
    ).join(""),
  };
};

const createTldSkeletonSet = (tlds: Iterable<string>): ReadonlySet<string> =>
  new Set(Array.from(tlds, (tld) => toSkeleton(tld)));

export interface UrlScannerConfig {
  readonly tlds?: readonly string[];
  readonly allowedDomains?: readonly string[];
}

export function createUrlScanner(
  config: UrlScannerConfig = {},
): UrlRangeScanner {
  const customTlds = normalizeTlds(config.tlds);
  const hasCustomTlds = customTlds.length > 0;
  const tlds = hasCustomTlds ? customTlds : DEFAULT_TLDS;
  const tldSet: ReadonlySet<string> = hasCustomTlds
    ? new Set(tlds)
    : DEFAULT_TLD_SET;
  const tldSkeletonSet = hasCustomTlds
    ? createTldSkeletonSet(tlds)
    : DEFAULT_TLD_SKELETON_SET;
  const allowedDomainSet = normalizeAllowedDomains(config.allowedDomains);

  function scan(input: UrlScanInput): { ranges: readonly TextCodePointRange[] };
  function scan(input: UrlScanInput, sink: UrlRangeMatchSink): boolean;
  function scan(input: UrlScanInput, sink?: UrlRangeMatchSink) {
    if (sink === undefined) {
      return {
        ranges: scanUrlRanges(
          input.text,
          tldSet,
          tldSkeletonSet,
          allowedDomainSet,
        ),
      };
    }

    return scanUrlRangeMatches(
      input,
      sink,
      tldSet,
      tldSkeletonSet,
      allowedDomainSet,
    );
  }

  return {
    name: URL_FILTER_NAME,
    allocationAware: true,
    check(input) {
      return checkUrlRanges(input, tldSet, tldSkeletonSet, allowedDomainSet);
    },
    scan,
  };
}

export function scanUrlRanges(
  text: unknown,
  tldSet: ReadonlySet<string> = DEFAULT_TLD_SET,
  tldSkeletonSet: ReadonlySet<string> = tldSet === DEFAULT_TLD_SET
    ? DEFAULT_TLD_SKELETON_SET
    : createTldSkeletonSet(tldSet),
  allowedDomainSet: ReadonlySet<string> = EMPTY_ALLOWED_DOMAINS,
): readonly TextCodePointRange[] {
  const source = String(text ?? "");
  if (!source || !hasUrlCandidate(source)) return [];

  prepareTldSkeletonIndex(tldSet);
  const meta = createMeta(source);
  return collectRanges(meta, tldSet, tldSkeletonSet, allowedDomainSet);
}

export function checkUrlRanges(
  input: UrlScanInput,
  tldSet: ReadonlySet<string> = DEFAULT_TLD_SET,
  tldSkeletonSet: ReadonlySet<string> = tldSet === DEFAULT_TLD_SET
    ? DEFAULT_TLD_SKELETON_SET
    : createTldSkeletonSet(tldSet),
  allowedDomainSet: ReadonlySet<string> = EMPTY_ALLOWED_DOMAINS,
): boolean {
  if (!hasUrlCandidateInput(input)) return false;

  prepareTldSkeletonIndex(tldSet);
  const meta = createMeta(input.text);
  let found = false;
  collectRangeMatches(meta, tldSet, tldSkeletonSet, allowedDomainSet, () => {
    found = true;
    return false;
  });
  return found;
}

export function scanUrlRangeMatches(
  input: UrlScanInput,
  sink: UrlRangeMatchSink,
  tldSet: ReadonlySet<string> = DEFAULT_TLD_SET,
  tldSkeletonSet: ReadonlySet<string> = tldSet === DEFAULT_TLD_SET
    ? DEFAULT_TLD_SKELETON_SET
    : createTldSkeletonSet(tldSet),
  allowedDomainSet: ReadonlySet<string> = EMPTY_ALLOWED_DOMAINS,
): boolean {
  if (!hasUrlCandidateInput(input)) return true;

  prepareTldSkeletonIndex(tldSet);
  const meta = createMeta(input.text);
  return collectRangeMatches(
    meta,
    tldSet,
    tldSkeletonSet,
    allowedDomainSet,
    (range) => sink({ range }),
  );
}

function hasUrlCandidateInput(input: UrlScanInput): boolean {
  if (!input.text) return false;

  const hints = input.hints;
  if (
    hints !== undefined &&
    hints.hasDot === false &&
    hints.hasSlash === false &&
    hints.hasColon === false &&
    hints.hasNonAscii === false &&
    !hasUrlWordCandidate(input.text) &&
    !hasLikelyDomainDot(input.text)
  ) {
    return false;
  }

  return hasUrlCandidate(input.text);
}

function hasUrlCandidate(source: string): boolean {
  const { normalized, skeleton } = createPrefilterViews(source);
  return (
    hasLikelyDomainDot(source) ||
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
  const { normalized, skeleton } = createPrefilterViews(source);
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
