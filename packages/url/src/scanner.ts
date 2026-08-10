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
} from "./contracts.js";
import {
  EMPTY_ALLOWED_DOMAINS,
  normalizeAllowedDomains,
} from "./allowed-domains.js";
import { createMeta, toSkeletonFromNormalized } from "./meta.js";
import { collectRangeMatches, collectRanges } from "./ranges.js";
import { DEFAULT_TLDS, normalizeTld, normalizeTlds } from "./tlds.js";

const ASCII_TLD_RE = /^[a-z0-9-]+$/u;
const ASCII_ONLY_RE = /^[\x00-\x7f]*$/u;

const toCandidateSkeleton = (normalized: string): string =>
  ASCII_ONLY_RE.test(normalized)
    ? normalized
    : toSkeletonFromNormalized(normalized);

const createTldSkeletonSet = (tlds: Iterable<string>): ReadonlySet<string> => {
  const skeletons = new Set<string>();
  for (const tld of tlds) {
    if (ASCII_TLD_RE.test(tld)) skeletons.add(tld);
  }
  return skeletons;
};

const createNormalizedTldSet = (
  tlds: Iterable<string>,
): ReadonlySet<string> => {
  const normalized = new Set<string>();
  for (const tld of tlds) {
    const value = normalizeTld(tld);
    if (value) normalized.add(value);
  }
  return normalized;
};

const DEFAULT_TLD_SET: ReadonlySet<string> = new Set(DEFAULT_TLDS);
const DEFAULT_TLD_SKELETON_SET = createTldSkeletonSet(DEFAULT_TLDS);

const resolveTldLookups = (
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string> | undefined,
): {
  readonly tldSet: ReadonlySet<string>;
  readonly tldSkeletonSet: ReadonlySet<string>;
} => {
  if (tldSkeletonSet) return { tldSet, tldSkeletonSet };
  if (tldSet === DEFAULT_TLD_SET) {
    return {
      tldSet: DEFAULT_TLD_SET,
      tldSkeletonSet: DEFAULT_TLD_SKELETON_SET,
    };
  }
  const normalizedTldSet = createNormalizedTldSet(tldSet);
  return {
    tldSet: normalizedTldSet,
    tldSkeletonSet: createTldSkeletonSet(normalizedTldSet),
  };
};

export interface UrlScannerConfig {
  readonly tlds?: readonly string[];
  readonly allowedDomains?: readonly string[];
  readonly ambiguousSpacedDots?: AmbiguousSpacedDotPolicy;
}

export function createUrlScanner(
  config: UrlScannerConfig = {},
): UrlRangeScanner {
  const tlds = normalizeTlds(config.tlds);
  const useDefaults = tlds === DEFAULT_TLDS;
  const tldSet = useDefaults ? DEFAULT_TLD_SET : new Set(tlds);
  const tldSkeletonSet = useDefaults
    ? DEFAULT_TLD_SKELETON_SET
    : createTldSkeletonSet(tlds);
  const allowedDomainSet = normalizeAllowedDomains(config.allowedDomains);
  const ambiguousSpacedDots: AmbiguousSpacedDotPolicy =
    config.ambiguousSpacedDots === "block" ? "block" : "preserve";

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
          ambiguousSpacedDots,
        ),
      };
    }

    return scanUrlRangeMatches(
      input,
      sink,
      tldSet,
      tldSkeletonSet,
      allowedDomainSet,
      ambiguousSpacedDots,
    );
  }

  return {
    name: URL_FILTER_NAME,
    allocationAware: true,
    check(input) {
      return checkUrlRanges(
        input,
        tldSet,
        tldSkeletonSet,
        allowedDomainSet,
        ambiguousSpacedDots,
      );
    },
    scan,
  };
}

export function scanUrlRanges(
  text: unknown,
  tldSet: ReadonlySet<string> = DEFAULT_TLD_SET,
  tldSkeletonSet?: ReadonlySet<string>,
  allowedDomainSet: ReadonlySet<string> = EMPTY_ALLOWED_DOMAINS,
  ambiguousSpacedDots: AmbiguousSpacedDotPolicy = "preserve",
): readonly TextCodePointRange[] {
  const source = String(text ?? "");
  if (!source || !hasUrlCandidate(source)) return [];

  const meta = createMeta(source);
  const lookups = resolveTldLookups(tldSet, tldSkeletonSet);
  return collectRanges(
    meta,
    lookups.tldSet,
    lookups.tldSkeletonSet,
    allowedDomainSet,
    ambiguousSpacedDots,
  );
}

export function checkUrlRanges(
  input: UrlScanInput,
  tldSet: ReadonlySet<string> = DEFAULT_TLD_SET,
  tldSkeletonSet?: ReadonlySet<string>,
  allowedDomainSet: ReadonlySet<string> = EMPTY_ALLOWED_DOMAINS,
  ambiguousSpacedDots: AmbiguousSpacedDotPolicy = "preserve",
): boolean {
  if (!hasUrlCandidateInput(input)) return false;

  const meta = createMeta(input.text);
  const lookups = resolveTldLookups(tldSet, tldSkeletonSet);
  let found = false;
  collectRangeMatches(
    meta,
    lookups.tldSet,
    lookups.tldSkeletonSet,
    allowedDomainSet,
    ambiguousSpacedDots,
    () => {
      found = true;
      return false;
    },
  );
  return found;
}

export function scanUrlRangeMatches(
  input: UrlScanInput,
  sink: UrlRangeMatchSink,
  tldSet: ReadonlySet<string> = DEFAULT_TLD_SET,
  tldSkeletonSet?: ReadonlySet<string>,
  allowedDomainSet: ReadonlySet<string> = EMPTY_ALLOWED_DOMAINS,
  ambiguousSpacedDots: AmbiguousSpacedDotPolicy = "preserve",
): boolean {
  if (!hasUrlCandidateInput(input)) return true;

  const meta = createMeta(input.text);
  const lookups = resolveTldLookups(tldSet, tldSkeletonSet);
  return collectRangeMatches(
    meta,
    lookups.tldSet,
    lookups.tldSkeletonSet,
    allowedDomainSet,
    ambiguousSpacedDots,
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
