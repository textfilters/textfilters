import { AUTHORITY_TRAILING_CHARS } from "./chars.js";
import { parseDot } from "./dots.js";
import {
  countCodePoints,
  type DomainMatch,
  type Label,
  type TextMeta,
} from "./meta.js";

interface ExplicitHostLabel extends Label {
  readonly hasNonAsciiSymbol: boolean;
}

export const parsePort = (
  meta: TextMeta,
  start: number,
  authorityEnd: number,
): number => {
  let pos = start;
  while (pos < authorityEnd && meta.zeroWidth[pos]) pos++;
  if (pos >= authorityEnd || meta.symbol[pos] !== ":") return start;
  pos++;
  while (pos < authorityEnd && meta.zeroWidth[pos]) pos++;
  if (
    pos >= authorityEnd ||
    meta.symbol[pos] === "/" ||
    meta.symbol[pos] === "?" ||
    meta.symbol[pos] === "#"
  ) {
    return pos;
  }

  let hasDigit = false;
  while (pos < authorityEnd) {
    if (meta.zeroWidth[pos]) {
      pos++;
      continue;
    }
    if (!/^[0-9]$/u.test(meta.raw[pos])) break;
    hasDigit = true;
    pos++;
  }
  return hasDigit ? pos : -1;
};

const isValidIpv4Tail = (value: string): boolean => {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^[0-9]+$/u.test(part)) return false;
      if (part.length > 1 && part.startsWith("0")) return false;
      const octet = Number(part);
      return octet >= 0 && octet <= 255;
    })
  );
};

const isValidIpv6Literal = (value: string): boolean => {
  if (!value.includes(":")) return false;
  if (!/^[0-9A-Fa-f:.]+$/u.test(value)) return false;
  const compressionParts = value.split("::");
  if (compressionParts.length > 2) return false;

  const hasCompression = compressionParts.length === 2;
  const left = compressionParts[0] ? compressionParts[0].split(":") : [];
  const right = compressionParts[1] ? compressionParts[1].split(":") : [];
  const parts = [...left, ...right];
  if (parts.some((part) => part.length === 0)) return false;

  const ipv4Tail = parts.at(-1)?.includes(".") ? parts.at(-1) : undefined;
  if (ipv4Tail && !isValidIpv4Tail(ipv4Tail)) return false;
  const hexParts = ipv4Tail ? parts.slice(0, -1) : parts;
  if (!hexParts.every((part) => /^[0-9A-Fa-f]{1,4}$/u.test(part))) {
    return false;
  }

  const segmentCount = hexParts.length + (ipv4Tail ? 2 : 0);
  return hasCompression ? segmentCount < 8 : segmentCount === 8;
};

export const parseBracketedIpv6Host = (
  meta: TextMeta,
  start: number,
  authorityEnd: number,
): number => {
  if (start >= authorityEnd || meta.symbol[start] !== "[") return -1;
  let pos = start + 1;
  let literal = "";
  while (pos < authorityEnd && meta.symbol[pos] !== "]") {
    literal += meta.raw[pos] ?? "";
    pos++;
  }
  if (
    pos >= authorityEnd ||
    meta.symbol[pos] !== "]" ||
    !isValidIpv6Literal(literal)
  ) {
    return -1;
  }
  return pos + 1;
};

const isExplicitIdnSymbol = (meta: TextMeta, pos: number): boolean => {
  const code = meta.raw[pos]?.codePointAt(0);
  return (
    code !== undefined &&
    code > 0x7f &&
    !AUTHORITY_TRAILING_CHARS.has(meta.symbol[pos]) &&
    !meta.zeroWidth[pos] &&
    !meta.whitespace[pos] &&
    !meta.alphaNum[pos] &&
    meta.symbol[pos] !== "." &&
    meta.symbol[pos] !== "/" &&
    meta.symbol[pos] !== ":" &&
    meta.symbol[pos] !== "?" &&
    meta.symbol[pos] !== "#" &&
    meta.symbol[pos] !== "@" &&
    meta.symbol[pos] !== "“" &&
    meta.symbol[pos] !== "‘" &&
    meta.symbol[pos] !== "«" &&
    meta.symbol[pos] !== "[" &&
    meta.symbol[pos] !== "]"
  );
};

export const parseExplicitHostLabel = (
  meta: TextMeta,
  start: number,
  authorityEnd: number,
): ExplicitHostLabel | null => {
  let pos = start;
  let first = -1;
  let last = -1;
  let raw = "";
  let skeleton = "";
  let hasNonAsciiSymbol = false;

  while (pos < authorityEnd) {
    if (meta.alphaNum[pos] || isExplicitIdnSymbol(meta, pos)) {
      if (first < 0) first = pos;
      last = pos;
      raw += meta.raw[pos];
      skeleton += meta.skeleton[pos];
      hasNonAsciiSymbol ||= isExplicitIdnSymbol(meta, pos);
      pos++;
      continue;
    }

    const gapStart = pos;
    let gapRaw = "";
    while (
      pos < authorityEnd &&
      meta.labelJoinSeparator[pos] &&
      !meta.whitespace[pos]
    ) {
      gapRaw += meta.raw[pos];
      pos++;
    }
    const gapHasZeroWidth = meta.zeroWidth.slice(gapStart, pos).some(Boolean);
    if (
      first >= 0 &&
      (gapHasZeroWidth || /^[-_]+$/u.test(gapRaw)) &&
      pos < authorityEnd
    ) {
      raw += gapRaw;
      skeleton += gapRaw;
      continue;
    }
    pos = gapStart;
    break;
  }

  if (first < 0 || raw.length === 0 || countCodePoints(raw) > 63) return null;
  return { start: first, end: last + 1, pos, raw, skeleton, hasNonAsciiSymbol };
};

export const parseExplicitHostDomain = (
  meta: TextMeta,
  start: number,
  authorityEnd: number,
): DomainMatch | null => {
  const first = parseExplicitHostLabel(meta, start, authorityEnd);
  if (!first) return null;

  const labels: ExplicitHostLabel[] = [first];
  let pos = first.pos;
  while (pos < authorityEnd) {
    const dot = parseDot(meta, pos);
    if (!dot || dot.pos > authorityEnd) break;
    const next = parseExplicitHostLabel(meta, dot.pos, authorityEnd);
    if (!next) break;
    labels.push(next);
    pos = next.pos;
  }

  if (labels.length < 2) return null;
  return {
    start: first.start,
    end: labels[labels.length - 1].end,
    pos,
    labels,
  };
};
