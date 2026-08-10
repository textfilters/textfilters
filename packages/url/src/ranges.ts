import { mergeCodePointRanges } from "@textfilters/core";

import { isAllowedDomain } from "./allowed-domains.js";
import { COMBINING_MARK_RE, isSentenceDotSymbol } from "./chars.js";
import type { AmbiguousSpacedDotPolicy } from "./contracts.js";
import {
  isIgnorableFormatting,
  isRightSpacedDotSymbol,
  isWhitespaceWrappedDot,
  isWhitespaceWrappedListSeparator,
  parseDot,
} from "./dots.js";
import { parseDomain } from "./domain.js";
import { parseExplicitUrlTarget } from "./explicit-authority.js";
import {
  countCodePoints,
  type CodePointRange,
  type DomainMatch,
  type TextMeta,
} from "./meta.js";
import { parseSchemePrefix } from "./scheme.js";
import type { TldLookups } from "./tlds.js";

export type UrlRangeSink = (range: CodePointRange) => boolean | void;

export interface UrlMatchPolicy extends TldLookups {
  readonly allowedDomains: ReadonlySet<string>;
  readonly ambiguousSpacedDots: AmbiguousSpacedDotPolicy;
}

const SENTENCE_CLOSER_RE = /[\p{Pe}\p{Pf}]/u;

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
  if (prefixLength + firstLabelLength > 63) {
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

const hasOnlyIgnorableFormatting = (
  meta: TextMeta,
  start: number,
  end: number,
): boolean => {
  for (let cursor = start; cursor < end; cursor++) {
    if (!isIgnorableFormatting(meta, cursor)) return false;
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

const isAmbiguousRightSpacedDomain = (
  meta: TextMeta,
  domain: DomainMatch,
): boolean => {
  if (domain.labels.length !== 2) return false;
  const [previous, tld] = domain.labels;
  if (!previous || !tld || domain.end !== tld.end) return false;

  const dot = parseDot(meta, previous.pos);
  if (
    !dot ||
    !hasOnlyIgnorableFormatting(meta, previous.end, dot.start) ||
    dot.end !== dot.start + 1 ||
    !isSentenceDotSymbol(meta.raw[dot.start] ?? "")
  ) {
    return false;
  }

  let afterDot = dot.end;
  while (
    afterDot < tld.start &&
    (isIgnorableFormatting(meta, afterDot) ||
      isSentenceCloser(meta.raw[afterDot] ?? ""))
  ) {
    afterDot++;
  }
  return meta.whitespace[afterDot] ?? false;
};

const preferCompletedDomainBeforeSpacedSeparator = (
  meta: TextMeta,
  domain: DomainMatch,
  listedTlds: ReadonlySet<string>,
  asciiTldTargets: ReadonlySet<string>,
): DomainMatch => {
  const finalLabel = domain.labels[domain.labels.length - 1];
  if (!finalLabel || domain.end !== finalLabel.end) return domain;

  for (let index = 1; index < domain.labels.length - 1; index++) {
    const label = domain.labels[index];
    const nextLabel = domain.labels[index + 1];
    if (
      !label ||
      (nextLabel !== undefined &&
        nextLabel.raw === label.raw &&
        nextLabel.skeleton === label.skeleton) ||
      (!label.raw.startsWith("xn--") &&
        !label.skeleton.startsWith("xn--") &&
        !listedTlds.has(label.raw) &&
        !asciiTldTargets.has(label.skeleton))
    ) {
      continue;
    }

    const dot = parseDot(meta, label.pos);
    if (
      !dot ||
      (!isWhitespaceWrappedDot(meta, dot) && !isRightSpacedDotSymbol(meta, dot))
    ) {
      continue;
    }

    return {
      start: domain.start,
      end: label.end,
      pos: label.pos,
      labels: domain.labels.slice(0, index + 1),
    };
  }

  return domain;
};

const maybePreferBareDomainAfterSentence = (
  meta: TextMeta,
  domain: DomainMatch,
  listedTlds: ReadonlySet<string>,
  asciiTldTargets: ReadonlySet<string>,
  ambiguousSpacedDots: AmbiguousSpacedDotPolicy,
): DomainMatch | null => {
  if (isStandaloneRepeatedListProse(meta, domain)) return null;
  if (
    ambiguousSpacedDots === "preserve" &&
    isAmbiguousRightSpacedDomain(meta, domain)
  ) {
    return null;
  }

  const completedDomain = preferCompletedDomainBeforeSpacedSeparator(
    meta,
    domain,
    listedTlds,
    asciiTldTargets,
  );
  if (completedDomain !== domain) {
    return ambiguousSpacedDots === "preserve" &&
      isAmbiguousRightSpacedDomain(meta, completedDomain)
      ? null
      : completedDomain;
  }

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

    const suffix = parseDomain(meta, next.start, listedTlds, asciiTldTargets);
    if (suffix && suffix.end === domain.end) {
      return isStandaloneRepeatedListProse(meta, suffix) ? null : suffix;
    }
  }

  return domain;
};

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
  const parsedDomain = parseDomain(meta, start, listedTlds, asciiTldTargets);
  if (!parsedDomain) return null;

  const preferredDomain = maybePreferBareDomainAfterSentence(
    meta,
    parsedDomain,
    listedTlds,
    asciiTldTargets,
    ambiguousSpacedDots,
  );
  if (!preferredDomain) return { parsedDomain, candidate: null };

  const parsedStart = maybeExpandBareSplitPrefix(
    meta,
    parsedDomain,
    consumedRanges,
  );
  const parsedDomainIsAllowed =
    allowedDomains.size > 0 &&
    isAllowedDomain(meta, parsedDomain, allowedDomains, parsedStart);
  const preferredStart = maybeExpandBareSplitPrefix(
    meta,
    preferredDomain,
    consumedRanges,
  );
  const preferredDomainIsAllowed =
    preferredDomain === parsedDomain
      ? parsedDomainIsAllowed
      : allowedDomains.size > 0 &&
        isAllowedDomain(meta, preferredDomain, allowedDomains, preferredStart);
  const preferredFinalLabel =
    preferredDomain.labels[preferredDomain.labels.length - 1];
  const preferredSeparator =
    preferredDomain !== parsedDomain && preferredFinalLabel
      ? parseDot(meta, preferredFinalLabel.pos)
      : null;
  const preferredEndsBeforeListSeparator =
    preferredSeparator !== null &&
    isWhitespaceWrappedListSeparator(meta, preferredSeparator);
  const allowedSuffixWouldBroadenTrust =
    allowedDomains.size > 0 &&
    preferredDomain !== parsedDomain &&
    !preferredEndsBeforeListSeparator &&
    !parsedDomainIsAllowed &&
    preferredDomainIsAllowed;
  const preferredFirstLabelStart = preferredDomain.labels[0]?.start;
  const preserveAllowedSingleLabelSubdomain =
    parsedDomainIsAllowed &&
    preferredDomain !== parsedDomain &&
    parsedDomain.labels[1]?.start === preferredFirstLabelStart;
  const preserveAllowedCompletedDomain =
    parsedDomainIsAllowed &&
    preferredDomain !== parsedDomain &&
    parsedDomain.start === preferredDomain.start;
  const useParsedDomain =
    allowedSuffixWouldBroadenTrust ||
    preserveAllowedSingleLabelSubdomain ||
    preserveAllowedCompletedDomain;

  return {
    parsedDomain,
    candidate: {
      domain: useParsedDomain ? parsedDomain : preferredDomain,
      start: useParsedDomain ? parsedStart : preferredStart,
      isAllowed: useParsedDomain
        ? parsedDomainIsAllowed
        : preferredDomainIsAllowed,
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
