import { lowerNfkc, mergeCodePointRanges } from "@textfilters/core";

import { EMPTY_ALLOWED_DOMAINS, isAllowedDomain } from "./allowed-domains.js";
import { isSentenceDotSymbol, UNICODE_MARK_RE } from "./chars.js";
import {
  isIgnorableFormatting,
  isWhitespaceWrappedListBullet,
  parseDot,
} from "./dots.js";
import {
  consumeEnglishContractionSuffix,
  isValidTld,
  parseDomain,
  parseLabel,
} from "./domain.js";
import { parseExplicitUrlTarget } from "./explicit-authority.js";
import {
  type CodePointRange,
  type DomainMatch,
  type TextMeta,
  haveConfusableTldMatch,
} from "./meta.js";
import { maybeConsumePathTail } from "./path.js";
import { parseSchemePrefix } from "./scheme.js";
import { DEFAULT_TLD_SET } from "./tlds.js";

export type UrlRangeSink = (range: CodePointRange) => boolean | void;

const SENTENCE_CLOSER_RE = /[\p{Pe}\p{Pf}]/u;
const SENTENCE_OPENER_RE = /[\p{Ps}\p{Pi}]/u;
const SENTENCE_DASH_RE = /^\p{Pd}$/u;
const SENTENCE_PROSE_BASE_RE = /^\p{Lu}[\p{L}\p{M}]*$/u;
const LETTER_MARK_PROSE_BASE_RE = /^[\p{L}\p{M}]+$/u;
const CASED_LETTER_RE = /[\p{Lu}\p{Ll}\p{Lt}]/u;
const ENGLISH_CONTRACTION_SOURCE_RE = /^(?:re|ve|ll|s|d|m|t)$/iu;
const SENTENCE_CLAUSE_PUNCTUATION = new Set([
  ",",
  ";",
  ":",
  "!",
  "?",
  "…",
  "–",
  "—",
  ".",
  "*",
  "_",
  "~",
  ">",
  "#",
  "`",
  "•",
]);

const findBoundaryBeforeLeadingMarks = (
  meta: TextMeta,
  start: number,
): number => {
  let boundaryStart = start;
  while (
    boundaryStart > 0 &&
    UNICODE_MARK_RE.test(meta.codePoints[boundaryStart - 1] ?? "")
  ) {
    boundaryStart--;
  }
  return boundaryStart;
};

const hasBareBoundary = (
  meta: TextMeta,
  start: number,
  end: number,
  ranges: readonly CodePointRange[],
): boolean => {
  const boundaryStart = findBoundaryBeforeLeadingMarks(meta, start);
  if (
    boundaryStart > 0 &&
    meta.alphaNum[boundaryStart - 1] &&
    !ranges.some((range) => range[1] === boundaryStart)
  ) {
    return false;
  }
  if (
    end < meta.codePoints.length &&
    meta.labelChar[end] &&
    !UNICODE_MARK_RE.test(meta.raw[end] ?? "")
  ) {
    return false;
  }
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
  const boundaryStart = findBoundaryBeforeLeadingMarks(meta, start);
  if (boundaryStart > 0 && meta.alphaNum[boundaryStart - 1]) {
    return false;
  }
  return end >= meta.codePoints.length || !meta.alphaNum[end] || resume >= end;
};

const isExactAllowedDomain = (
  meta: TextMeta,
  domain: DomainMatch,
  allowedDomainSet: ReadonlySet<string>,
  firstLabelStart?: number,
): boolean => {
  let boundary = domain.end;
  while (isIgnorableFormatting(meta, boundary)) boundary++;
  return (
    !UNICODE_MARK_RE.test(meta.codePoints[boundary] ?? "") &&
    isAllowedDomain(meta, domain, allowedDomainSet, firstLabelStart)
  );
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
  while (prefixStart > 0 && meta.labelChar[prefixStart - 1]) prefixStart--;
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

const isSentenceWrapper = (value: string): boolean =>
  isSentenceCloser(value) || SENTENCE_OPENER_RE.test(value);

const isSentenceClausePunctuation = (meta: TextMeta, index: number): boolean =>
  SENTENCE_CLAUSE_PUNCTUATION.has(meta.codePoints[index] ?? "") ||
  SENTENCE_CLAUSE_PUNCTUATION.has(meta.raw[index] ?? "") ||
  SENTENCE_DASH_RE.test(meta.codePoints[index] ?? "") ||
  SENTENCE_DASH_RE.test(meta.raw[index] ?? "");

const isCapitalizedProseLabel = (
  meta: TextMeta,
  label: DomainMatch["labels"][number],
): boolean => {
  const normalized = meta.codePoints
    .slice(label.start, label.end)
    .join("")
    .normalize("NFKC");
  const parts = normalized.split(/['’]/u);
  if (parts.length > 2) return false;
  const [base = "", contraction] = parts;
  if (
    contraction !== undefined &&
    !ENGLISH_CONTRACTION_SOURCE_RE.test(contraction)
  ) {
    return false;
  }
  return (
    SENTENCE_PROSE_BASE_RE.test(base) ||
    (LETTER_MARK_PROSE_BASE_RE.test(base) && !CASED_LETTER_RE.test(base))
  );
};

const haveCanonicallyEquivalentLabelText = (
  left: DomainMatch["labels"][number],
  right: DomainMatch["labels"][number],
): boolean => lowerNfkc(left.raw) === lowerNfkc(right.raw);

const isPlainLabel = (
  meta: TextMeta,
  label: DomainMatch["labels"][number],
): boolean => {
  for (let cursor = label.start; cursor < label.end; cursor++) {
    if (!meta.labelChar[cursor] && meta.raw[cursor] !== "-") return false;
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
  const completeNext = parseLabel(meta, next.start);
  const repeatedNext =
    completeNext && haveCanonicallyEquivalentLabelText(previous, completeNext)
      ? completeNext
      : next;
  if (!haveCanonicallyEquivalentLabelText(previous, repeatedNext)) return false;
  if (!isPlainLabel(meta, previous) || !isPlainLabel(meta, repeatedNext)) {
    return false;
  }
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
  const pathTail = maybeConsumePathTail(meta, repeatedNext.pos);
  if (pathTail && pathTail.end > repeatedNext.end) return false;
  let afterNext = repeatedNext.end;
  while (isIgnorableFormatting(meta, afterNext)) afterNext++;
  if (
    meta.labelChar[afterNext] ||
    meta.raw[afterNext] === "-" ||
    meta.raw[afterNext] === "_"
  ) {
    return false;
  }

  return true;
};

const findSentenceProseBoundary = (
  meta: TextMeta,
  domain: DomainMatch,
): number | null => {
  const finalLabel = domain.labels[domain.labels.length - 1];
  if (!finalLabel || domain.end !== finalLabel.end) return null;

  for (let index = domain.labels.length - 1; index >= 1; index--) {
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

    let cursor = dot.pos;
    let hasWhitespaceBeforeNext = false;
    let hasOnlySentenceSpacing = true;
    while (cursor < next.start) {
      if (meta.whitespace[cursor]) {
        hasWhitespaceBeforeNext = true;
      } else if (
        !isIgnorableFormatting(meta, cursor) &&
        !isSentenceWrapper(meta.raw[cursor] ?? "") &&
        !isSentenceClausePunctuation(meta, cursor)
      ) {
        hasOnlySentenceSpacing = false;
        break;
      }
      cursor++;
    }
    if (
      !hasOnlySentenceSpacing ||
      !hasWhitespaceBeforeNext ||
      cursor !== next.start ||
      !isCapitalizedProseLabel(meta, next)
    ) {
      continue;
    }

    cursor = consumeEnglishContractionSuffix(meta, next.pos);
    const attachedContinuationStart = cursor;
    let hasWhitespaceAfterNext = false;
    let hasAttachedHyphenatedContinuation = false;
    while (
      cursor < meta.codePoints.length &&
      (meta.whitespace[cursor] ||
        isIgnorableFormatting(meta, cursor) ||
        isSentenceWrapper(meta.raw[cursor] ?? "") ||
        isSentenceClausePunctuation(meta, cursor))
    ) {
      hasAttachedHyphenatedContinuation ||=
        cursor === attachedContinuationStart &&
        !meta.whitespace[cursor] &&
        SENTENCE_DASH_RE.test(meta.raw[cursor] ?? "");
      hasWhitespaceAfterNext ||= meta.whitespace[cursor];
      cursor++;
    }
    if (cursor >= meta.codePoints.length) return index;
    if (
      (hasWhitespaceAfterNext || hasAttachedHyphenatedContinuation) &&
      meta.alphaNum[cursor]
    ) {
      return index;
    }
  }

  return null;
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

  // A capitalized delegated suffix followed by another word after a literal
  // sentence dot is prose unless stronger URL evidence was parsed.
  if (tldSet === DEFAULT_TLD_SET) {
    const sentenceBoundary = findSentenceProseBoundary(meta, domain);
    if (sentenceBoundary !== null) {
      if (sentenceBoundary === 1) return null;
      const completedTld = domain.labels[sentenceBoundary - 1];
      if (
        !completedTld ||
        !isValidTld(
          completedTld.raw,
          completedTld.skeleton,
          tldSet,
          tldSkeletonSet,
          completedTld.source,
        )
      ) {
        return null;
      }
      return {
        start: domain.start,
        end: completedTld.end,
        pos: completedTld.pos,
        labels: domain.labels.slice(0, sentenceBoundary),
      };
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
  if (!hasSeparator || !meta.labelChar[cursor]) return null;
  return parseDomain(meta, cursor, tldSet, tldSkeletonSet);
};

const parseBareDomainContinuation = (
  meta: TextMeta,
  start: number,
  domain: DomainMatch,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
): DomainMatch | null => {
  const dot = parseDot(meta, domain.pos);
  if (!dot) return null;
  let hasWhitespaceBeforeDot = false;
  for (let cursor = domain.pos; cursor < dot.start; cursor++) {
    hasWhitespaceBeforeDot ||= meta.whitespace[cursor];
  }

  const continued = parseDomain(meta, start, tldSet, tldSkeletonSet, {
    forceContinuationDotAt: hasWhitespaceBeforeDot ? dot.start : undefined,
    preferCompletedDomainBeforeProseSeparator: false,
  });
  return continued && continued.end > domain.end ? continued : null;
};

const repeatsCompletedTld = (
  domain: DomainMatch,
  continuation: DomainMatch,
): boolean => {
  if (continuation.labels.length !== domain.labels.length + 1) return false;
  const completedTld = domain.labels[domain.labels.length - 1];
  const continuedTld = continuation.labels[continuation.labels.length - 1];
  return (
    completedTld !== undefined &&
    continuedTld !== undefined &&
    (haveCanonicallyEquivalentLabelText(completedTld, continuedTld) ||
      haveConfusableTldMatch(
        completedTld.source ?? completedTld.raw,
        continuedTld.source ?? continuedTld.raw,
      ))
  );
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
            isExactAllowedDomain(
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
            isExactAllowedDomain(meta, gluedDomain, allowedDomainSet);
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

    if (!meta.labelChar[i]) continue;
    let parsedDomain = parseDomain(meta, i, tldSet, tldSkeletonSet);
    if (!parsedDomain) continue;
    const ordinaryContinuation = parseBareDomainContinuation(
      meta,
      i,
      parsedDomain,
      tldSet,
      tldSkeletonSet,
    );
    if (
      ordinaryContinuation &&
      (isStandaloneRepeatedListProse(meta, parsedDomain) ||
        repeatsCompletedTld(parsedDomain, ordinaryContinuation))
    ) {
      parsedDomain = ordinaryContinuation;
    }
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
      isExactAllowedDomain(meta, parsedDomain, allowedDomainSet, parsedStart);
    const defangedContinuation =
      allowedDomainSet.size > 0
        ? parseBareDomainContinuation(
            meta,
            i,
            parsedDomain,
            tldSet,
            tldSkeletonSet,
          )
        : null;
    if (defangedContinuation) {
      const continuationIsAllowed = isExactAllowedDomain(
        meta,
        defangedContinuation,
        allowedDomainSet,
        parsedStart,
      );
      if (parsedDomainIsAllowed || continuationIsAllowed) {
        if (!continuationIsAllowed) {
          if (sink([parsedStart, defangedContinuation.end]) === false) {
            return false;
          }
        }
        consumedRanges.push([parsedStart, defangedContinuation.end]);
        i = Math.max(i, defangedContinuation.end - 1);
        continue;
      }
    }
    const preferredStart = maybeExpandBareSplitPrefix(
      meta,
      preferredDomain,
      consumedRanges,
    );
    const preferredDomainIsAllowed =
      preferredDomain === parsedDomain
        ? parsedDomainIsAllowed
        : allowedDomainSet.size > 0 &&
          isExactAllowedDomain(
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
