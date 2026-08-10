import {
  AUTHORITY_GLUED_PROSE_CHARS,
  AUTHORITY_TRAILING_CHARS,
  PATH_START_CHARS,
} from "./chars.js";
import { parseDot } from "./dots.js";
import type { TextMeta } from "./meta.js";

const isOnlyBracketedHostClose = (
  meta: TextMeta,
  authorityStart: number,
  closeIndex: number,
): boolean => {
  let hostStart = authorityStart;
  for (let cursor = authorityStart; cursor < closeIndex; cursor++) {
    if (meta.symbol[cursor] === "@") hostStart = cursor + 1;
  }
  if (meta.symbol[hostStart] !== "[") return false;
  for (let cursor = hostStart + 1; cursor < closeIndex; cursor++) {
    if (meta.symbol[cursor] === "]") return false;
  }
  return true;
};

const isBracketedHostOpen = (
  meta: TextMeta,
  authorityStart: number,
  openIndex: number,
  authorityEnd: number,
): boolean => {
  let hostStart = authorityStart;
  for (let cursor = authorityStart; cursor < openIndex; cursor++) {
    if (meta.symbol[cursor] === "@") hostStart = cursor + 1;
  }
  if (openIndex !== hostStart) return false;
  let hasColon = false;
  for (let cursor = openIndex + 1; cursor < authorityEnd; cursor++) {
    if (meta.symbol[cursor] === ":") hasColon = true;
    if (meta.symbol[cursor] === "]") return hasColon;
  }
  return false;
};

const hasAuthorityAtAfter = (
  meta: TextMeta,
  start: number,
  end: number,
): boolean => {
  for (let cursor = start; cursor < end; cursor++) {
    if (meta.symbol[cursor] === "@") return true;
  }
  return false;
};

const isInsideBracketedHost = (
  meta: TextMeta,
  start: number,
  cursor: number,
): boolean => {
  let depth = 0;
  for (let pos = start; pos < cursor; pos++) {
    if (meta.symbol[pos] === "[") depth++;
    if (meta.symbol[pos] === "]" && depth > 0) depth--;
  }
  return depth > 0;
};

const nextNonZeroWidth = (
  meta: TextMeta,
  start: number,
  end: number,
): number => {
  let pos = start;
  while (pos < end && meta.zeroWidth[pos]) pos++;
  return pos;
};

const previousNonZeroWidth = (
  meta: TextMeta,
  start: number,
  end: number,
): number => {
  let pos = end - 1;
  while (pos >= start && meta.zeroWidth[pos]) pos--;
  return pos;
};

const hasDotMarkerAfterRun = (
  meta: TextMeta,
  start: number,
  end: number,
): boolean => {
  let cursor = start;
  while (cursor < end && meta.alphaNum[cursor]) cursor++;
  const dot = parseDot(meta, cursor);
  return dot !== null && dot.start < end;
};

export const splitGluedPortProse = (
  meta: TextMeta,
  start: number,
  end: number,
): number => {
  for (let cursor = start; cursor < end; cursor++) {
    if (
      meta.symbol[cursor] !== ":" ||
      isInsideBracketedHost(meta, start, cursor)
    ) {
      continue;
    }
    let portEnd = cursor + 1;
    let hasPortDigit = false;
    while (portEnd < end) {
      if (meta.zeroWidth[portEnd]) {
        portEnd++;
        continue;
      }
      if (!/^[0-9]$/u.test(meta.raw[portEnd])) break;
      hasPortDigit = true;
      portEnd++;
    }
    if (
      hasPortDigit &&
      portEnd < end &&
      !PATH_START_CHARS.has(meta.symbol[portEnd]) &&
      !hasAuthorityAtAfter(meta, portEnd, end)
    ) {
      return portEnd;
    }
  }
  return end;
};

export const trimZeroWidthBeforeTail = (
  meta: TextMeta,
  start: number,
  end: number,
): number => {
  let cursor = end;
  while (cursor > start && meta.zeroWidth[cursor - 1]) cursor--;
  if (
    cursor < end &&
    end < meta.codePoints.length &&
    (meta.symbol[end] === "/" ||
      meta.symbol[end] === "?" ||
      meta.symbol[end] === "#")
  ) {
    return cursor;
  }
  return end;
};

export const startsWithSpacedHostMarker = (
  meta: TextMeta,
  start: number,
): boolean => {
  const isPathLikeTail = (pos: number): boolean =>
    pos < meta.codePoints.length &&
    (meta.symbol[pos] === "/" ||
      meta.symbol[pos] === "?" ||
      meta.symbol[pos] === "#");

  let pos = start;
  while (
    pos < meta.codePoints.length &&
    (meta.zeroWidth[pos] || meta.whitespace[pos])
  ) {
    pos++;
  }
  const markerHasLeadingSeparator = pos > start;
  if (pos >= meta.codePoints.length || meta.symbol[pos] !== ".") return false;
  pos++;
  while (
    pos < meta.codePoints.length &&
    (meta.zeroWidth[pos] || meta.whitespace[pos])
  ) {
    pos++;
  }

  let runLength = 0;
  while (pos < meta.codePoints.length) {
    if (meta.zeroWidth[pos]) {
      pos++;
      continue;
    }
    if (!meta.alphaNum[pos]) break;
    runLength++;
    pos++;
  }
  if (runLength === 0) return false;
  if (!markerHasLeadingSeparator && runLength <= 3 && !isPathLikeTail(pos)) {
    return false;
  }
  if (runLength > 3) {
    while (
      pos < meta.codePoints.length &&
      (meta.zeroWidth[pos] || meta.whitespace[pos])
    ) {
      pos++;
    }
    return isPathLikeTail(pos);
  }
  return (
    pos >= meta.codePoints.length || meta.whitespace[pos] || isPathLikeTail(pos)
  );
};

export const startsWithShortSpacedLabelContinuation = (
  meta: TextMeta,
  start: number,
): boolean => {
  let pos = start;
  while (
    pos < meta.codePoints.length &&
    (meta.zeroWidth[pos] || meta.whitespace[pos])
  ) {
    pos++;
  }
  let runLength = 0;
  while (pos < meta.codePoints.length) {
    if (meta.zeroWidth[pos]) {
      pos++;
      continue;
    }
    if (!meta.alphaNum[pos]) break;
    runLength++;
    pos++;
  }
  if (runLength === 0 || runLength > 3) return false;
  return (
    pos < meta.codePoints.length &&
    (meta.symbol[pos] === "." ||
      meta.symbol[pos] === "/" ||
      meta.symbol[pos] === "?" ||
      meta.symbol[pos] === "#")
  );
};

export const startsWithDefangedDotContinuation = (
  meta: TextMeta,
  start: number,
): boolean => {
  const dot = parseDot(meta, start);
  if (!dot || dot.end <= dot.start + 1) return false;
  let pos = dot.pos;
  while (
    pos < meta.codePoints.length &&
    (meta.zeroWidth[pos] || meta.whitespace[pos])
  ) {
    pos++;
  }
  return pos < meta.codePoints.length && meta.alphaNum[pos];
};

export const trimGluedProseFromAuthority = (
  meta: TextMeta,
  start: number,
  end: number,
): number => {
  let hasColonBeforeCursor = false;
  for (let cursor = start; cursor + 1 < end; cursor++) {
    hasColonBeforeCursor ||= meta.raw[cursor] === ":";
    const next = nextNonZeroWidth(meta, cursor + 1, end);
    if (
      meta.zeroWidth[cursor] &&
      next < end &&
      meta.alphaNum[next] &&
      meta.symbol[previousNonZeroWidth(meta, start, cursor)] !== "." &&
      !/^[0-9]$/u.test(meta.raw[next]) &&
      !hasDotMarkerAfterRun(meta, next, end) &&
      !hasAuthorityAtAfter(meta, next, end)
    ) {
      return cursor;
    }
    if (
      meta.symbol[cursor] === "]" &&
      next < end &&
      meta.alphaNum[next] &&
      !hasAuthorityAtAfter(meta, next, end)
    ) {
      return isOnlyBracketedHostClose(meta, start, cursor)
        ? cursor + 1
        : cursor;
    }
    if (
      (meta.symbol[cursor] === '"' ||
        meta.symbol[cursor] === "'" ||
        meta.symbol[cursor] === "`" ||
        meta.symbol[cursor] === "”" ||
        meta.symbol[cursor] === "’" ||
        meta.symbol[cursor] === "»" ||
        meta.symbol[cursor] === "“" ||
        meta.symbol[cursor] === "‘" ||
        meta.symbol[cursor] === "«") &&
      next < end &&
      meta.alphaNum[next] &&
      !hasAuthorityAtAfter(meta, next, end)
    ) {
      return cursor;
    }
    if (meta.symbol[cursor] === ".") {
      const previous = previousNonZeroWidth(meta, start, cursor);
      if (
        next < end &&
        meta.alphaNum[next] &&
        !hasAuthorityAtAfter(meta, next, end) &&
        (meta.symbol[previous] === "]" ||
          (meta.raw[previous] !== undefined &&
            /^[0-9]$/u.test(meta.raw[previous]) &&
            hasColonBeforeCursor))
      ) {
        return cursor;
      }
      continue;
    }
    if (
      meta.symbol[cursor] === ":" &&
      next < end &&
      !/^[0-9]$/u.test(meta.raw[next]) &&
      meta.symbol[next] !== "/" &&
      meta.symbol[next] !== "?" &&
      meta.symbol[next] !== "#" &&
      !isInsideBracketedHost(meta, start, cursor) &&
      !hasAuthorityAtAfter(meta, next, end)
    ) {
      return cursor;
    }
    if (
      AUTHORITY_GLUED_PROSE_CHARS.has(meta.symbol[cursor]) &&
      next < end &&
      meta.alphaNum[next] &&
      !(meta.symbol[cursor] === ":" && /^[0-9]$/u.test(meta.raw[next])) &&
      !(
        meta.symbol[cursor] === ":" &&
        isInsideBracketedHost(meta, start, cursor)
      ) &&
      !hasAuthorityAtAfter(meta, next, end)
    ) {
      return cursor;
    }
    if (
      (meta.symbol[cursor] === "(" ||
        meta.symbol[cursor] === "[" ||
        meta.symbol[cursor] === "{" ||
        meta.symbol[cursor] === "<") &&
      next < end &&
      meta.alphaNum[next] &&
      !isInsideBracketedHost(meta, start, cursor) &&
      !isBracketedHostOpen(meta, start, cursor, end) &&
      !hasAuthorityAtAfter(meta, next, end)
    ) {
      return cursor;
    }
  }
  return end;
};

export const trimAuthorityTrailingNoise = (
  meta: TextMeta,
  start: number,
  end: number,
  hasFollowingPathTail: boolean,
): number => {
  let authorityEnd = end;
  while (authorityEnd > start) {
    let cursor = authorityEnd;
    while (cursor > start && meta.zeroWidth[cursor - 1]) cursor--;
    const trailing = meta.symbol[cursor - 1];
    if (
      cursor > start &&
      AUTHORITY_TRAILING_CHARS.has(trailing) &&
      !(
        trailing === "]" && isOnlyBracketedHostClose(meta, start, cursor - 1)
      ) &&
      !(
        hasFollowingPathTail &&
        (trailing === "." || trailing === "]" || trailing === ":")
      )
    ) {
      authorityEnd = cursor - 1;
      continue;
    }
    return cursor;
  }
  return authorityEnd;
};
