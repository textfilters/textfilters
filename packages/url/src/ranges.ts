import { mergeCodePointRanges } from "@textfilters/core";

import { EMPTY_ALLOWED_DOMAINS, isAllowedDomain } from "./allowed-domains.js";
import { isSentenceDotSymbol } from "./chars.js";
import {
  isIgnorableFormatting,
  isRightSpacedDotSymbol,
  isWhitespaceWrappedDot,
  isWhitespaceWrappedListBullet,
  parseDot,
} from "./dots.js";
import { isValidTld, parseDomain } from "./domain.js";
import { parseExplicitUrlTarget } from "./explicit-authority.js";
import {
  type CodePointRange,
  type DomainMatch,
  type TextMeta,
} from "./meta.js";
import { parseSchemePrefix } from "./scheme.js";

export type UrlRangeSink = (range: CodePointRange) => boolean | void;

const SENTENCE_CLOSER_RE = /[\p{Pe}\p{Pf}]/u;
const LETTER_RE = /\p{L}/u;
const CASED_LETTER_RE = /[\p{Ll}\p{Lu}\p{Lt}]/u;
const UPPERCASE_LETTER_RE = /[\p{Lu}\p{Lt}]/u;

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

const hasPlainLabelBoundaries = (
  meta: TextMeta,
  label: DomainMatch["labels"][number],
  dot: NonNullable<ReturnType<typeof parseDot>>,
): boolean => {
  for (
    let cursor = label.start - 1;
    cursor >= dot.end && !meta.whitespace[cursor];
    cursor--
  ) {
    if (meta.labelJoinSeparator[cursor]) return false;
  }

  const trailing = label.end;
  return !(
    meta.zeroWidth[trailing] ||
    isIgnorableFormatting(meta, trailing) ||
    meta.raw[trailing] === "_" ||
    meta.raw[trailing] === "-"
  );
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

const isSentenceWordLabel = (
  meta: TextMeta,
  label: DomainMatch["labels"][number],
): boolean => {
  const source = meta.codePoints.slice(label.start, label.end).join("");
  if (!LETTER_RE.test(source)) return false;
  return UPPERCASE_LETTER_RE.test(source) || !CASED_LETTER_RE.test(source);
};

const isLowercaseExactOnlySentenceLabel = (
  meta: TextMeta,
  label: DomainMatch["labels"][number],
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
): boolean => {
  const source = meta.codePoints.slice(label.start, label.end).join("");
  if (
    !LETTER_RE.test(source) ||
    !CASED_LETTER_RE.test(source) ||
    UPPERCASE_LETTER_RE.test(source) ||
    !tldSet.has(label.raw) ||
    tldSkeletonSet.has(label.skeleton)
  ) {
    return false;
  }

  let cursor = label.end;
  let hasWhitespace = false;
  while (
    cursor < meta.codePoints.length &&
    (meta.whitespace[cursor] || isIgnorableFormatting(meta, cursor))
  ) {
    hasWhitespace ||= meta.whitespace[cursor];
    cursor++;
  }
  if (!hasWhitespace || !meta.alphaNum[cursor]) return false;

  let wordLength = 0;
  while (meta.alphaNum[cursor]) {
    wordLength++;
    cursor++;
  }
  return wordLength >= 2;
};

const hasSentenceProsePrefix = (
  meta: TextMeta,
  domain: DomainMatch,
  suffix: DomainMatch,
): boolean => {
  const suffixStart = suffix.labels[0]?.start;
  if (suffixStart === undefined || suffixStart <= domain.start) return false;
  let boundaryLabel: DomainMatch["labels"][number] | undefined;
  for (const label of domain.labels) {
    if (label.end > suffixStart) break;
    boundaryLabel = label;
  }
  return (
    boundaryLabel !== undefined && isSentenceWordLabel(meta, boundaryLabel)
  );
};

const hasLiteralSentenceBoundary = (
  meta: TextMeta,
  previous: DomainMatch["labels"][number],
  next: DomainMatch["labels"][number],
): boolean => {
  const dot = parseDot(meta, previous.pos);
  if (
    !dot ||
    dot.end !== dot.start + 1 ||
    !isSentenceDotSymbol(meta.raw[dot.start] ?? "")
  ) {
    return false;
  }

  for (let cursor = previous.end; cursor < next.start; cursor++) {
    if (meta.whitespace[cursor]) return true;
  }
  return false;
};

const maybeTrimTrailingSentenceProse = (
  meta: TextMeta,
  domain: DomainMatch,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
): DomainMatch | null => {
  const last = domain.labels.at(-1);
  if (!last || domain.labels.length < 2 || domain.end !== last.end) {
    return domain;
  }

  let labelCount = domain.labels.length;
  while (labelCount >= 2) {
    const previous = domain.labels[labelCount - 2];
    const next = domain.labels[labelCount - 1];
    if (
      !previous ||
      !next ||
      !hasLiteralSentenceBoundary(meta, previous, next) ||
      (!isSentenceWordLabel(meta, next) &&
        !isLowercaseExactOnlySentenceLabel(meta, next, tldSet, tldSkeletonSet))
    ) {
      break;
    }
    labelCount--;
  }

  if (labelCount === domain.labels.length) return domain;
  if (labelCount < 2) return null;

  const tld = domain.labels[labelCount - 1];
  if (!tld || !isValidTld(tld.raw, tld.skeleton, tldSet, tldSkeletonSet)) {
    return null;
  }
  return {
    start: domain.start,
    end: tld.end,
    pos: tld.pos,
    labels: domain.labels.slice(0, labelCount),
  };
};

const maybePreferCompletedDomainBeforeSpacedLabel = (
  meta: TextMeta,
  domain: DomainMatch,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
): DomainMatch => {
  let preferred = domain;
  while (preferred.labels.length >= 3) {
    const next = preferred.labels.at(-1);
    const previous = preferred.labels.at(-2);
    if (!next || !previous || preferred.end !== next.end) break;

    const dot = parseDot(meta, previous.pos);
    const isSingleSpacedDot =
      dot !== null &&
      dot.end === dot.start + 1 &&
      (isWhitespaceWrappedDot(meta, dot) || isRightSpacedDotSymbol(meta, dot));
    const isImplicitPunycodeTld =
      next.raw.startsWith("xn--") || next.skeleton.startsWith("xn--");
    if (
      !dot ||
      !isSingleSpacedDot ||
      !isPlainLabel(meta, next) ||
      !hasPlainLabelBoundaries(meta, next, dot) ||
      next.hasUnconsumedLabelMark === true ||
      !isValidTld(previous.raw, previous.skeleton, tldSet, tldSkeletonSet) ||
      tldSkeletonSet.has(next.skeleton) ||
      isImplicitPunycodeTld ||
      previous.raw === next.raw ||
      previous.skeleton === next.skeleton
    ) {
      break;
    }

    const completedDomain: DomainMatch = {
      start: preferred.start,
      end: previous.end,
      pos: previous.pos,
      labels: preferred.labels.slice(0, -1),
    };
    if (isStandaloneRepeatedListProse(meta, completedDomain)) break;
    preferred = completedDomain;
  }
  return preferred;
};

const maybePreferBareDomainAfterSentence = (
  meta: TextMeta,
  domain: DomainMatch,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
): DomainMatch | null => {
  const trimmedDomain = maybeTrimTrailingSentenceProse(
    meta,
    domain,
    tldSet,
    tldSkeletonSet,
  );
  if (!trimmedDomain || isStandaloneRepeatedListProse(meta, trimmedDomain)) {
    return null;
  }
  // A sentence-ending literal dot can otherwise turn the preceding prose and
  // the following standalone host into one multi-label domain.
  for (let index = trimmedDomain.labels.length - 2; index >= 1; index--) {
    const previous = trimmedDomain.labels[index - 1];
    const next = trimmedDomain.labels[index];
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
    if (suffix && suffix.end === trimmedDomain.end) {
      return isStandaloneRepeatedListProse(meta, suffix) ? null : suffix;
    }
  }

  return trimmedDomain;
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
    let parsedDomain = parseDomain(meta, i, tldSet, tldSkeletonSet);
    if (!parsedDomain) continue;
    const parsedCandidateEnd = parsedDomain.end;
    const sentenceDomain = maybePreferBareDomainAfterSentence(
      meta,
      parsedDomain,
      tldSet,
      tldSkeletonSet,
    );
    if (!sentenceDomain) {
      i = Math.max(i, parsedCandidateEnd - 1);
      continue;
    }
    const preferredDomain = maybePreferCompletedDomainBeforeSpacedLabel(
      meta,
      sentenceDomain,
      tldSet,
      tldSkeletonSet,
    );
    parsedDomain = maybePreferCompletedDomainBeforeSpacedLabel(
      meta,
      parsedDomain,
      tldSet,
      tldSkeletonSet,
    );
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
      preferredDomainIsAllowed &&
      !hasSentenceProsePrefix(meta, parsedDomain, preferredDomain);
    const preferredFirstLabelStart = preferredDomain.labels[0]?.start;
    const preserveAllowedSingleLabelSubdomain =
      parsedDomainIsAllowed &&
      preferredDomain !== parsedDomain &&
      parsedDomain.labels[1]?.start === preferredFirstLabelStart;
    const useParsedDomain =
      allowedSuffixWouldBroadenTrust || preserveAllowedSingleLabelSubdomain;
    let domain = useParsedDomain ? parsedDomain : preferredDomain;
    let start = useParsedDomain ? parsedStart : preferredStart;
    let domainIsAllowed = useParsedDomain
      ? parsedDomainIsAllowed
      : preferredDomainIsAllowed;
    const lastLabel = domain.labels.at(-1);
    const continuationDot = lastLabel ? parseDot(meta, lastLabel.pos) : null;
    const independentSuffix = continuationDot
      ? parseDomain(meta, continuationDot.pos, tldSet, tldSkeletonSet)
      : null;
    if (continuationDot && !independentSuffix) {
      const continuedDomain = parseDomain(
        meta,
        domain.start,
        tldSet,
        tldSkeletonSet,
        { stopAtSentenceDot: false },
      );
      if (continuedDomain && continuedDomain.end > domain.end) {
        const firstContinuationLabel =
          continuedDomain.labels[domain.labels.length];
        const repeatsTerminalTld =
          firstContinuationLabel !== undefined &&
          lastLabel !== undefined &&
          (firstContinuationLabel.raw === lastLabel.raw ||
            firstContinuationLabel.skeleton === lastLabel.skeleton);
        const sentenceContinuation = maybePreferBareDomainAfterSentence(
          meta,
          continuedDomain,
          tldSet,
          tldSkeletonSet,
        );
        const preferredContinuation = sentenceContinuation
          ? maybePreferCompletedDomainBeforeSpacedLabel(
              meta,
              sentenceContinuation,
              tldSet,
              tldSkeletonSet,
            )
          : null;
        if (
          preferredContinuation === continuedDomain &&
          (domainIsAllowed || repeatsTerminalTld)
        ) {
          domain = continuedDomain;
          start = maybeExpandBareSplitPrefix(meta, domain, consumedRanges);
          domainIsAllowed = isAllowedDomain(
            meta,
            domain,
            allowedDomainSet,
            start,
          );
        }
      }
    }
    if (!hasBareBoundary(meta, start, domain.end, consumedRanges)) continue;
    if (!domainIsAllowed) {
      if (sink([start, domain.end]) === false) return false;
    }
    consumedRanges.push([start, domain.end]);
    i = Math.max(i, domain.end - 1, parsedCandidateEnd - 1);
  }
  return true;
};
