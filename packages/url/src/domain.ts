import { lowerNfkc } from "@textfilters/core";

import {
  COMBINING_MARK_RE,
  isSentenceDotSymbol,
  PATH_START_CHARS,
} from "./chars.js";
import {
  isIgnorableFormatting,
  isRightSpacedDotSymbol,
  isWhitespaceWrappedDot,
  parseDot,
} from "./dots.js";
import {
  type DomainMatch,
  type Label,
  type LabelText,
  type TextMeta,
  toSkeletonFromNormalized,
} from "./meta.js";
import { maybeConsumePathTail } from "./path.js";

const MAX_DOMAIN_TEXT_LENGTH = 253;
const MAX_DOMAIN_LABELS = 127;

const finalizeLabelText = (source: string): LabelText => {
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
  while (pos < meta.codePoints.length && meta.labelJoinSeparator[pos]) pos++;
  let first = -1;
  let last = -1;
  let normalizedLength = 0;
  let sourceText = "";

  while (pos < meta.codePoints.length) {
    const sourceChar = meta.codePoints[pos] ?? "";
    const rawChar = meta.raw[pos];
    const isAttachedMark =
      first >= 0 &&
      !isIgnorableFormatting(meta, pos) &&
      COMBINING_MARK_RE.test(sourceChar);
    if (meta.alphaNum[pos] || isAttachedMark) {
      if (rawChar) {
        if (first < 0) first = pos;
        last = pos;
        sourceText += sourceChar;
        normalizedLength += rawChar.length;
        if (normalizedLength > 63) return null;
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
      while (pos < meta.codePoints.length && meta.labelJoinSeparator[pos]) {
        gapHasWhitespace ||= meta.whitespace[pos];
        gapHasZeroWidth ||= meta.zeroWidth[pos];
        gapHasNonZeroWidthSymbol ||=
          !meta.zeroWidth[pos] && !meta.whitespace[pos];
        if (!meta.zeroWidth[pos] && !meta.whitespace[pos]) {
          visibleGapRaw += meta.raw[pos];
        }
        pos++;
      }
      const gapRaw = meta.raw.slice(gapStart, pos).join("");
      const hasOnlyHostnameJoinSymbols = /^[-_]+$/u.test(visibleGapRaw);
      if (!gapHasWhitespace && /^-+$/u.test(visibleGapRaw)) {
        sourceText += visibleGapRaw;
        normalizedLength += visibleGapRaw.length;
        if (normalizedLength > 63) return null;
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
        gapRaw &&
        !/^-+$/u.test(gapRaw) &&
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

  if (first < 0 || normalizedLength === 0 || normalizedLength > 63) return null;
  const normalized = finalizeLabelText(sourceText);
  if (!normalized.raw || normalized.raw.length > 63) return null;
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
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
  { allowPunycodeLike = true }: { readonly allowPunycodeLike?: boolean } = {},
): boolean => {
  if (!tldRaw) return false;
  if (
    allowPunycodeLike &&
    (tldRaw.startsWith("xn--") || tldSkeleton.startsWith("xn--"))
  ) {
    return true;
  }
  return tldSet.has(tldRaw) || tldSkeletonSet.has(tldSkeleton);
};

const trimTldTrailingProse = (
  meta: TextMeta,
  label: Label,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
): Label | null => {
  let sourceText = "";
  let last = -1;
  for (let cursor = label.start; cursor < label.pos; cursor++) {
    const sourceChar = meta.codePoints[cursor] ?? "";
    const symbol = meta.symbol[cursor];
    const canSplit =
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
          tldSet,
          tldSkeletonSet,
          { allowPunycodeLike: symbol !== "-" },
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
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
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
  // Preserve a valid host when an unrelated whitespace-wrapped dot makes the
  // later candidate invalid.
  let completedBeforeProseSeparator: DomainMatch | null = null;

  while (true) {
    const currentLabel = labels[labels.length - 1];
    if (splitAdjacentDomains && labels.length >= 2 && currentLabel) {
      const trimmedTld = trimTldTrailingProse(
        meta,
        currentLabel,
        tldSet,
        tldSkeletonSet,
      );
      if (
        trimmedTld &&
        hasWhitespaceInLabelSeparatorRun(meta, trimmedTld.pos) &&
        parseDomain(meta, trimmedTld.pos, tldSet, tldSkeletonSet, {
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

    const dot = parseDot(meta, pos);
    if (!dot) break;
    const currentTld = labels[labels.length - 1];
    if (
      !allowUnknownTld &&
      labels.length >= 2 &&
      isValidTld(currentTld.raw, currentTld.skeleton, tldSet, tldSkeletonSet) &&
      (isWhitespaceWrappedDot(meta, dot) || isRightSpacedDotSymbol(meta, dot))
    ) {
      completedBeforeProseSeparator = {
        start: first.start,
        end: currentTld.end,
        pos: currentTld.pos,
        labels: [...labels],
      };
    }
    let afterDot = dot.pos;
    while (
      afterDot < meta.codePoints.length &&
      isIgnorableFormatting(meta, afterDot)
    ) {
      afterDot++;
    }
    if (
      labels.length >= 2 &&
      dot.start >= pos &&
      dot.end === dot.start + 1 &&
      isSentenceDotSymbol(meta.raw[dot.start] ?? "") &&
      afterDot < meta.codePoints.length &&
      meta.whitespace[afterDot] &&
      (allowUnknownTld ||
        isValidTld(currentTld.raw, currentTld.skeleton, tldSet, tldSkeletonSet))
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
    const domainTextLength =
      labels.reduce((length, label) => length + label.raw.length, 0) +
      labels.length -
      1;
    if (
      labels.length > MAX_DOMAIN_LABELS ||
      domainTextLength > MAX_DOMAIN_TEXT_LENGTH
    ) {
      return completedBeforeProseSeparator;
    }
    pos = next.pos;
  }

  if (labels.length < 2) return null;

  let tld = labels[labels.length - 1];
  if (
    !allowUnknownTld &&
    !isValidTld(tld.raw, tld.skeleton, tldSet, tldSkeletonSet)
  ) {
    const trimmedTld = trimTldTrailingProse(meta, tld, tldSet, tldSkeletonSet);
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
