import { isSentenceDotSymbol, PATH_START_CHARS } from "./chars.js";
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
import { normalizeHostText } from "./host-normalization.js";
import { maybeConsumePathTail } from "./path.js";

const MAX_DOMAIN_TEXT_LENGTH = 253;
const MAX_DOMAIN_LABELS = 127;
const MAX_LABEL_NORMALIZATION_SOURCE_LENGTH = 63 * 8;
const LABEL_MARK_RE = /\p{M}/u;

const isAsciiSourceText = (value: string): boolean => {
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) > 0x7f) return false;
  }
  return true;
};

const isLabelMark = (meta: TextMeta, pos: number): boolean =>
  !isIgnorableFormatting(meta, pos) &&
  LABEL_MARK_RE.test(meta.codePoints[pos] ?? "");

const normalizeLabelText = (source: string): LabelText => {
  const raw = normalizeHostText(source);
  return { raw, skeleton: toSkeleton(raw) };
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
  let raw = "";
  let skeleton = "";
  let normalizationSource: string | null = null;
  let normalizationSourceLength = 0;
  let nextNormalizationLengthCheck = 64;
  const appendLabelText = (text: LabelText, sourceText: string): void => {
    const previousRaw = raw;
    raw += text.raw;
    skeleton += text.skeleton;
    if (normalizationSource !== null) {
      normalizationSource += sourceText;
      normalizationSourceLength += Array.from(sourceText).length;
    } else if (!isAsciiSourceText(sourceText)) {
      normalizationSource = previousRaw + sourceText;
      normalizationSourceLength =
        previousRaw.length + Array.from(sourceText).length;
    }
  };
  const exceedsLabelLength = (): boolean => {
    if (normalizationSource === null) return raw.length > 63;
    if (normalizationSourceLength > MAX_LABEL_NORMALIZATION_SOURCE_LENGTH) {
      return true;
    }
    if (normalizationSourceLength < nextNormalizationLengthCheck) return false;
    nextNormalizationLengthCheck += 64;
    return Array.from(normalizeHostText(normalizationSource)).length > 63;
  };

  while (pos < meta.codePoints.length) {
    if (meta.alphaNum[pos] || (first >= 0 && isLabelMark(meta, pos))) {
      const rawChar = meta.raw[pos];
      const sourceChar = meta.codePoints[pos] ?? "";
      if (rawChar) {
        if (first < 0) first = pos;
        last = pos;
        appendLabelText(
          { raw: rawChar, skeleton: meta.skeleton[pos] },
          sourceChar,
        );
        if (exceedsLabelLength()) return null;
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
      while (
        pos < meta.codePoints.length &&
        meta.labelJoinSeparator[pos] &&
        !isLabelMark(meta, pos)
      ) {
        const ignorableFormatting = isIgnorableFormatting(meta, pos);
        gapHasWhitespace ||= meta.whitespace[pos];
        gapHasIgnorableFormatting ||= ignorableFormatting;
        gapHasNonZeroWidthSymbol ||=
          !ignorableFormatting && !meta.whitespace[pos];
        if (!ignorableFormatting && !meta.whitespace[pos]) {
          visibleGapRaw += meta.raw[pos];
        }
        pos++;
      }
      const gapRaw = meta.raw.slice(gapStart, pos).join("");
      const hasOnlyHostnameJoinSymbols = /^[-_]+$/u.test(visibleGapRaw);
      if (
        first >= 0 &&
        pos < meta.codePoints.length &&
        isLabelMark(meta, pos) &&
        !gapHasWhitespace &&
        !gapHasNonZeroWidthSymbol
      ) {
        continue;
      }
      if (!gapHasWhitespace && /^-+$/u.test(visibleGapRaw)) {
        appendLabelText(
          { raw: visibleGapRaw, skeleton: visibleGapRaw },
          visibleGapRaw,
        );
        if (exceedsLabelLength()) return null;
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

      // Ignorable formatting followed by punctuation should split at the valid
      // TLD instead of appending glued prose such as `,next` to the label.
      if (
        gapHasIgnorableFormatting &&
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
        !gapHasIgnorableFormatting &&
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

  const normalized =
    normalizationSource === null
      ? { raw, skeleton }
      : normalizeLabelText(normalizationSource);
  if (
    first < 0 ||
    normalized.raw.length === 0 ||
    Array.from(normalized.raw).length > 63
  ) {
    return null;
  }
  return { start: first, end: last + 1, pos, ...normalized };
};

export const isValidTld = (
  tldRaw: string,
  tldSkeleton: string,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
): boolean => {
  if (!tldRaw) return false;
  if (tldRaw.startsWith("xn--") || tldSkeleton.startsWith("xn--")) {
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
  let source = "";
  let last = -1;
  let markSplitCandidate: Label | null = null;
  for (let cursor = label.start; cursor < label.pos; cursor++) {
    const symbol = meta.symbol[cursor];
    const labelMark = isLabelMark(meta, cursor);
    const canSplit =
      meta.whitespace[cursor] ||
      isIgnorableFormatting(meta, cursor) ||
      labelMark ||
      symbol === "-" ||
      ((symbol === "'" || symbol === "’") &&
        cursor + 1 < label.pos &&
        meta.skeleton[cursor + 1] === "s" &&
        cursor + 2 === label.pos);
    if (canSplit && source) {
      const normalized = normalizeLabelText(source);
      if (
        isValidTld(normalized.raw, normalized.skeleton, tldSet, tldSkeletonSet)
      ) {
        const candidate: Label = {
          start: label.start,
          end: last + 1,
          pos: cursor,
          ...normalized,
          ...(labelMark ? { hasUnconsumedLabelMark: true } : {}),
        };
        if (!labelMark) return candidate;
        markSplitCandidate = candidate;
      }
    }
    if (meta.alphaNum[cursor] || labelMark) {
      source += meta.codePoints[cursor] ?? "";
      last = cursor;
      continue;
    }
    if (symbol === "-" && !meta.whitespace[cursor] && !meta.zeroWidth[cursor]) {
      source += meta.raw[cursor] ?? "";
      last = cursor;
    }
  }
  return markSplitCandidate;
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
    stopAtSentenceDot = true,
  }: {
    readonly allowUnknownTld?: boolean;
    readonly joinSingleCharacterWhitespaceRuns?: boolean;
    readonly splitAdjacentDomains?: boolean;
    readonly stopAtSentenceDot?: boolean;
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
          stopAtSentenceDot,
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
      stopAtSentenceDot &&
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
