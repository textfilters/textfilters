import {
  AUTHORITY_GLUED_PROSE_CHARS,
  AUTHORITY_TRAILING_CHARS,
  PATH_START_CHARS,
} from "./chars.js";
import { parseDot } from "./dots.js";
import type { TextMeta } from "./meta.js";

const collectOnlyBracketedHostCloses = (
  meta: TextMeta,
  authorityStart: number,
  authorityEnd: number,
): ReadonlySet<number> => {
  const closes = new Set<number>();
  let hostStart = authorityStart;
  let sawHostClose = false;
  for (let cursor = authorityStart; cursor < authorityEnd; cursor++) {
    if (meta.symbol[cursor] === "@") {
      hostStart = cursor + 1;
      sawHostClose = false;
      continue;
    }
    if (meta.symbol[cursor] !== "]") continue;
    if (meta.symbol[hostStart] === "[" && !sawHostClose) closes.add(cursor);
    sawHostClose = true;
  }
  return closes;
};

const findLastAuthorityAt = (
  meta: TextMeta,
  start: number,
  end: number,
): number => {
  for (let cursor = end - 1; cursor >= start; cursor--) {
    if (meta.symbol[cursor] === "@") return cursor;
  }
  return -1;
};

const isBracketedHostOpen = (
  meta: TextMeta,
  hostStart: number,
  openIndex: number,
  authorityEnd: number,
): boolean => {
  if (openIndex !== hostStart) return false;
  let hasColon = false;
  for (let cursor = openIndex + 1; cursor < authorityEnd; cursor++) {
    if (meta.symbol[cursor] === ":") hasColon = true;
    if (meta.symbol[cursor] === "]") return hasColon;
  }
  return false;
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
  const lastAuthorityAt = findLastAuthorityAt(meta, start, end);
  let bracketDepth = 0;
  for (let cursor = start; cursor < end; cursor++) {
    const symbol = meta.symbol[cursor];
    if (symbol === ":" && bracketDepth === 0) {
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
        lastAuthorityAt < portEnd
      ) {
        return portEnd;
      }
    }
    if (symbol === "[") bracketDepth++;
    if (symbol === "]" && bracketDepth > 0) bracketDepth--;
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
  const lastAuthorityAt = findLastAuthorityAt(meta, start, end);
  let hasColonBeforeCursor = false;
  let bracketDepth = 0;
  let hostStart = start;
  let sawHostClose = false;
  let previousVisible = start - 1;
  let nextVisible = start;
  let cachedRunStart = -1;
  let cachedRunHasDot = false;
  const hasCachedDotMarkerAfterRun = (runStart: number): boolean => {
    if (cachedRunStart !== runStart) {
      cachedRunStart = runStart;
      cachedRunHasDot = hasDotMarkerAfterRun(meta, runStart, end);
    }
    return cachedRunHasDot;
  };
  for (let cursor = start; cursor + 1 < end; cursor++) {
    const symbol = meta.symbol[cursor];
    hasColonBeforeCursor ||= meta.raw[cursor] === ":";
    if (nextVisible <= cursor) {
      nextVisible = cursor + 1;
      while (nextVisible < end && meta.zeroWidth[nextVisible]) nextVisible++;
    }
    const next = nextVisible;
    const hasAuthorityAtAfterNext = lastAuthorityAt >= next;
    if (
      meta.zeroWidth[cursor] &&
      next < end &&
      meta.alphaNum[next] &&
      meta.symbol[previousVisible] !== "." &&
      !/^[0-9]$/u.test(meta.raw[next]) &&
      !hasCachedDotMarkerAfterRun(next) &&
      !hasAuthorityAtAfterNext
    ) {
      return cursor;
    }
    if (
      symbol === "]" &&
      next < end &&
      meta.alphaNum[next] &&
      !hasAuthorityAtAfterNext
    ) {
      return meta.symbol[hostStart] === "[" && !sawHostClose
        ? cursor + 1
        : cursor;
    }
    if (
      (symbol === '"' ||
        symbol === "'" ||
        symbol === "`" ||
        symbol === "”" ||
        symbol === "’" ||
        symbol === "»" ||
        symbol === "“" ||
        symbol === "‘" ||
        symbol === "«") &&
      next < end &&
      meta.alphaNum[next] &&
      !hasAuthorityAtAfterNext
    ) {
      return cursor;
    }
    if (symbol === ".") {
      if (
        next < end &&
        meta.alphaNum[next] &&
        !hasAuthorityAtAfterNext &&
        (meta.symbol[previousVisible] === "]" ||
          (meta.raw[previousVisible] !== undefined &&
            /^[0-9]$/u.test(meta.raw[previousVisible]) &&
            hasColonBeforeCursor))
      ) {
        return cursor;
      }
      previousVisible = cursor;
      continue;
    }
    if (
      symbol === ":" &&
      next < end &&
      !/^[0-9]$/u.test(meta.raw[next]) &&
      meta.symbol[next] !== "/" &&
      meta.symbol[next] !== "?" &&
      meta.symbol[next] !== "#" &&
      bracketDepth === 0 &&
      !hasAuthorityAtAfterNext
    ) {
      return cursor;
    }
    if (
      AUTHORITY_GLUED_PROSE_CHARS.has(symbol) &&
      next < end &&
      meta.alphaNum[next] &&
      !(symbol === ":" && /^[0-9]$/u.test(meta.raw[next])) &&
      !(symbol === ":" && bracketDepth > 0) &&
      !hasAuthorityAtAfterNext
    ) {
      return cursor;
    }
    if (
      (symbol === "(" || symbol === "[" || symbol === "{" || symbol === "<") &&
      next < end &&
      meta.alphaNum[next] &&
      bracketDepth === 0 &&
      !hasAuthorityAtAfterNext &&
      !isBracketedHostOpen(meta, hostStart, cursor, end)
    ) {
      return cursor;
    }
    if (symbol === "@") {
      hostStart = cursor + 1;
      sawHostClose = false;
    } else if (symbol === "]") {
      sawHostClose = true;
    }
    if (symbol === "[") bracketDepth++;
    if (symbol === "]" && bracketDepth > 0) bracketDepth--;
    if (!meta.zeroWidth[cursor]) previousVisible = cursor;
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
  let onlyBracketedHostCloses: ReadonlySet<number> | undefined;
  while (authorityEnd > start) {
    let cursor = authorityEnd;
    while (cursor > start && meta.zeroWidth[cursor - 1]) cursor--;
    const trailing = meta.symbol[cursor - 1];
    if (
      cursor > start &&
      AUTHORITY_TRAILING_CHARS.has(trailing) &&
      !(
        trailing === "]" &&
        (onlyBracketedHostCloses ??= collectOnlyBracketedHostCloses(
          meta,
          start,
          end,
        )).has(cursor - 1)
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
