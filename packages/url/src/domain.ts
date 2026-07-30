import { PATH_START_CHARS } from "./chars.js";
import { parseDot } from "./dots.js";
import {
  type DomainMatch,
  type Label,
  type LabelText,
  type TextMeta,
} from "./meta.js";
import { maybeConsumePathTail } from "./path.js";

const MAX_DOMAIN_TEXT_LENGTH = 253;
const MAX_DOMAIN_LABELS = 127;

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

export const parseLabel = (meta: TextMeta, start: number): Label | null => {
  let pos = start;
  while (pos < meta.codePoints.length && meta.labelJoinSeparator[pos]) pos++;
  let first = -1;
  let last = -1;
  let raw = "";
  let skeleton = "";
  const appendLabelText = (text: LabelText): void => {
    raw += text.raw;
    skeleton += text.skeleton;
  };

  while (pos < meta.codePoints.length) {
    if (meta.alphaNum[pos]) {
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
      let gapHasZeroWidth = false;
      let gapHasNonZeroWidthSymbol = false;
      while (pos < meta.codePoints.length && meta.labelJoinSeparator[pos]) {
        gapHasWhitespace ||= meta.whitespace[pos];
        gapHasZeroWidth ||= meta.zeroWidth[pos];
        gapHasNonZeroWidthSymbol ||=
          !meta.zeroWidth[pos] && !meta.whitespace[pos];
        pos++;
      }
      const gapRaw = meta.raw.slice(gapStart, pos).join("");
      if (!gapHasWhitespace && /^-+$/u.test(gapRaw)) {
        appendLabelText({ raw: gapRaw, skeleton: gapRaw });
        if (raw.length > 63) return null;
      }
      // Join only very short whitespace-split pieces. Longer visible runs are
      // usually prose before a normal URL, even if the run contains zero-width.
      if (
        gapHasWhitespace &&
        pos < meta.codePoints.length &&
        meta.alphaNum[pos]
      ) {
        const runLen = measureAlphaNumRun(meta, pos);
        if (runLen > 1) {
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

  if (first < 0 || raw.length === 0 || raw.length > 63) return null;
  return { start: first, end: last + 1, pos, raw, skeleton };
};

const isValidTld = (
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
  let raw = "";
  let skeleton = "";
  let last = -1;
  for (let cursor = label.start; cursor < label.pos; cursor++) {
    const symbol = meta.symbol[cursor];
    const canSplit =
      meta.whitespace[cursor] ||
      meta.zeroWidth[cursor] ||
      symbol === "-" ||
      ((symbol === "'" || symbol === "’") &&
        cursor + 1 < label.pos &&
        meta.skeleton[cursor + 1] === "s" &&
        cursor + 2 === label.pos);
    if (canSplit && raw && isValidTld(raw, skeleton, tldSet, tldSkeletonSet)) {
      return { start: label.start, end: last + 1, pos: cursor, raw, skeleton };
    }
    if (meta.alphaNum[cursor]) {
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

export const parseDomain = (
  meta: TextMeta,
  start: number,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
  { allowUnknownTld = false }: { readonly allowUnknownTld?: boolean } = {},
): DomainMatch | null => {
  const first = parseLabel(meta, start);
  if (!first) return null;

  const labels: Label[] = [first];
  let pos = first.pos;

  while (true) {
    const dot = parseDot(meta, pos);
    if (!dot) break;
    const currentTld = labels[labels.length - 1];
    let afterDot = dot.pos;
    while (afterDot < meta.codePoints.length && meta.zeroWidth[afterDot]) {
      afterDot++;
    }
    if (
      labels.length >= 2 &&
      dot.start >= pos &&
      dot.end === dot.start + 1 &&
      afterDot < meta.codePoints.length &&
      meta.whitespace[afterDot] &&
      (allowUnknownTld ||
        isValidTld(currentTld.raw, currentTld.skeleton, tldSet, tldSkeletonSet))
    ) {
      // `example.com. next` is sentence punctuation after a valid TLD, not a
      // third label that should make the whole candidate fail.
      break;
    }
    const next = parseLabel(meta, dot.pos);
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
      return null;
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
    if (!trimmedTld) return null;
    labels[labels.length - 1] = trimmedTld;
    tld = trimmedTld;
    pos = trimmedTld.pos;
  }

  let end = tld.end;
  let tailStart = pos;
  let afterDot = pos + 1;
  while (afterDot < meta.codePoints.length && meta.zeroWidth[afterDot]) {
    afterDot++;
  }
  if (
    pos < meta.codePoints.length &&
    meta.symbol[pos] === "." &&
    afterDot < meta.codePoints.length &&
    PATH_START_CHARS.has(meta.symbol[afterDot])
  ) {
    end = pos + 1;
    tailStart = pos + 1;
  }

  const pathTail = maybeConsumePathTail(meta, tailStart);
  if (pathTail && pathTail.end > end) {
    end = pathTail.end;
    pos = pathTail.pos;
  }

  return { start: first.start, end, pos, labels };
};
