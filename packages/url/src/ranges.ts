import { mergeCodePointRanges } from "@textfilters/core";

import { EMPTY_ALLOWED_DOMAINS, isAllowedDomain } from "./allowed-domains.js";
import { isSentenceDotSymbol } from "./chars.js";
import {
  isIgnorableFormatting,
  isWhitespaceWrappedListBullet,
  parseDot,
} from "./dots.js";
import { parseDomain } from "./domain.js";
import { parseExplicitUrlTarget } from "./explicit-authority.js";
import {
  type CodePointRange,
  type DomainMatch,
  type TextMeta,
} from "./meta.js";
import { parseSchemePrefix } from "./scheme.js";

export type UrlRangeSink = (range: CodePointRange) => boolean | void;

const SENTENCE_CLOSER_RE = /[\p{Pe}\p{Pf}]/u;

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

const isSentenceCloser = (value: string): boolean =>
  value === '"' || value === "'" || SENTENCE_CLOSER_RE.test(value);

const isPlainLabel = (
  meta: TextMeta,
  label: DomainMatch["labels"][number],
): boolean => {
  for (let cursor = label.start; cursor < label.end; cursor++) {
    if (!meta.alphaNum[cursor] && meta.raw[cursor] !== "-") return false;
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
  if (!previous || !next || previous.raw !== next.raw) return false;
  if (!isPlainLabel(meta, previous) || !isPlainLabel(meta, next)) return false;
  const dot = parseDot(meta, previous.pos);
  if (
    !dot ||
    !isWhitespaceWrappedListBullet(meta, dot) ||
    !isListSpacing(meta, previous.end, dot.start) ||
    !isListSpacing(meta, dot.end, next.start)
  ) {
    return false;
  }
  if (domain.end !== next.end) return false;
  let afterNext = next.end;
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

const maybePreferBareDomainAfterSentence = (
  meta: TextMeta,
  domain: DomainMatch,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
): DomainMatch | null => {
  if (isStandaloneRepeatedListProse(meta, domain)) return null;

  // A sentence-ending literal dot can otherwise turn the preceding prose and
  // the following standalone host into one multi-label domain.
  for (let index = domain.labels.length - 2; index >= 1; index--) {
    const previous = domain.labels[index - 1];
    const next = domain.labels[index];
    if (!previous || !next) continue;

    const dot = parseDot(meta, previous.pos);
    if (
      !dot ||
      dot.start !== previous.pos ||
      dot.end !== dot.start + 1 ||
      !isSentenceDotSymbol(meta.raw[dot.start] ?? "")
    ) {
      continue;
    }

    let afterDot = dot.pos;
    while (afterDot < next.start) {
      if (isIgnorableFormatting(meta, afterDot)) {
        afterDot++;
        continue;
      }
      if (isSentenceCloser(meta.raw[afterDot] ?? "")) {
        afterDot++;
        continue;
      }
      break;
    }
    if (afterDot >= next.start || !meta.whitespace[afterDot]) continue;

    const suffix = parseDomain(meta, next.start, tldSet, tldSkeletonSet);
    if (suffix && suffix.end === domain.end) {
      return isStandaloneRepeatedListProse(meta, suffix) ? null : suffix;
    }
  }

  return domain;
};

const parseGluedBareDomain = (
  meta: TextMeta,
  start: number,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
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
  return parseDomain(meta, cursor, tldSet, tldSkeletonSet);
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
          const domainIsAllowed =
            domain !== null &&
            allowedDomainSet.size > 0 &&
            isAllowedDomain(
              meta,
              domain,
              allowedDomainSet,
              explicitTarget?.domainStart ?? domain.start,
            );
          const gluedDomain = domainIsAllowed
            ? parseGluedBareDomain(meta, end, tldSet, tldSkeletonSet)
            : null;
          const gluedDomainIsAllowed =
            gluedDomain !== null &&
            isAllowedDomain(meta, gluedDomain, allowedDomainSet);
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

    if (!meta.alphaNum[i]) continue;
    const parsedDomain = parseDomain(meta, i, tldSet, tldSkeletonSet);
    if (!parsedDomain) continue;
    const preferredDomain = maybePreferBareDomainAfterSentence(
      meta,
      parsedDomain,
      tldSet,
      tldSkeletonSet,
    );
    if (!preferredDomain) {
      i = Math.max(i, parsedDomain.end - 1);
      continue;
    }
    const parsedStart = maybeExpandBareSplitPrefix(
      meta,
      parsedDomain,
      consumedRanges,
    );
    const parsedDomainIsAllowed =
      allowedDomainSet.size > 0 &&
      isAllowedDomain(meta, parsedDomain, allowedDomainSet, parsedStart);
    const preferredStart = maybeExpandBareSplitPrefix(
      meta,
      preferredDomain,
      consumedRanges,
    );
    const preferredDomainIsAllowed =
      preferredDomain === parsedDomain
        ? parsedDomainIsAllowed
        : allowedDomainSet.size > 0 &&
          isAllowedDomain(
            meta,
            preferredDomain,
            allowedDomainSet,
            preferredStart,
          );
    const allowedSuffixWouldBroadenTrust =
      allowedDomainSet.size > 0 &&
      preferredDomain !== parsedDomain &&
      !parsedDomainIsAllowed &&
      preferredDomainIsAllowed;
    const preferredFirstLabelStart = preferredDomain.labels[0]?.start;
    const preserveAllowedSingleLabelSubdomain =
      parsedDomainIsAllowed &&
      preferredDomain !== parsedDomain &&
      parsedDomain.labels[1]?.start === preferredFirstLabelStart;
    const useParsedDomain =
      allowedSuffixWouldBroadenTrust || preserveAllowedSingleLabelSubdomain;
    const domain = useParsedDomain ? parsedDomain : preferredDomain;
    const start = useParsedDomain ? parsedStart : preferredStart;
    const domainIsAllowed = useParsedDomain
      ? parsedDomainIsAllowed
      : preferredDomainIsAllowed;
    if (!hasBareBoundary(meta, start, domain.end, consumedRanges)) continue;
    if (!domainIsAllowed) {
      if (sink([start, domain.end]) === false) return false;
    }
    consumedRanges.push([start, domain.end]);
    i = Math.max(i, domain.end - 1);
  }
  return true;
};
