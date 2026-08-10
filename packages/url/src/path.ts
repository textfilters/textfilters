import {
  PATH_GLUED_PROSE_CHARS,
  PATH_START_CHARS,
  PATH_TRAILING_CHARS,
} from "./chars.js";
import { isIgnorableFormatting, parseDot } from "./dots.js";
import type { Match, TextMeta } from "./meta.js";

export const hasQueryOrFragmentAfter = (
  meta: TextMeta,
  start: number,
): boolean => {
  for (let cursor = start; cursor < meta.codePoints.length; cursor++) {
    if (meta.whitespace[cursor]) return false;
    if (meta.symbol[cursor] === "?" || meta.symbol[cursor] === "#") {
      return true;
    }
  }
  return false;
};

const collectBalancedPathCloses = (
  meta: TextMeta,
  pathStart: number,
  pathEnd: number,
): ReadonlySet<number> => {
  const balanced = new Set<number>();
  let parentheses = 0;
  let brackets = 0;
  let braces = 0;
  for (let cursor = pathStart; cursor < pathEnd; cursor++) {
    switch (meta.symbol[cursor]) {
      case "(":
        parentheses++;
        break;
      case ")":
        parentheses--;
        if (parentheses === 0) balanced.add(cursor);
        break;
      case "[":
        brackets++;
        break;
      case "]":
        brackets--;
        if (brackets === 0) balanced.add(cursor);
        break;
      case "{":
        braces++;
        break;
      case "}":
        braces--;
        if (braces === 0) balanced.add(cursor);
        break;
    }
  }
  return balanced;
};

const nextNonZeroWidth = (
  meta: TextMeta,
  start: number,
  end: number = meta.codePoints.length,
): number => {
  let pos = start;
  while (pos < end && meta.zeroWidth[pos]) pos++;
  return pos;
};

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

const scanNumericPort = (meta: TextMeta, start: number): Match | null => {
  let cursor = start + 1;
  let end = -1;
  let hasDigit = false;
  while (cursor < meta.codePoints.length) {
    if (isIgnorableFormatting(meta, cursor)) {
      cursor++;
      continue;
    }
    if (!/^[0-9]$/u.test(meta.raw[cursor])) break;
    hasDigit = true;
    cursor++;
    end = cursor;
  }
  return hasDigit ? { start, end, pos: cursor } : null;
};

const isDotGluedProseAfterPort = (meta: TextMeta, portEnd: number): boolean => {
  if (meta.symbol[portEnd] !== ".") return false;
  const afterDot = nextNonZeroWidth(meta, portEnd + 1);
  return afterDot < meta.codePoints.length && meta.alphaNum[afterDot];
};

const isNonUrlPunctuationAfterPort = (
  meta: TextMeta,
  portEnd: number,
): boolean => {
  if (portEnd >= meta.codePoints.length) return false;
  return (
    !meta.alphaNum[portEnd] &&
    meta.symbol[portEnd] !== "." &&
    !PATH_START_CHARS.has(meta.symbol[portEnd]) &&
    !meta.whitespace[portEnd]
  );
};

export const maybeConsumePathTail = (
  meta: TextMeta,
  start: number,
): Match | null => {
  let pos = start;
  while (pos < meta.codePoints.length && isIgnorableFormatting(meta, pos)) {
    pos++;
  }
  if (pos >= meta.codePoints.length) return null;
  if (!PATH_START_CHARS.has(meta.symbol[pos])) return null;

  if (meta.symbol[pos] === ":") {
    const port = scanNumericPort(meta, pos);
    if (!port) return null;
    const portEnd = port.end;
    const boundary = port.pos;
    if (
      boundary < meta.codePoints.length &&
      !PATH_START_CHARS.has(meta.symbol[boundary]) &&
      PATH_TRAILING_CHARS.has(meta.symbol[boundary])
    ) {
      return { start: pos, end: portEnd, pos: boundary };
    }
    if (boundary < meta.codePoints.length && meta.alphaNum[boundary]) {
      return null;
    }
    if (isNonUrlPunctuationAfterPort(meta, boundary)) return null;
    if (isDotGluedProseAfterPort(meta, boundary)) {
      return { start: pos, end: portEnd, pos: boundary };
    }
  }

  let end = pos + 1;
  let cursor = pos + 1;
  let hasQueryOrFragment = meta.symbol[pos] === "?" || meta.symbol[pos] === "#";
  while (cursor < meta.codePoints.length && !meta.whitespace[cursor]) {
    hasQueryOrFragment ||=
      meta.symbol[cursor] === "?" || meta.symbol[cursor] === "#";
    const next = nextNonZeroWidth(meta, cursor + 1);
    if (
      !hasQueryOrFragment &&
      PATH_GLUED_PROSE_CHARS.has(meta.symbol[cursor]) &&
      next < meta.codePoints.length &&
      meta.alphaNum[next]
    ) {
      break;
    }
    end = cursor + 1;
    cursor++;
  }

  if (end === pos + 1 && meta.symbol[pos] !== "/") return null;

  let balancedPathCloses: ReadonlySet<number> | undefined;
  const isBalancedClose = (closeIndex: number): boolean => {
    const close = meta.symbol[closeIndex];
    if (close !== ")" && close !== "]" && close !== "}") return false;
    balancedPathCloses ??= collectBalancedPathCloses(meta, pos, end);
    return balancedPathCloses.has(closeIndex);
  };
  let trimmedTrailingPunctuation = false;
  while (end > pos + 1) {
    let cursor = end;
    while (cursor > pos + 1 && isIgnorableFormatting(meta, cursor - 1)) {
      cursor--;
    }
    if (cursor < end) {
      // Handle `path,\u200b next`: trim the punctuation before the invisible
      // separator, then trim the separator on the next pass.
      if (
        cursor > pos + 1 &&
        PATH_TRAILING_CHARS.has(meta.symbol[cursor - 1]) &&
        !isBalancedClose(cursor - 1)
      ) {
        end = cursor - 1;
        trimmedTrailingPunctuation = true;
        continue;
      }
      if (!trimmedTrailingPunctuation) break;
      end = cursor;
      continue;
    }
    if (
      PATH_TRAILING_CHARS.has(meta.symbol[end - 1]) &&
      !isBalancedClose(end - 1)
    ) {
      end--;
      trimmedTrailingPunctuation = true;
      continue;
    }
    break;
  }

  let hasVisibleContent = meta.symbol[pos] === "/";
  for (
    let contentPos = pos + 1;
    !hasVisibleContent && contentPos < end;
    contentPos++
  ) {
    hasVisibleContent =
      !isIgnorableFormatting(meta, contentPos) &&
      meta.symbol[contentPos] !== "?" &&
      meta.symbol[contentPos] !== "#";
  }
  if (!hasVisibleContent) return null;

  return { start: pos, end, pos: cursor };
};

export const consumeSpacedHostContinuation = (
  meta: TextMeta,
  start: number,
  enabled: boolean,
): Match | null => {
  if (!enabled) return null;

  let pos = start;
  while (
    pos < meta.codePoints.length &&
    (meta.zeroWidth[pos] || meta.whitespace[pos])
  ) {
    pos++;
  }
  if (
    pos >= meta.codePoints.length ||
    (!meta.alphaNum[pos] && parseDot(meta, pos) === null)
  ) {
    return null;
  }

  let cursor = pos;
  let end = pos;
  let sawHostMarker = false;
  let sawAlphaNum = false;
  let inPath = false;
  let hasQueryOrFragment = false;
  let pathStart = -1;
  let lastSignificantSymbol = "";
  while (cursor < meta.codePoints.length) {
    if (meta.zeroWidth[cursor]) {
      cursor++;
      continue;
    }
    if (meta.whitespace[cursor]) {
      if (inPath) break;
      let next = cursor + 1;
      while (
        next < meta.codePoints.length &&
        (meta.zeroWidth[next] || meta.whitespace[next])
      ) {
        next++;
      }
      if (
        next >= meta.codePoints.length ||
        (!meta.alphaNum[next] && parseDot(meta, next) === null)
      ) {
        break;
      }
      if (
        sawHostMarker &&
        lastSignificantSymbol !== "." &&
        meta.alphaNum[next]
      ) {
        const runLen = measureAlphaNumRun(meta, next);
        if (runLen > 1) break;
      }
      end = cursor + 1;
      cursor++;
      continue;
    }

    const symbol = meta.symbol[cursor];
    if (symbol === ":") {
      // Port parsing runs before generic tail consumption so glued prose after
      // a numeric port stays outside spaced-host URLs.
      const port = scanNumericPort(meta, cursor);
      if (
        port &&
        (port.pos >= meta.codePoints.length ||
          meta.alphaNum[port.pos] ||
          isDotGluedProseAfterPort(meta, port.pos) ||
          isNonUrlPunctuationAfterPort(meta, port.pos))
      ) {
        end = port.end;
        cursor = port.pos;
        break;
      }
    }
    const dot = parseDot(meta, cursor);
    if (dot && dot.start === cursor && dot.end > cursor + 1) {
      sawHostMarker = true;
      lastSignificantSymbol = ".";
      end = dot.end;
      cursor = dot.pos;
      continue;
    }
    if (symbol === "." || symbol === "/" || symbol === "?" || symbol === "#") {
      sawHostMarker = true;
    }
    if (symbol === "/" || symbol === "?" || symbol === "#") {
      if (!inPath) pathStart = cursor;
      inPath = true;
    }
    hasQueryOrFragment ||= symbol === "?" || symbol === "#";
    const next = nextNonZeroWidth(meta, cursor + 1);
    if (
      (inPath || sawHostMarker) &&
      !hasQueryOrFragment &&
      PATH_GLUED_PROSE_CHARS.has(symbol) &&
      next < meta.codePoints.length &&
      meta.alphaNum[next]
    ) {
      break;
    }
    if (meta.alphaNum[cursor]) sawAlphaNum = true;
    lastSignificantSymbol = symbol;
    end = cursor + 1;
    cursor++;
  }

  const balancedPathStart = pathStart >= 0 ? pathStart : pos;
  let balancedPathCloses: ReadonlySet<number> | undefined;
  const isBalancedClose = (closeIndex: number): boolean => {
    const close = meta.symbol[closeIndex];
    if (close !== ")" && close !== "]" && close !== "}") return false;
    balancedPathCloses ??= collectBalancedPathCloses(
      meta,
      balancedPathStart,
      end,
    );
    return balancedPathCloses.has(closeIndex);
  };
  let trimmedTrailingPunctuation = false;
  while (end > pos) {
    let trimCursor = end;
    while (trimCursor > pos && meta.zeroWidth[trimCursor - 1]) trimCursor--;
    if (trimCursor < end) {
      if (
        trimCursor > pos &&
        PATH_TRAILING_CHARS.has(meta.symbol[trimCursor - 1]) &&
        !isBalancedClose(trimCursor - 1)
      ) {
        end = trimCursor - 1;
        trimmedTrailingPunctuation = true;
        continue;
      }
      if (!trimmedTrailingPunctuation) break;
      end = trimCursor;
      continue;
    }
    if (
      PATH_TRAILING_CHARS.has(meta.symbol[end - 1]) &&
      !isBalancedClose(end - 1)
    ) {
      end--;
      trimmedTrailingPunctuation = true;
      continue;
    }
    break;
  }

  return sawHostMarker && sawAlphaNum && end > pos
    ? { start: pos, end, pos: cursor }
    : null;
};
