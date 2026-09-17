import {
  DOT_CHAR_SET,
  DOT_LITERALS,
  DOT_WORDS_RAW,
  DOT_WORDS_SKELETON,
  isAsciiLetterOrDigitCode,
  isAsciiWhitespaceCode,
  isSentenceDotSymbol,
  LETTER_OR_DIGIT_RE,
  PATH_START_CHARS,
  WHITESPACE_RE,
} from "./chars.js";
import {
  type UrlFilterOptions,
  type UrlRangeMatchSink,
  type UrlRangeScanner,
  type UrlScanInput,
} from "./contracts.js";
import { normalizeAllowedDomains } from "./allowed-domains.js";
import { createMeta, toSkeletonFromNormalized } from "./meta.js";
import { lowerNfkc, stripZeroWidth } from "./normalize.js";
import { collectRangeMatches, type UrlMatchPolicy } from "./ranges.js";
import { resolveTldLookups, type TldLookups } from "./tlds.js";

const ASCII_ONLY_RE = /^[\x00-\x7f]*$/u;
const VARIATION_SELECTOR_RE = /^[\u{fe00}-\u{fe0f}\u{e0100}-\u{e01ef}]$/u;
const URL_CANDIDATE_MARKERS = [...PATH_START_CHARS, "\\", "[", "]"] as const;

const toCandidateSkeleton = (normalized: string): string =>
  ASCII_ONLY_RE.test(normalized)
    ? normalized
    : toSkeletonFromNormalized(normalized);

const createMatchPolicy = (
  tldLookups: TldLookups,
  allowedDomains: ReadonlySet<string>,
): UrlMatchPolicy => ({
  ...tldLookups,
  allowedDomains,
  ambiguousSpacedDots: "preserve",
});

export function createUrlScanner(
  config: UrlFilterOptions = {},
): UrlRangeScanner {
  const policy = createMatchPolicy(
    resolveTldLookups(config.tlds),
    normalizeAllowedDomains(config.allowedDomains),
  );

  return {
    check(input) {
      return checkUrlRangesWithPolicy(input, policy);
    },
    scan(input, sink) {
      return scanUrlRangeMatchesWithPolicy(input, sink, policy);
    },
  };
}

const checkUrlRangesWithPolicy = (
  input: UrlScanInput,
  policy: UrlMatchPolicy,
): boolean => {
  const meta = createUrlInputMeta(input, policy.ambiguousSpacedDots);
  if (!meta) return false;
  let found = false;
  collectRangeMatches(meta, policy, () => {
    found = true;
    return false;
  });
  return found;
};

const scanUrlRangeMatchesWithPolicy = (
  input: UrlScanInput,
  sink: UrlRangeMatchSink,
  policy: UrlMatchPolicy,
): boolean => {
  const meta = createUrlInputMeta(input, policy.ambiguousSpacedDots);
  if (!meta) return true;
  return collectRangeMatches(meta, policy, (range) =>
    sink({ range }, meta.codePoints),
  );
};

const createUrlInputMeta = (
  input: UrlScanInput,
  ambiguousSpacedDots: UrlMatchPolicy["ambiguousSpacedDots"],
) =>
  hasUrlCandidateInput(input, ambiguousSpacedDots)
    ? createMeta(input.text)
    : null;

function hasUrlCandidateInput(
  input: UrlScanInput,
  ambiguousSpacedDots: UrlMatchPolicy["ambiguousSpacedDots"],
): boolean {
  if (!input.text) return false;
  return hasUrlCandidate(input.text, ambiguousSpacedDots);
}

function hasUrlCandidate(
  source: string,
  ambiguousSpacedDots: UrlMatchPolicy["ambiguousSpacedDots"],
): boolean {
  const isAscii = ASCII_ONLY_RE.test(source);
  const normalized = isAscii
    ? source.toLowerCase()
    : stripZeroWidth(lowerNfkc(source));
  if (
    URL_CANDIDATE_MARKERS.some((marker) => normalized.includes(marker)) ||
    DOT_LITERALS.some((literal) => normalized.includes(literal)) ||
    /\bdot\b/.test(normalized) ||
    /\bd0t\b/.test(normalized) ||
    DOT_WORDS_RAW.some((word) => hasSplitWordCandidate(normalized, word)) ||
    normalized.includes("http") ||
    normalized.includes("hxxp")
  ) {
    return true;
  }
  if (hasLikelyDomainDot(normalized, ambiguousSpacedDots, isAscii)) {
    return true;
  }
  const skeleton = isAscii ? normalized : toCandidateSkeleton(normalized);
  return DOT_WORDS_SKELETON.some((word) =>
    hasSplitWordCandidate(skeleton, word),
  );
}

function hasLikelyDomainDot(
  value: string,
  ambiguousSpacedDots: UrlMatchPolicy["ambiguousSpacedDots"],
  isAscii: boolean,
): boolean {
  let left = -1;
  let pendingDot = false;
  if (isAscii) {
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (isAsciiLetterOrDigitCode(code)) {
        if (pendingDot) return true;
        left = i;
      } else if (
        code === 0x2e &&
        left >= 0 &&
        !(
          ambiguousSpacedDots === "preserve" &&
          left + 1 === i &&
          isAsciiWhitespaceCode(value.charCodeAt(i + 1))
        )
      ) {
        pendingDot = true;
      }
    }
    return false;
  }

  const chars = Array.from(value);
  let lastNonVariationSelector = -1;
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (LETTER_OR_DIGIT_RE.test(char)) {
      if (pendingDot) return true;
      left = i;
    } else if (
      !pendingDot &&
      left >= 0 &&
      DOT_CHAR_SET.has(char) &&
      !(
        ambiguousSpacedDots === "preserve" &&
        isSentenceDotSymbol(char) &&
        lastNonVariationSelector === left &&
        startsWithWhitespaceAfterVariationSelectors(chars, i + 1)
      )
    ) {
      pendingDot = true;
    }
    // Each selector run after a dot is inspected at most once by lookahead.
    // Remember the last non-selector instead of rescanning from the left letter.
    if (!VARIATION_SELECTOR_RE.test(char)) lastNonVariationSelector = i;
  }
  return false;
}

function startsWithWhitespaceAfterVariationSelectors(
  chars: readonly string[],
  start: number,
): boolean {
  let pos = start;
  while (VARIATION_SELECTOR_RE.test(chars[pos] ?? "")) pos++;
  return WHITESPACE_RE.test(chars[pos] ?? "");
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
