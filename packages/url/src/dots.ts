import {
  DOT_LITERALS,
  DOT_WORDS_RAW,
  DOT_WORDS_SKELETON,
  isProseListSeparatorDotSymbol,
  isSentenceCloserSymbol,
  isSentenceDotSymbol,
} from "./chars.js";
import {
  consumeWord,
  matchesRawChars,
  toRawChars,
  toSkeletonChars,
  type Match,
  type TextMeta,
} from "./meta.js";

const DOT_LITERAL_CHARS = DOT_LITERALS.map((literal) => Array.from(literal));
const DOT_WORDS_SKELETON_CHARS = DOT_WORDS_SKELETON.map(toSkeletonChars);
const DOT_WORDS_RAW_CHARS = DOT_WORDS_RAW.map(toRawChars);
const VARIATION_SELECTOR_RE = /^[\u{fe00}-\u{fe0f}\u{e0100}-\u{e01ef}]$/u;

const isVariationSelector = (meta: TextMeta, pos: number): boolean =>
  VARIATION_SELECTOR_RE.test(meta.codePoints[pos] ?? "");

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

export const isRightSpacedSentenceDot = (
  meta: TextMeta,
  dot: Match,
  before: number = meta.codePoints.length,
): boolean => {
  if (
    dot.end !== dot.start + 1 ||
    !isSentenceDotSymbol(meta.raw[dot.start] ?? "")
  ) {
    return false;
  }

  let pos = dot.end;
  while (
    pos < before &&
    (isIgnorableFormatting(meta, pos) ||
      isSentenceCloserSymbol(meta.raw[pos] ?? ""))
  ) {
    pos++;
  }
  return pos < before && (meta.whitespace[pos] ?? false);
};

const previousVisibleSymbol = (meta: TextMeta, start: number): number => {
  let pos = start;
  while (pos >= 0 && (meta.whitespace[pos] || isIgnorableFormatting(meta, pos)))
    pos--;
  return pos;
};

const isBracketedDotAt = (meta: TextMeta, pos: number): boolean => {
  const before = previousVisibleSymbol(meta, pos - 1);
  let after = pos + 1;
  while (
    after < meta.codePoints.length &&
    (meta.whitespace[after] || isIgnorableFormatting(meta, after))
  )
    after++;
  return DOT_LITERAL_CHARS.some(
    (chars) =>
      meta.raw[before] === chars[0] &&
      meta.raw[after] === chars[chars.length - 1],
  );
};

// Inspect punctuation itself, not a caller's approximation of a host-label end.
// The first literal sentence dot owns its entire punctuation run; later dots
// stop at the previous one instead of rescanning the same suffix.
export const isClosedSentenceBoundary = (
  meta: TextMeta,
  dot: Match,
): boolean => {
  if (
    dot.end !== dot.start + 1 ||
    !isSentenceDotSymbol(meta.raw[dot.start] ?? "") ||
    isBracketedDotAt(meta, dot.start)
  ) {
    return false;
  }

  let hasCloser = false;
  for (let pos = dot.start - 1; pos >= 0; pos--) {
    const raw = meta.raw[pos] ?? "";
    if (isSentenceDotSymbol(raw)) return false;
    if (isSentenceCloserSymbol(raw)) {
      // A bracketed dot is one URL token; its closing bracket is not prose.
      const before = previousVisibleSymbol(meta, pos - 1);
      if (meta.symbol[before] === "." && isBracketedDotAt(meta, before)) {
        break;
      }
      hasCloser = true;
    } else if (!meta.whitespace[pos] && !isIgnorableFormatting(meta, pos)) {
      break;
    }
  }

  let hasRightWhitespace = false;
  for (let pos = dot.end; pos < meta.codePoints.length; pos++) {
    if (isSentenceCloserSymbol(meta.raw[pos] ?? "")) hasCloser = true;
    else if (meta.whitespace[pos]) hasRightWhitespace = true;
    else if (
      !isSentenceDotSymbol(meta.raw[pos] ?? "") &&
      !isIgnorableFormatting(meta, pos)
    )
      break;
  }
  return hasCloser && hasRightWhitespace;
};

export const isWhitespaceWrappedListSeparator = (
  meta: TextMeta,
  dot: Match,
): boolean =>
  dot.end === dot.start + 1 &&
  isProseListSeparatorDotSymbol(meta.raw[dot.start] ?? "") &&
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

  let visibleJoiners = 0;
  while (pos < meta.codePoints.length && meta.labelJoinSeparator[pos]) {
    if (!meta.zeroWidth[pos] && !meta.whitespace[pos]) {
      visibleJoiners++;
      if (visibleJoiners > 1) return null;
    }
    pos++;
  }
  if (pos >= meta.codePoints.length) return null;

  if (meta.symbol[pos] === ".") {
    return { start: pos, end: pos + 1, pos: pos + 1 };
  }
  if (
    meta.symbol[pos] === "/" ||
    meta.symbol[pos] === ":" ||
    meta.symbol[pos] === "?" ||
    meta.symbol[pos] === "#"
  ) {
    return null;
  }

  for (const word of DOT_WORDS_SKELETON_CHARS) {
    const matched = consumeWord(meta, pos, word, "skeleton");
    if (matched && hasDotWordBoundary(meta, matched.pos)) return matched;
  }
  for (const word of DOT_WORDS_RAW_CHARS) {
    const matched = consumeWord(meta, pos, word, "raw");
    if (matched && hasDotWordBoundary(meta, matched.pos)) return matched;
  }

  return null;
};
