import { DOT_LITERALS, DOT_WORDS_RAW, DOT_WORDS_SKELETON } from "./chars.js";
import {
  consumeWord,
  matchesRawChars,
  skipTokenSuffixMarks,
  toRawChars,
  toSkeletonChars,
  type Match,
  type TextMeta,
} from "./meta.js";

const DOT_LITERAL_CHARS = DOT_LITERALS.map((literal) => Array.from(literal));
const DOT_WORDS_SKELETON_CHARS = DOT_WORDS_SKELETON.map(toSkeletonChars);
const DOT_WORDS_RAW_CHARS = DOT_WORDS_RAW.map(toRawChars);
const VARIATION_SELECTOR_RE = /^[\u{fe00}-\u{fe0f}\u{e0100}-\u{e01ef}]$/u;

export const isVariationSelectorSymbol = (value: string): boolean =>
  VARIATION_SELECTOR_RE.test(value);

const isVariationSelector = (meta: TextMeta, pos: number): boolean =>
  isVariationSelectorSymbol(meta.codePoints[pos] ?? "");

export const isIgnorableFormatting = (meta: TextMeta, pos: number): boolean =>
  meta.zeroWidth[pos] || isVariationSelector(meta, pos);

// Dot words such as "dot" must stop at a boundary; otherwise normal prose like
// "dotcom" would be split into a fake defanged domain.
const hasDotWordBoundary = (meta: TextMeta, pos: number): boolean =>
  pos >= meta.codePoints.length ||
  meta.labelJoinSeparator[pos] ||
  meta.symbol[pos] === "." ||
  meta.symbol[pos] === "/" ||
  meta.symbol[pos] === "?" ||
  meta.symbol[pos] === "#";

const hasWhitespaceBeyondZeroWidth = (
  meta: TextMeta,
  start: number,
  direction: -1 | 1,
): boolean => {
  let pos = start;
  while (
    pos >= 0 &&
    pos < meta.codePoints.length &&
    isIgnorableFormatting(meta, pos)
  ) {
    pos += direction;
  }
  return pos >= 0 && pos < meta.codePoints.length && meta.whitespace[pos];
};

export const isWhitespaceWrappedDot = (meta: TextMeta, dot: Match): boolean =>
  hasWhitespaceBeyondZeroWidth(meta, dot.start - 1, -1) &&
  hasWhitespaceBeyondZeroWidth(meta, dot.end, 1);

export const isRightSpacedDotSymbol = (meta: TextMeta, dot: Match): boolean =>
  dot.end === dot.start + 1 && hasWhitespaceBeyondZeroWidth(meta, dot.end, 1);

export const isWhitespaceWrappedListBullet = (
  meta: TextMeta,
  dot: Match,
): boolean =>
  dot.end === dot.start + 1 &&
  meta.raw[dot.start] === "•" &&
  isWhitespaceWrappedDot(meta, dot);

export const parseDot = (meta: TextMeta, start: number): Match | null => {
  let pos = start;
  while (
    pos < meta.codePoints.length &&
    (meta.zeroWidth[pos] || meta.whitespace[pos])
  ) {
    pos++;
  }
  // Bracketed dot markers are checked before generic separator skipping so
  // spaced forms like `example [.] com` keep the whole marker.
  for (const literalChars of DOT_LITERAL_CHARS) {
    if (matchesRawChars(meta, pos, literalChars)) {
      const len = literalChars.length;
      return { start: pos, end: pos + len, pos: pos + len };
    }
  }

  while (pos < meta.codePoints.length && meta.labelJoinSeparator[pos]) pos++;
  if (pos >= meta.codePoints.length) return null;

  if (meta.symbol[pos] === ".") {
    return { start: pos, end: pos + 1, pos: pos + 1 };
  }

  for (const word of DOT_WORDS_SKELETON_CHARS) {
    const matched = consumeWord(meta, pos, word, "skeleton");
    if (matched) {
      const suffix = skipTokenSuffixMarks(meta, matched.pos);
      if (suffix.hasWhitespace || hasDotWordBoundary(meta, suffix.pos)) {
        return { ...matched, end: suffix.pos, pos: suffix.pos };
      }
    }
  }
  for (const word of DOT_WORDS_RAW_CHARS) {
    const matched = consumeWord(meta, pos, word, "raw");
    if (matched) {
      const suffix = skipTokenSuffixMarks(meta, matched.pos);
      if (suffix.hasWhitespace || hasDotWordBoundary(meta, suffix.pos)) {
        return { ...matched, end: suffix.pos, pos: suffix.pos };
      }
    }
  }

  return null;
};
