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
  type CodePointRange,
  type UrlFilterOptions,
  type UrlRangeMatchSink,
  type UrlRangeScanner,
  type UrlScanInput,
} from "./contracts.js";
import { normalizeAllowedDomains } from "./allowed-domains.js";
import { createMeta, toSkeletonFromNormalized } from "./meta.js";
import { lowerNfkc, stripZeroWidth } from "./normalize.js";
import {
  collectRangeMatches,
  collectRanges,
  type UrlMatchPolicy,
} from "./ranges.js";
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

  function scan(input: UrlScanInput): { ranges: readonly CodePointRange[] };
  function scan(input: UrlScanInput, sink: UrlRangeMatchSink): boolean;
  function scan(input: UrlScanInput, sink?: UrlRangeMatchSink) {
    if (sink === undefined) {
      return {
        ranges: scanUrlInputRangesWithPolicy(input, policy),
      };
    }

    return scanUrlRangeMatchesWithPolicy(input, sink, policy);
  }

  return {
    check(input) {
      return checkUrlRangesWithPolicy(input, policy);
    },
    scan,
  };
}

const scanUrlInputRangesWithPolicy = (
  input: UrlScanInput,
  policy: UrlMatchPolicy,
): readonly CodePointRange[] => {
  const meta = createUrlInputMeta(input, policy.ambiguousSpacedDots);
  if (!meta) return [];
  return collectRanges(meta, policy);
};

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
  return collectRangeMatches(meta, policy, (range) => sink({ range }));
};

const createUrlInputMeta = (
  input: UrlScanInput,
  ambiguousSpacedDots: UrlMatchPolicy["ambiguousSpacedDots"],
) =>
  hasUrlCandidateInput(input, ambiguousSpacedDots)
    ? createMeta(input.text, input.codePoints)
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
  if (isAscii) {
    for (let i = 1; i < value.length - 1; i++) {
      if (value.charCodeAt(i) !== 0x2e) continue;

      let left = i - 1;
      while (left >= 0 && !isAsciiLetterOrDigitCode(value.charCodeAt(left))) {
        left--;
      }
      if (left < 0) continue;

      let right = i + 1;
      while (
        right < value.length &&
        !isAsciiLetterOrDigitCode(value.charCodeAt(right))
      ) {
        right++;
      }
      if (right >= value.length) continue;

      if (
        ambiguousSpacedDots === "preserve" &&
        left + 1 === i &&
        isAsciiWhitespaceCode(value.charCodeAt(i + 1))
      ) {
        continue;
      }
      return true;
    }
    return false;
  }

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
      ambiguousSpacedDots === "preserve" &&
      isSentenceDotSymbol(chars[i]) &&
      hasOnlyVariationSelectors(chars, left + 1, i) &&
      startsWithWhitespaceAfterVariationSelectors(chars, i + 1)
    ) {
      continue;
    }
    return true;
  }

  return false;
}

function hasOnlyVariationSelectors(
  chars: readonly string[],
  start: number,
  end: number,
): boolean {
  for (let i = start; i < end; i++) {
    if (!VARIATION_SELECTOR_RE.test(chars[i] ?? "")) return false;
  }
  return true;
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
