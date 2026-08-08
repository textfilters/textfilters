import { lowerNfkc } from "@textfilters/core";

import {
  isSentenceDotSymbol,
  PATH_START_CHARS,
  UNICODE_MARK_RE,
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
  toSkeleton,
} from "./meta.js";
import { maybeConsumePathTail } from "./path.js";
import { DEFAULT_TLD_CONTINUATIONS, DEFAULT_TLD_SET } from "./tlds.js";

const MAX_DOMAIN_TEXT_LENGTH = 253;
const MAX_DOMAIN_LABELS = 127;
const ASCII_ONLY_RE = /^[A-Za-z0-9-]+$/u;
const ENGLISH_CONTRACTION_SUFFIXES = [
  "re",
  "ve",
  "ll",
  "s",
  "d",
  "m",
  "t",
] as const;
const DEFAULT_TLD_CONTINUATION_SET: ReadonlySet<string> = new Set(
  DEFAULT_TLD_CONTINUATIONS,
);

// Zero-width marks are host obfuscation, not prose boundaries; measure visible
// runs through them before deciding whether a whitespace gap belongs to a host.
const measureLabelRun = (meta: TextMeta, start: number): number => {
  let cursor = start;
  let runLen = 0;
  while (cursor < meta.codePoints.length) {
    if (isIgnorableFormatting(meta, cursor)) {
      cursor++;
      continue;
    }
    if (!meta.labelChar[cursor]) break;
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
  while (
    pos < meta.codePoints.length &&
    (meta.labelJoinSeparator[pos] ||
      UNICODE_MARK_RE.test(meta.codePoints[pos] ?? ""))
  ) {
    pos++;
  }
  let first = -1;
  let last = -1;
  let raw = "";
  let skeleton = "";
  const appendLabelText = (text: LabelText): void => {
    raw += text.raw;
    skeleton += text.skeleton;
  };

  while (pos < meta.codePoints.length) {
    if (meta.labelChar[pos]) {
      const rawChar = meta.raw[pos];
      if (rawChar) {
        if (first < 0) first = pos;
        last = pos;
        appendLabelText({ raw: rawChar, skeleton: meta.skeleton[pos] });
        if (raw.length > 63) return null;
      }
      pos++;
      continue;
    }

    if (meta.labelJoinSeparator[pos]) {
      const gapStart = pos;
      let gapHasWhitespace = false;
      let gapHasIgnorableFormatting = false;
      let gapHasNonZeroWidthSymbol = false;
      let visibleGapRaw = "";
      while (pos < meta.codePoints.length && meta.labelJoinSeparator[pos]) {
        const gapSymbolIsIgnorable = isIgnorableFormatting(meta, pos);
        gapHasWhitespace ||= meta.whitespace[pos];
        gapHasIgnorableFormatting ||= gapSymbolIsIgnorable;
        gapHasNonZeroWidthSymbol ||=
          !gapSymbolIsIgnorable && !meta.whitespace[pos];
        if (!gapSymbolIsIgnorable && !meta.whitespace[pos]) {
          visibleGapRaw += meta.raw[pos];
        }
        pos++;
      }
      const gapRaw = meta.raw.slice(gapStart, pos).join("");
      const hasOnlyHostnameJoinSymbols = /^[-_]+$/u.test(visibleGapRaw);
      if (!gapHasWhitespace && /^-+$/u.test(visibleGapRaw)) {
        appendLabelText({ raw: visibleGapRaw, skeleton: visibleGapRaw });
        if (raw.length > 63) return null;
      }
      // Join only very short whitespace-split pieces. Longer visible runs are
      // usually prose before a normal URL, even if the run contains zero-width.
      if (
        gapHasWhitespace &&
        pos < meta.codePoints.length &&
        meta.labelChar[pos]
      ) {
        const runLen = measureLabelRun(meta, pos);
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
        gapHasIgnorableFormatting &&
        gapHasNonZeroWidthSymbol &&
        !hasOnlyHostnameJoinSymbols &&
        pos < meta.codePoints.length &&
        meta.labelChar[pos]
      ) {
        pos = gapStart;
        break;
      }

      if (
        !gapHasWhitespace &&
        !gapHasIgnorableFormatting &&
        gapRaw &&
        !/^-+$/u.test(gapRaw) &&
        pos < meta.codePoints.length &&
        meta.labelChar[pos]
      ) {
        const runLen = measureLabelRun(meta, pos);
        if (runLen > 1) {
          pos = gapStart;
          break;
        }
      }

      if (pos < meta.codePoints.length && meta.labelChar[pos]) {
        continue;
      }
      pos = gapStart;
    }

    break;
  }

  if (first < 0 || raw.length === 0 || raw.length > 63) return null;
  return { start: first, end: last + 1, pos, raw, skeleton };
};

export const isValidTld = (
  tldRaw: string,
  tldSkeleton: string,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
): boolean => {
  const normalizedRaw = lowerNfkc(tldRaw);
  const normalizedSkeleton = toSkeleton(normalizedRaw);
  if (!normalizedRaw) return false;
  if (
    normalizedRaw.startsWith("xn--") ||
    normalizedSkeleton.startsWith("xn--")
  ) {
    return true;
  }
  if (tldSet.has(normalizedRaw)) return true;
  if (
    ASCII_ONLY_RE.test(normalizedRaw) &&
    normalizedRaw === normalizedSkeleton
  ) {
    return false;
  }
  return (
    tldSkeletonSet.has(normalizedSkeleton) || tldSkeletonSet.has(tldSkeleton)
  );
};

export const consumeEnglishContractionSuffix = (
  meta: TextMeta,
  start: number,
  limit: number = meta.codePoints.length,
): number => {
  if (meta.raw[start] !== "'" && meta.raw[start] !== "’") return start;

  for (const suffix of ENGLISH_CONTRACTION_SUFFIXES) {
    const suffixChars = Array.from(suffix);
    const end = start + 1 + suffixChars.length;
    if (end > limit) continue;
    if (
      suffixChars.every(
        (expected, index) => meta.skeleton[start + 1 + index] === expected,
      ) &&
      (end === limit || !meta.alphaNum[end])
    ) {
      return end;
    }
  }

  return start;
};

const trimTldTrailingProse = (
  meta: TextMeta,
  label: Label,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
): Label | null => {
  let raw = "";
  let skeleton = "";
  let last = -1;
  for (let cursor = label.start; cursor < label.pos; cursor++) {
    const symbol = meta.symbol[cursor];
    const contractionEnd = consumeEnglishContractionSuffix(
      meta,
      cursor,
      label.pos,
    );
    const canSplit =
      meta.whitespace[cursor] ||
      isIgnorableFormatting(meta, cursor) ||
      UNICODE_MARK_RE.test(meta.raw[cursor] ?? "") ||
      symbol === "-" ||
      contractionEnd === label.pos;
    if (canSplit && raw && isValidTld(raw, skeleton, tldSet, tldSkeletonSet)) {
      return { start: label.start, end: last + 1, pos: cursor, raw, skeleton };
    }
    if (meta.labelChar[cursor]) {
      raw += meta.raw[cursor];
      skeleton += meta.skeleton[cursor];
      last = cursor;
      continue;
    }
    if (symbol === "-" && !meta.whitespace[cursor] && !meta.zeroWidth[cursor]) {
      raw += meta.raw[cursor];
      skeleton += meta.raw[cursor];
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
    forceContinuationDotAt,
    allowUnknownTld = false,
    joinSingleCharacterWhitespaceRuns = true,
    preferCompletedDomainBeforeProseSeparator = tldSet === DEFAULT_TLD_SET,
    splitAdjacentDomains = true,
  }: {
    readonly forceContinuationDotAt?: number;
    readonly allowUnknownTld?: boolean;
    readonly joinSingleCharacterWhitespaceRuns?: boolean;
    readonly preferCompletedDomainBeforeProseSeparator?: boolean;
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
      dot.start !== forceContinuationDotAt &&
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

  const continuationDot = completedBeforeProseSeparator
    ? parseDot(meta, completedBeforeProseSeparator.pos)
    : null;
  const hasExplicitContinuationMarker =
    continuationDot !== null && continuationDot.end > continuationDot.start + 1;
  if (
    preferCompletedDomainBeforeProseSeparator &&
    completedBeforeProseSeparator &&
    !hasExplicitContinuationMarker &&
    labels.length === completedBeforeProseSeparator.labels.length + 1 &&
    end === tld.end &&
    !DEFAULT_TLD_CONTINUATION_SET.has(tld.raw) &&
    !DEFAULT_TLD_CONTINUATION_SET.has(tld.skeleton)
  ) {
    return completedBeforeProseSeparator;
  }

  return { start: first.start, end, pos, labels };
};
