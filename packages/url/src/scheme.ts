import {
  DEFANGED_DELIMITER_PAIRS,
  HTTP_CHARS,
  HTTPS_CHARS,
  HXXP_CHARS,
  HXXPS_CHARS,
} from "./chars.js";
import {
  consumeSymbol,
  consumeWord,
  isTokenDelimiterPadding,
  type Match,
  type TextMeta,
} from "./meta.js";

const consumeBracketedSchemeDelimiter = (
  meta: TextMeta,
  start: number,
): Match | null => {
  let pos = start;
  while (pos < meta.codePoints.length && isTokenDelimiterPadding(meta, pos)) {
    pos++;
  }

  const close = DEFANGED_DELIMITER_PAIRS.get(meta.raw[pos] ?? "");
  if (!close) return null;

  // Accept both `hxxp[:]//host` and `http[://]host` without treating arbitrary
  // bracketed text as a scheme delimiter.
  let cursor = pos + 1;
  let symbols = "";
  while (cursor < meta.codePoints.length) {
    if (meta.raw[cursor] === close) {
      const after = cursor + 1;
      if (symbols === "://") return { start: pos, end: after, pos: after };
      if (symbols === ":") {
        const slashOne = consumeSymbol(meta, after, "/");
        if (!slashOne) return null;
        const slashTwo = consumeSymbol(meta, slashOne.pos, "/");
        if (!slashTwo) return null;
        return { start: pos, end: slashTwo.end, pos: slashTwo.pos };
      }
      return null;
    }

    if (!isTokenDelimiterPadding(meta, cursor)) {
      const symbol = meta.symbol[cursor];
      if (symbol !== ":" && symbol !== "/") return null;
      symbols += symbol;
      if (symbols.length > 3) return null;
    }
    cursor++;
  }

  return null;
};

const consumeSchemeDelimiter = (
  meta: TextMeta,
  start: number,
): Match | null => {
  const bracketed = consumeBracketedSchemeDelimiter(meta, start);
  if (bracketed) return bracketed;

  const colon = consumeSymbol(meta, start, ":");
  if (!colon) return null;
  const slashOne = consumeSymbol(meta, colon.pos, "/");
  if (!slashOne) return null;
  const slashTwo = consumeSymbol(meta, slashOne.pos, "/");
  if (!slashTwo) return null;

  return { start: colon.start, end: slashTwo.end, pos: slashTwo.pos };
};

const consumeSchemeSuffixS = (meta: TextMeta, start: number): Match | null => {
  let pos = start;
  while (pos < meta.codePoints.length && isTokenDelimiterPadding(meta, pos)) {
    pos++;
  }
  if (pos >= meta.codePoints.length || meta.skeleton[pos] !== "s") return null;
  // The optional `s` is only part of the scheme when the delimiter follows it;
  // otherwise `http://secure...` would steal the host's first letter.
  if (!consumeSchemeDelimiter(meta, pos + 1)) return null;
  return { start: pos, end: pos + 1, pos: pos + 1 };
};

export const parseSchemePrefix = (
  meta: TextMeta,
  start: number,
): Match | null => {
  const secure =
    consumeWord(meta, start, HTTPS_CHARS, "skeleton") ??
    consumeWord(meta, start, HXXPS_CHARS, "skeleton");
  if (secure) {
    const delimiter = consumeSchemeDelimiter(meta, secure.pos);
    if (delimiter) {
      return { start: secure.start, end: delimiter.end, pos: delimiter.pos };
    }
  }

  const base =
    consumeWord(meta, start, HTTP_CHARS, "skeleton") ??
    consumeWord(meta, start, HXXP_CHARS, "skeleton");
  if (!base) return null;

  let pos = base.pos;
  const maybeS = consumeSchemeSuffixS(meta, pos);
  if (maybeS) pos = maybeS.pos;

  const delimiter = consumeSchemeDelimiter(meta, pos);
  if (!delimiter) return null;

  return { start: base.start, end: delimiter.end, pos: delimiter.pos };
};
