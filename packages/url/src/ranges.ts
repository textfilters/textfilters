import { mergeCodePointRanges } from "@textfilters/core";

import { EMPTY_ALLOWED_DOMAINS, isAllowedDomain } from "./allowed-domains.js";
import { parseDot } from "./dots.js";
import { parseDomain } from "./domain.js";
import { parseExplicitUrlTarget } from "./explicit-authority.js";
import {
  type CodePointRange,
  type DomainMatch,
  type TextMeta,
} from "./meta.js";
import { parseSchemePrefix } from "./scheme.js";

export type UrlRangeSink = (range: CodePointRange) => boolean | void;

const hasBareBoundary = (
  meta: TextMeta,
  start: number,
  end: number,
  ranges: readonly CodePointRange[],
): boolean => {
  if (
    start > 0 &&
    meta.alphaNum[start - 1] &&
    !ranges.some((range) => range[1] === start)
  ) {
    return false;
  }
  if (end < meta.codePoints.length && meta.alphaNum[end]) return false;
  return true;
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
  const firstLabelLength = domain.labels[0]?.raw.length ?? 0;
  const hasSplitLabelEvidence =
    (prefixLength === 3 && firstLabelLength >= 3 && firstLabelLength <= 4) ||
    (prefixLength <= 3 &&
      hasDefangedFirstDot &&
      firstLabelLength >= 3 &&
      firstLabelLength <= 5);
  // Only expand a preceding word when it looks like a deliberately split first
  // host label; otherwise normal prose before a URL would be masked.
  if (!hasSplitLabelEvidence) return domain.start;
  if (prefixLength + (domain.labels[0]?.raw.length ?? 0) > 63) {
    return domain.start;
  }

  return prefixStart;
};

export const collectRanges = (
  meta: TextMeta,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
  allowedDomainSet: ReadonlySet<string> = EMPTY_ALLOWED_DOMAINS,
): readonly CodePointRange[] => {
  const ranges: CodePointRange[] = [];
  collectRangeMatches(
    meta,
    tldSet,
    tldSkeletonSet,
    allowedDomainSet,
    (range) => {
      ranges.push(range);
    },
  );
  return mergeCodePointRanges(ranges);
};

export const collectRangeMatches = (
  meta: TextMeta,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
  allowedDomainSet: ReadonlySet<string>,
  sink: UrlRangeSink,
): boolean => {
  const consumedRanges: CodePointRange[] = [];
  for (let i = 0; i < meta.codePoints.length; i++) {
    const scheme = canStartScheme(meta, i) ? parseSchemePrefix(meta, i) : null;
    if (scheme) {
      const explicitTarget = parseExplicitUrlTarget(
        meta,
        scheme.pos,
        tldSet,
        tldSkeletonSet,
      );
      const fallbackDomain = explicitTarget
        ? null
        : parseDomain(meta, scheme.pos, tldSet, tldSkeletonSet, {
            allowUnknownTld: true,
          });
      const target = explicitTarget ?? fallbackDomain;
      if (target) {
        const start = scheme.start;
        const end = target.end;
        if (hasExplicitBoundary(meta, start, end, target.pos)) {
          const domain = explicitTarget?.domain ?? fallbackDomain;
          if (
            !domain ||
            allowedDomainSet.size === 0 ||
            !isAllowedDomain(
              meta,
              domain,
              allowedDomainSet,
              explicitTarget?.domainStart ?? domain.start,
            )
          ) {
            if (sink([start, end]) === false) return false;
          }
          consumedRanges.push([start, end]);
          i = Math.max(i, end - 1, target.pos - 1);
          continue;
        }
      }
    }

    if (!meta.alphaNum[i]) continue;
    const domain = parseDomain(meta, i, tldSet, tldSkeletonSet);
    if (!domain) continue;
    const start = maybeExpandBareSplitPrefix(meta, domain);
    if (!hasBareBoundary(meta, start, domain.end, consumedRanges)) continue;
    if (
      allowedDomainSet.size === 0 ||
      !isAllowedDomain(meta, domain, allowedDomainSet, start)
    ) {
      if (sink([start, domain.end]) === false) return false;
    }
    consumedRanges.push([start, domain.end]);
    i = Math.max(i, domain.end - 1);
  }
  return true;
};
