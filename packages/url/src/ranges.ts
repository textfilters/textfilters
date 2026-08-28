import { isAllowedDomain } from "./allowed-domains.js";
import { COMBINING_MARK_RE } from "./chars.js";
import {
  isIgnorableFormatting,
  isWhitespaceWrappedListSeparator,
  parseDot,
} from "./dots.js";
import {
  hasAmbiguousRightSpacedSuffix,
  parseBareDomainCandidates,
  parseDomain,
} from "./domain.js";
import { parseExplicitUrlTarget } from "./explicit-authority.js";
import {
  countCodePoints,
  MAX_HOST_LABEL_CODE_POINTS,
  type CodePointRange,
  type DomainMatch,
  type TextMeta,
} from "./meta.js";
import { parseSchemePrefix } from "./scheme.js";
import type { TldLookups } from "./tlds.js";

export type UrlRangeSink = (range: CodePointRange) => boolean | void;

type AmbiguousSpacedDotPolicy = "preserve" | "block";

export interface UrlMatchPolicy extends TldLookups {
  readonly allowedDomains: ReadonlySet<string>;
  readonly ambiguousSpacedDots: AmbiguousSpacedDotPolicy;
}

// Formatting and combining marks continue the preceding label. Skipping over
// them prevents a rejected long label from restarting at an internal suffix.
const hasBareStartBoundary = (
  meta: TextMeta,
  start: number,
  ranges: readonly CodePointRange[],
): boolean => {
  if (start === 0) return true;
  let cursor = start - 1;
  while (
    cursor >= 0 &&
    (isIgnorableFormatting(meta, cursor) ||
      COMBINING_MARK_RE.test(meta.codePoints[cursor] ?? ""))
  ) {
    cursor--;
  }
  return (
    cursor < 0 ||
    !meta.alphaNum[cursor] ||
    ranges.some((range) => range[1] === start)
  );
};

const hasBareBoundary = (
  meta: TextMeta,
  start: number,
  end: number,
  ranges: readonly CodePointRange[],
): boolean => {
  if (!hasBareStartBoundary(meta, start, ranges)) return false;
  return end >= meta.codePoints.length || !meta.alphaNum[end];
};

// Scheme candidates are cheap to reject; use this guard before trying the more
// expensive explicit URL parser at every position.
const canStartScheme = (meta: TextMeta, start: number): boolean =>
  meta.skeleton[start] === "h";

const hasExplicitBoundary = (
  meta: TextMeta,
  start: number,
  end: number,
  resume: number,
): boolean => {
  if (start > 0 && meta.alphaNum[start - 1]) return false;
  return end >= meta.codePoints.length || !meta.alphaNum[end] || resume >= end;
};

const maybeExpandBareSplitPrefix = (
  meta: TextMeta,
  domain: DomainMatch,
  consumedRanges: readonly CodePointRange[],
): number => {
  let gapStart = domain.start;
  while (
    gapStart > 0 &&
    (meta.zeroWidth[gapStart - 1] || meta.whitespace[gapStart - 1])
  ) {
    gapStart--;
  }
  if (gapStart === domain.start || !meta.whitespace[gapStart]) {
    return domain.start;
  }

  let prefixStart = gapStart;
  while (prefixStart > 0 && meta.alphaNum[prefixStart - 1]) prefixStart--;
  const prefixLength = gapStart - prefixStart;
  if (prefixLength === 0) return domain.start;

  const firstDot = parseDot(meta, domain.labels[0]?.pos ?? domain.start);
  const hasDefangedFirstDot =
    firstDot !== null && firstDot.end > firstDot.start + 1;
  const firstLabelLength = countCodePoints(domain.labels[0]?.raw ?? "");
  const hasSplitLabelEvidence =
    (prefixLength === 3 && firstLabelLength >= 3 && firstLabelLength <= 4) ||
    (prefixLength <= 3 &&
      hasDefangedFirstDot &&
      firstLabelLength >= 3 &&
      firstLabelLength <= 5);
  // Only expand a preceding word when it looks like a deliberately split first
  // host label; otherwise normal prose before a URL would be masked.
  if (!hasSplitLabelEvidence) return domain.start;
  if (prefixLength + firstLabelLength > MAX_HOST_LABEL_CODE_POINTS) {
    return domain.start;
  }
  if (
    consumedRanges.some(
      ([rangeStart, rangeEnd]) =>
        prefixStart < rangeEnd && domain.start > rangeStart,
    )
  ) {
    return domain.start;
  }

  return prefixStart;
};

const isPlainLabel = (
  meta: TextMeta,
  label: DomainMatch["labels"][number],
): boolean => {
  let hasLetterOrDigit = false;
  for (let cursor = label.start; cursor < label.end; cursor++) {
    if (meta.alphaNum[cursor]) {
      hasLetterOrDigit = true;
      continue;
    }
    if (
      meta.raw[cursor] !== "-" &&
      (!hasLetterOrDigit ||
        !COMBINING_MARK_RE.test(meta.codePoints[cursor] ?? ""))
    ) {
      return false;
    }
  }
  return true;
};

const isListSpacing = (meta: TextMeta, start: number, end: number): boolean => {
  for (let cursor = start; cursor < end; cursor++) {
    if (!meta.whitespace[cursor] && !isIgnorableFormatting(meta, cursor)) {
      return false;
    }
  }
  return true;
};

const isStandaloneRepeatedListProse = (
  meta: TextMeta,
  domain: DomainMatch,
): boolean => {
  if (domain.labels.length !== 2) return false;
  const [previous, next] = domain.labels;
  if (!previous || !next) return false;
  if (!isPlainLabel(meta, previous) || !isPlainLabel(meta, next)) return false;
  let repeatedTokenEnd = next.end;
  if (previous.raw !== next.raw) {
    if (!previous.raw.startsWith(next.raw)) return false;
    const tail = Array.from(previous.raw.slice(next.raw.length));
    for (const expected of tail) {
      if (meta.raw[repeatedTokenEnd] !== expected) return false;
      repeatedTokenEnd++;
    }
  }
  const dot = parseDot(meta, previous.pos);
  if (
    !dot ||
    !isWhitespaceWrappedListSeparator(meta, dot) ||
    !isListSpacing(meta, previous.end, dot.start) ||
    !isListSpacing(meta, dot.end, next.start)
  ) {
    return false;
  }
  if (domain.end !== next.end) return false;
  let afterNext = repeatedTokenEnd;
  while (isIgnorableFormatting(meta, afterNext)) afterNext++;
  if (
    meta.alphaNum[afterNext] ||
    meta.raw[afterNext] === "-" ||
    meta.raw[afterNext] === "_"
  ) {
    return false;
  }

  return true;
};

const shouldPreserveBareDomainAsProse = (
  meta: TextMeta,
  domain: DomainMatch,
  ambiguousSpacedDots: AmbiguousSpacedDotPolicy,
): boolean =>
  isStandaloneRepeatedListProse(meta, domain) ||
  (ambiguousSpacedDots === "preserve" &&
    hasAmbiguousRightSpacedSuffix(meta, domain));

const parseGluedBareDomain = (
  meta: TextMeta,
  start: number,
  listedTlds: ReadonlySet<string>,
  asciiTldTargets: ReadonlySet<string>,
): DomainMatch | null => {
  let cursor = start;
  let hasSeparator = false;
  while (
    cursor < meta.codePoints.length &&
    meta.labelJoinSeparator[cursor] &&
    !meta.whitespace[cursor]
  ) {
    hasSeparator = true;
    cursor++;
  }
  if (!hasSeparator || !meta.alphaNum[cursor]) return null;
  return parseDomain(meta, cursor, listedTlds, asciiTldTargets);
};

interface BareDomainCandidate {
  readonly domain: DomainMatch;
  readonly start: number;
  readonly isAllowed: boolean;
}

interface BareDomainSelection {
  readonly parsedDomain: DomainMatch;
  readonly candidate: BareDomainCandidate | null;
}

const selectBareDomainCandidate = (
  meta: TextMeta,
  start: number,
  consumedRanges: readonly CodePointRange[],
  policy: UrlMatchPolicy,
): BareDomainSelection | null => {
  const { listedTlds, asciiTldTargets, allowedDomains, ambiguousSpacedDots } =
    policy;
  const parsed = parseBareDomainCandidates(
    meta,
    start,
    listedTlds,
    asciiTldTargets,
  );
  if (!parsed) return null;
  const { parsedDomain, boundaryDomain } = parsed;
  if (
    shouldPreserveBareDomainAsProse(meta, parsedDomain, ambiguousSpacedDots) ||
    (boundaryDomain !== parsedDomain &&
      shouldPreserveBareDomainAsProse(
        meta,
        boundaryDomain,
        ambiguousSpacedDots,
      ))
  ) {
    return { parsedDomain, candidate: null };
  }

  const parsedStart = maybeExpandBareSplitPrefix(
    meta,
    parsedDomain,
    consumedRanges,
  );
  const parsedDomainIsAllowed =
    allowedDomains.size > 0 &&
    isAllowedDomain(meta, parsedDomain, allowedDomains, parsedStart);
  const boundaryStart = maybeExpandBareSplitPrefix(
    meta,
    boundaryDomain,
    consumedRanges,
  );
  const boundaryDomainIsAllowed =
    boundaryDomain === parsedDomain
      ? parsedDomainIsAllowed
      : allowedDomains.size > 0 &&
        isAllowedDomain(meta, boundaryDomain, allowedDomains, boundaryStart);
  const boundaryFinalLabel =
    boundaryDomain.labels[boundaryDomain.labels.length - 1];
  const boundarySeparator =
    boundaryDomain !== parsedDomain && boundaryFinalLabel
      ? parseDot(meta, boundaryFinalLabel.pos)
      : null;
  const boundaryEndsBeforeListSeparator =
    boundarySeparator !== null &&
    isWhitespaceWrappedListSeparator(meta, boundarySeparator);
  const allowedSuffixWouldBroadenTrust =
    allowedDomains.size > 0 &&
    boundaryDomain !== parsedDomain &&
    !boundaryEndsBeforeListSeparator &&
    !parsedDomainIsAllowed &&
    boundaryDomainIsAllowed;
  const boundaryFirstLabelStart = boundaryDomain.labels[0]?.start;
  const preserveAllowedSingleLabelSubdomain =
    parsedDomainIsAllowed &&
    boundaryDomain !== parsedDomain &&
    parsedDomain.labels[1]?.start === boundaryFirstLabelStart;
  const preserveAllowedCompletedDomain =
    parsedDomainIsAllowed &&
    boundaryDomain !== parsedDomain &&
    parsedDomain.start === boundaryDomain.start;
  const useParsedDomain =
    allowedSuffixWouldBroadenTrust ||
    preserveAllowedSingleLabelSubdomain ||
    preserveAllowedCompletedDomain;

  return {
    parsedDomain,
    candidate: {
      domain: useParsedDomain ? parsedDomain : boundaryDomain,
      start: useParsedDomain ? parsedStart : boundaryStart,
      isAllowed: useParsedDomain
        ? parsedDomainIsAllowed
        : boundaryDomainIsAllowed,
    },
  };
};

export const collectRanges = (
  meta: TextMeta,
  policy: UrlMatchPolicy,
): readonly CodePointRange[] => {
  const ranges: CodePointRange[] = [];
  collectRangeMatches(meta, policy, (range) => {
    ranges.push(range);
  });
  return mergeCodePointRanges(ranges);
};

function mergeCodePointRanges(
  ranges: readonly CodePointRange[],
): readonly CodePointRange[] {
  const sorted = [...ranges].sort(
    (left, right) => left[0] - right[0] || left[1] - right[1],
  );
  const merged: Array<[number, number]> = [];

  for (const [start, end] of sorted) {
    if (start < 0 || end <= start) continue;
    const previous = merged[merged.length - 1];
    if (!previous || start > previous[1]) {
      merged.push([start, end]);
    } else {
      previous[1] = Math.max(previous[1], end);
    }
  }

  return merged;
}

export const collectRangeMatches = (
  meta: TextMeta,
  policy: UrlMatchPolicy,
  sink: UrlRangeSink,
): boolean => {
  const { listedTlds, asciiTldTargets, allowedDomains } = policy;
  const consumedRanges: CodePointRange[] = [];
  for (let i = 0; i < meta.codePoints.length; i++) {
    const scheme = canStartScheme(meta, i) ? parseSchemePrefix(meta, i) : null;
    if (scheme) {
      const explicitTarget = parseExplicitUrlTarget(
        meta,
        scheme.pos,
        listedTlds,
        asciiTldTargets,
      );
      const fallbackDomain = explicitTarget
        ? null
        : parseDomain(meta, scheme.pos, listedTlds, asciiTldTargets, {
            allowUnknownTld: true,
          });
      const target = explicitTarget ?? fallbackDomain;
      if (!target && !meta.whitespace[scheme.pos]) {
        // A malformed dotless authority cannot contain a bare domain. Skip it
        // as one token so the main loop does not retry an increasingly long
        // label parse at every character, while preserving invalid-URL output.
        let malformedEnd = scheme.pos;
        let hasDomainDot = false;
        while (
          malformedEnd < meta.codePoints.length &&
          !meta.whitespace[malformedEnd]
        ) {
          hasDomainDot ||= meta.symbol[malformedEnd] === ".";
          malformedEnd++;
        }
        if (!hasDomainDot && malformedEnd > scheme.pos) {
          i = malformedEnd - 1;
          continue;
        }
      }
      if (target) {
        const start = scheme.start;
        const end = target.end;
        if (hasExplicitBoundary(meta, start, end, target.pos)) {
          const domain = explicitTarget?.domain ?? fallbackDomain;
          const domainIsAllowed =
            domain !== null &&
            allowedDomains.size > 0 &&
            isAllowedDomain(
              meta,
              domain,
              allowedDomains,
              explicitTarget?.domainStart ?? domain.start,
            );
          const gluedDomain = domainIsAllowed
            ? parseGluedBareDomain(meta, end, listedTlds, asciiTldTargets)
            : null;
          const gluedDomainIsAllowed =
            gluedDomain !== null &&
            isAllowedDomain(meta, gluedDomain, allowedDomains);
          const protectedEnd = gluedDomainIsAllowed ? gluedDomain.end : end;
          if (!domainIsAllowed || protectedEnd > end) {
            if (sink([start, protectedEnd]) === false) return false;
          }
          consumedRanges.push([start, protectedEnd]);
          i = Math.max(
            i,
            protectedEnd - 1,
            target.pos - 1,
            (gluedDomainIsAllowed ? (gluedDomain?.pos ?? 0) : 0) - 1,
          );
          continue;
        }
      }
    }

    if (!meta.alphaNum[i] || !hasBareStartBoundary(meta, i, consumedRanges)) {
      continue;
    }
    const selection = selectBareDomainCandidate(
      meta,
      i,
      consumedRanges,
      policy,
    );
    if (!selection) continue;
    if (!selection.candidate) {
      // Preserved prose still owns its span so split-label recovery cannot
      // absorb it into a later domain.
      consumedRanges.push([
        selection.parsedDomain.start,
        selection.parsedDomain.end,
      ]);
      i = Math.max(i, selection.parsedDomain.end - 1);
      continue;
    }
    const { domain, start, isAllowed } = selection.candidate;
    if (!hasBareBoundary(meta, start, domain.end, consumedRanges)) continue;
    if (!isAllowed) {
      if (sink([start, domain.end]) === false) return false;
    }
    consumedRanges.push([start, domain.end]);
    i = Math.max(i, domain.end - 1);
  }
  return true;
};
