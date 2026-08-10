import { lowerNfkc } from "@textfilters/core";

import { COMBINING_MARK_RE, PATH_START_CHARS } from "./chars.js";
import {
  isIgnorableFormatting,
  isRightSpacedDotSymbol,
  isRightSpacedSentenceDot,
  isWhitespaceWrappedDot,
  parseDot,
} from "./dots.js";
import {
  countCodePoints,
  MAX_HOST_LABEL_CODE_POINTS,
  MAX_HOSTNAME_CODE_POINTS,
  type DomainMatch,
  type Label,
  type TextMeta,
  toSkeletonFromNormalized,
} from "./meta.js";
import { maybeConsumePathTail } from "./path.js";
import { parseSchemePrefix } from "./scheme.js";

const MAX_DOMAIN_LABELS = 127;
const ASCII_ONLY_RE = /^[\x00-\x7f]*$/u;

const finalizeLabelText = (source: string) => {
  if (ASCII_ONLY_RE.test(source)) {
    const raw = source.toLowerCase();
    return { raw, skeleton: raw };
  }
  const raw = lowerNfkc(source);
  return { raw, skeleton: toSkeletonFromNormalized(raw) };
};

// Zero-width marks are host obfuscation, not prose boundaries; measure visible
// runs through them before deciding whether a whitespace gap belongs to a host.
const measureAlphaNumRun = (meta: TextMeta, start: number): number => {
  let cursor = start;
  let runLen = 0;
  while (cursor < meta.codePoints.length) {
    if (meta.zeroWidth[cursor]) {
      cursor++;
      continue;
    }
    if (!meta.alphaNum[cursor]) break;
    runLen++;
    cursor++;
  }
  return runLen;
};

export const parseLabel = (
  meta: TextMeta,
  start: number,
  {
    joinSingleCharacterWhitespaceRuns = true,
  }: { readonly joinSingleCharacterWhitespaceRuns?: boolean } = {},
): Label | null => {
  let pos = start;
  let visibleLeadingJoiners = 0;
  while (pos < meta.codePoints.length && meta.labelJoinSeparator[pos]) {
    if (!meta.zeroWidth[pos] && !meta.whitespace[pos]) {
      visibleLeadingJoiners++;
      if (visibleLeadingJoiners > 1) return null;
    }
    pos++;
  }
  let first = -1;
  let last = -1;
  let sourceText = "";
  let requiresWholeLabelNormalization = false;

  while (pos < meta.codePoints.length) {
    const sourceChar = meta.codePoints[pos] ?? "";
    const rawChar = meta.raw[pos];
    const isAttachedMark =
      !meta.alphaNum[pos] &&
      first >= 0 &&
      !isIgnorableFormatting(meta, pos) &&
      COMBINING_MARK_RE.test(sourceChar);
    if (meta.alphaNum[pos] || isAttachedMark) {
      if (rawChar) {
        if (first < 0) first = pos;
        last = pos;
        const isAsciiSourceChar =
          sourceChar.length === 1 && sourceChar.charCodeAt(0) <= 0x7f;
        sourceText += isAsciiSourceChar ? rawChar : sourceChar;
        requiresWholeLabelNormalization ||= !isAsciiSourceChar;
      }
      pos++;
      continue;
    }

    if (meta.labelJoinSeparator[pos]) {
      const gapStart = pos;
      let gapHasWhitespace = false;
      let gapHasZeroWidth = false;
      let gapHasNonZeroWidthSymbol = false;
      let visibleGapRaw = "";
      let visibleGapLength = 0;
      while (pos < meta.codePoints.length && meta.labelJoinSeparator[pos]) {
        gapHasWhitespace ||= meta.whitespace[pos];
        gapHasZeroWidth ||= meta.zeroWidth[pos];
        gapHasNonZeroWidthSymbol ||=
          !meta.zeroWidth[pos] && !meta.whitespace[pos];
        if (!meta.zeroWidth[pos] && !meta.whitespace[pos]) {
          visibleGapRaw += meta.raw[pos];
          visibleGapLength++;
        }
        pos++;
      }
      const hasOnlyHostnameJoinSymbols = /^[-_]+$/u.test(visibleGapRaw);
      if (!gapHasWhitespace && /^-+$/u.test(visibleGapRaw)) {
        sourceText += visibleGapRaw;
      }
      // Join only very short whitespace-split pieces. Longer visible runs are
      // usually prose before a normal URL, even if the run contains zero-width.
      if (
        gapHasWhitespace &&
        pos < meta.codePoints.length &&
        meta.alphaNum[pos]
      ) {
        const runLen = measureAlphaNumRun(meta, pos);
        if (!joinSingleCharacterWhitespaceRuns || runLen > 1) {
          pos = gapStart;
          break;
        }
      }

      const maybeDot = parseDot(meta, gapStart);
      if (maybeDot && maybeDot.start >= gapStart && maybeDot.start <= pos) {
        pos = gapStart;
        break;
      }

      // A long run of unrelated punctuation is a boundary, not an obfuscated
      // label join. This also prevents an existing mask run from creating a
      // wider domain when censoring is applied more than once.
      if (
        !gapHasZeroWidth &&
        visibleGapLength > 1 &&
        !hasOnlyHostnameJoinSymbols
      ) {
        pos = gapStart;
        break;
      }

      // A zero-width mark followed by punctuation should split at the valid TLD
      // instead of appending glued prose such as `,next` to the label.
      if (
        gapHasZeroWidth &&
        gapHasNonZeroWidthSymbol &&
        !hasOnlyHostnameJoinSymbols &&
        pos < meta.codePoints.length &&
        meta.alphaNum[pos]
      ) {
        pos = gapStart;
        break;
      }

      if (
        !gapHasWhitespace &&
        !gapHasZeroWidth &&
        visibleGapRaw &&
        !/^-+$/u.test(visibleGapRaw) &&
        pos < meta.codePoints.length &&
        meta.alphaNum[pos]
      ) {
        const runLen = measureAlphaNumRun(meta, pos);
        if (runLen > 1) {
          pos = gapStart;
          break;
        }
      }

      if (pos < meta.codePoints.length && meta.alphaNum[pos]) {
        continue;
      }
      pos = gapStart;
    }

    break;
  }

  if (first < 0 || sourceText.length === 0) return null;
  const normalized = requiresWholeLabelNormalization
    ? finalizeLabelText(sourceText)
    : { raw: sourceText, skeleton: sourceText };
  if (
    !normalized.raw ||
    countCodePoints(normalized.raw) > MAX_HOST_LABEL_CODE_POINTS
  ) {
    return null;
  }
  return {
    start: first,
    end: last + 1,
    pos,
    ...normalized,
  };
};

const isValidTld = (
  tldRaw: string,
  tldSkeleton: string,
  listedTlds: ReadonlySet<string>,
  asciiTldTargets: ReadonlySet<string>,
): boolean => {
  if (!tldRaw) return false;
  return listedTlds.has(tldRaw) || asciiTldTargets.has(tldSkeleton);
};

const trimTldTrailingProse = (
  meta: TextMeta,
  label: Label,
  listedTlds: ReadonlySet<string>,
  asciiTldTargets: ReadonlySet<string>,
): Label | null => {
  let sourceText = "";
  let last = -1;
  for (let cursor = label.start; cursor < label.pos; cursor++) {
    const sourceChar = meta.codePoints[cursor] ?? "";
    const symbol = meta.symbol[cursor];
    const canSplit =
      (sourceText.length > 0 && parseSchemePrefix(meta, cursor) !== null) ||
      meta.whitespace[cursor] ||
      isIgnorableFormatting(meta, cursor) ||
      symbol === "-" ||
      ((symbol === "'" || symbol === "’") &&
        cursor + 1 < label.pos &&
        meta.skeleton[cursor + 1] === "s" &&
        cursor + 2 === label.pos);
    if (canSplit && sourceText) {
      const normalized = finalizeLabelText(sourceText);
      if (
        isValidTld(
          normalized.raw,
          normalized.skeleton,
          listedTlds,
          asciiTldTargets,
        )
      ) {
        return {
          start: label.start,
          end: last + 1,
          pos: cursor,
          ...normalized,
        };
      }
    }
    const isAttachedMark =
      !meta.alphaNum[cursor] &&
      sourceText.length > 0 &&
      !isIgnorableFormatting(meta, cursor) &&
      COMBINING_MARK_RE.test(sourceChar);
    if (meta.alphaNum[cursor] || isAttachedMark) {
      sourceText += sourceChar;
      last = cursor;
      continue;
    }
    if (symbol === "-" && !meta.whitespace[cursor] && !meta.zeroWidth[cursor]) {
      sourceText += sourceChar;
      last = cursor;
    }
  }
  return null;
};

const hasWhitespaceInLabelSeparatorRun = (
  meta: TextMeta,
  start: number,
): boolean => {
  let cursor = start;
  while (cursor < meta.codePoints.length && meta.labelJoinSeparator[cursor]) {
    if (meta.whitespace[cursor]) return true;
    cursor++;
  }
  return false;
};

export const parseDomain = (
  meta: TextMeta,
  start: number,
  listedTlds: ReadonlySet<string>,
  asciiTldTargets: ReadonlySet<string>,
  {
    allowUnknownTld = false,
    joinSingleCharacterWhitespaceRuns = true,
    splitAdjacentDomains = true,
  }: {
    readonly allowUnknownTld?: boolean;
    readonly joinSingleCharacterWhitespaceRuns?: boolean;
    readonly splitAdjacentDomains?: boolean;
  } = {},
): DomainMatch | null => {
  const first = parseLabel(meta, start, {
    joinSingleCharacterWhitespaceRuns,
  });
  if (!first) return null;

  const labels: Label[] = [first];
  let pos = first.pos;
  let domainTextLength = countCodePoints(first.raw);
  // Preserve a valid host when an unrelated whitespace-wrapped dot makes the
  // later candidate invalid.
  let completedBeforeProseSeparator: DomainMatch | null = null;

  while (true) {
    const currentLabel = labels[labels.length - 1];
    if (splitAdjacentDomains && labels.length >= 2 && currentLabel) {
      const trimmedTld = trimTldTrailingProse(
        meta,
        currentLabel,
        listedTlds,
        asciiTldTargets,
      );
      if (
        trimmedTld &&
        hasWhitespaceInLabelSeparatorRun(meta, trimmedTld.pos) &&
        parseDomain(meta, trimmedTld.pos, listedTlds, asciiTldTargets, {
          joinSingleCharacterWhitespaceRuns: false,
          splitAdjacentDomains: false,
        })
      ) {
        // A one-character first label can otherwise be joined through
        // whitespace to the previous TLD (`one.com x.org`). Split only across
        // a real whitespace boundary when the remainder is independently
        // recognizable as a complete domain.
        labels[labels.length - 1] = trimmedTld;
        pos = trimmedTld.pos;
        break;
      }
    }

    if (
      labels.length >= 2 &&
      currentLabel &&
      isValidTld(
        currentLabel.raw,
        currentLabel.skeleton,
        listedTlds,
        asciiTldTargets,
      ) &&
      parseSchemePrefix(meta, pos)
    ) {
      // A complete domain followed by another, possibly obfuscated, scheme is
      // an adjacent URL rather than one longer hostname. Finish the first
      // range so censoring the explicit URL cannot expose the domain later.
      break;
    }

    const dot = parseDot(meta, pos);
    if (!dot) break;
    const currentTld = labels[labels.length - 1];
    if (
      !allowUnknownTld &&
      labels.length >= 2 &&
      isValidTld(
        currentTld.raw,
        currentTld.skeleton,
        listedTlds,
        asciiTldTargets,
      ) &&
      (isWhitespaceWrappedDot(meta, dot) || isRightSpacedDotSymbol(meta, dot))
    ) {
      completedBeforeProseSeparator = {
        start: first.start,
        end: currentTld.end,
        pos: currentTld.pos,
        labels: [...labels],
      };
    }
    if (
      labels.length >= 2 &&
      isRightSpacedSentenceDot(meta, dot) &&
      (allowUnknownTld ||
        isValidTld(
          currentTld.raw,
          currentTld.skeleton,
          listedTlds,
          asciiTldTargets,
        ))
    ) {
      // `example.com. next` is sentence punctuation after a valid TLD, not a
      // third label that should make the whole candidate fail.
      break;
    }
    const next = parseLabel(meta, dot.pos, {
      joinSingleCharacterWhitespaceRuns,
    });
    if (!next) break;
    labels.push(next);
    domainTextLength += countCodePoints(next.raw) + 1;
    if (
      labels.length > MAX_DOMAIN_LABELS ||
      domainTextLength > MAX_HOSTNAME_CODE_POINTS
    ) {
      return completedBeforeProseSeparator;
    }
    pos = next.pos;
  }

  if (labels.length < 2) return null;

  let tld = labels[labels.length - 1];
  if (
    !allowUnknownTld &&
    !isValidTld(tld.raw, tld.skeleton, listedTlds, asciiTldTargets)
  ) {
    const trimmedTld = trimTldTrailingProse(
      meta,
      tld,
      listedTlds,
      asciiTldTargets,
    );
    if (!trimmedTld) return completedBeforeProseSeparator;
    labels[labels.length - 1] = trimmedTld;
    tld = trimmedTld;
    pos = trimmedTld.pos;
  }

  let end = tld.end;
  let tailStart = pos;
  let afterDot = pos + 1;
  while (
    afterDot < meta.codePoints.length &&
    isIgnorableFormatting(meta, afterDot)
  ) {
    afterDot++;
  }
  if (
    pos < meta.codePoints.length &&
    meta.symbol[pos] === "." &&
    afterDot < meta.codePoints.length &&
    PATH_START_CHARS.has(meta.symbol[afterDot])
  ) {
    end = pos + 1;
    tailStart = afterDot;
  }

  const pathTail = maybeConsumePathTail(meta, tailStart);
  if (pathTail && pathTail.end > end) {
    end = pathTail.end;
    pos = pathTail.pos;
  }

  return { start: first.start, end, pos, labels };
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

export const hasAmbiguousRightSpacedSuffix = (
  meta: TextMeta,
  domain: DomainMatch,
): boolean => {
  const previous = domain.labels.at(-2);
  const tld = domain.labels.at(-1);
  if (!previous || !tld || domain.end !== tld.end) return false;

  const dot = parseDot(meta, previous.pos);
  return (
    dot !== null &&
    hasOnlyIgnorableFormatting(meta, previous.end, dot.start) &&
    isRightSpacedSentenceDot(meta, dot, tld.start)
  );
};

const preferCompletedDomainBeforeSpacedSeparator = (
  meta: TextMeta,
  domain: DomainMatch,
  listedTlds: ReadonlySet<string>,
  asciiTldTargets: ReadonlySet<string>,
): DomainMatch => {
  const finalLabel = domain.labels.at(-1);
  if (!finalLabel || domain.end !== finalLabel.end) return domain;

  for (let index = 1; index < domain.labels.length - 1; index++) {
    const label = domain.labels[index];
    const nextLabel = domain.labels[index + 1];
    if (
      !label ||
      (nextLabel !== undefined &&
        nextLabel.raw === label.raw &&
        nextLabel.skeleton === label.skeleton) ||
      (!listedTlds.has(label.raw) && !asciiTldTargets.has(label.skeleton))
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

const preferDomainAfterSentence = (
  meta: TextMeta,
  domain: DomainMatch,
): DomainMatch => {
  for (let index = domain.labels.length - 2; index >= 1; index--) {
    const previous = domain.labels[index - 1];
    const next = domain.labels[index];
    if (!previous || !next) continue;

    const dot = parseDot(meta, previous.pos);
    if (
      !dot ||
      !hasOnlyIgnorableFormatting(meta, previous.end, dot.start) ||
      !isRightSpacedSentenceDot(meta, dot, next.start)
    ) {
      continue;
    }

    return {
      start: next.start,
      end: domain.end,
      pos: domain.pos,
      labels: domain.labels.slice(index),
    };
  }

  return domain;
};

interface BareDomainCandidates {
  readonly parsedDomain: DomainMatch;
  readonly boundaryDomain: DomainMatch;
}

export const parseBareDomainCandidates = (
  meta: TextMeta,
  start: number,
  listedTlds: ReadonlySet<string>,
  asciiTldTargets: ReadonlySet<string>,
): BareDomainCandidates | null => {
  const parsedDomain = parseDomain(meta, start, listedTlds, asciiTldTargets);
  if (!parsedDomain) return null;

  const completedDomain = preferCompletedDomainBeforeSpacedSeparator(
    meta,
    parsedDomain,
    listedTlds,
    asciiTldTargets,
  );
  return {
    parsedDomain,
    boundaryDomain:
      completedDomain === parsedDomain
        ? preferDomainAfterSentence(meta, parsedDomain)
        : completedDomain,
  };
};
