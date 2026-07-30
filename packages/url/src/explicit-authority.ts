import {
  AUTHORITY_GLUED_PROSE_CHARS,
  AUTHORITY_TRAILING_CHARS,
  PATH_START_CHARS,
} from "./chars.js";
import { parseDot } from "./dots.js";
import { parseDomain, parseLabel } from "./domain.js";
import { consumeSpacedHostContinuation, maybeConsumePathTail } from "./path.js";
import type { DomainMatch, Label, Match, TextMeta } from "./meta.js";

interface ExplicitHostLabel extends Label {
  readonly hasNonAsciiSymbol: boolean;
}

export interface ExplicitUrlTargetMatch extends Match {
  readonly domain: DomainMatch | null;
  readonly domainStart: number | null;
}

const parsePort = (
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

const parseBracketedIpv6Host = (
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

const parseExplicitHostLabel = (
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

  if (first < 0 || raw.length === 0 || raw.length > 63) return null;
  return { start: first, end: last + 1, pos, raw, skeleton, hasNonAsciiSymbol };
};

const parseExplicitHostDomain = (
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

const splitGluedPortProse = (
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

const trimZeroWidthBeforeTail = (
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

const startsWithSpacedHostMarker = (meta: TextMeta, start: number): boolean => {
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

const startsWithShortSpacedLabelContinuation = (
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

const startsWithDefangedDotContinuation = (
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

const trimGluedProseFromAuthority = (
  meta: TextMeta,
  start: number,
  end: number,
): number => {
  for (let cursor = start; cursor + 1 < end; cursor++) {
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
            meta.raw.slice(start, previous + 1).includes(":")))
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

const trimAuthorityTrailingNoise = (
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

export const parseExplicitUrlTarget = (
  meta: TextMeta,
  start: number,
  tldSet: ReadonlySet<string>,
  tldSkeletonSet: ReadonlySet<string>,
): ExplicitUrlTargetMatch | null => {
  let pos = start;
  let skippedAuthorityWhitespace = false;
  while (
    pos < meta.codePoints.length &&
    (meta.zeroWidth[pos] || meta.whitespace[pos])
  ) {
    skippedAuthorityWhitespace ||= meta.whitespace[pos];
    pos++;
  }
  if (pos >= meta.codePoints.length) return null;

  let authorityEnd = pos;
  while (
    authorityEnd < meta.codePoints.length &&
    !meta.whitespace[authorityEnd] &&
    meta.symbol[authorityEnd] !== "/" &&
    meta.symbol[authorityEnd] !== "?" &&
    meta.symbol[authorityEnd] !== "#"
  ) {
    authorityEnd++;
  }
  if (authorityEnd <= pos) return null;
  const scannedAuthorityEnd = authorityEnd;
  let scanResumeEnd = authorityEnd;
  authorityEnd = trimGluedProseFromAuthority(meta, pos, authorityEnd);
  if (authorityEnd < scanResumeEnd) scanResumeEnd = authorityEnd;
  const beforePortSplitEnd = authorityEnd;
  authorityEnd = splitGluedPortProse(meta, pos, authorityEnd);
  if (authorityEnd < beforePortSplitEnd) scanResumeEnd = authorityEnd;
  if (authorityEnd <= pos) return null;
  authorityEnd = trimZeroWidthBeforeTail(meta, pos, authorityEnd);
  let tailStart = authorityEnd;
  while (tailStart < meta.codePoints.length && meta.zeroWidth[tailStart]) {
    tailStart++;
  }
  const hasFollowingPathTail =
    tailStart < meta.codePoints.length &&
    (meta.symbol[tailStart] === "/" ||
      meta.symbol[tailStart] === "?" ||
      meta.symbol[tailStart] === "#");
  authorityEnd = trimAuthorityTrailingNoise(
    meta,
    pos,
    authorityEnd,
    hasFollowingPathTail,
  );
  if (authorityEnd <= pos) return null;
  const stoppedAtWhitespace =
    (authorityEnd < meta.codePoints.length && meta.whitespace[authorityEnd]) ||
    (scannedAuthorityEnd < meta.codePoints.length &&
      meta.whitespace[scannedAuthorityEnd]);

  let hostStart = pos;
  for (let cursor = pos; cursor < authorityEnd; cursor++) {
    if (meta.symbol[cursor] === "@") hostStart = cursor + 1;
  }
  if (hostStart >= authorityEnd) return null;

  let hostDomain: DomainMatch | null = null;
  let parsedDomain: DomainMatch | null = null;
  let hostEnd = parseBracketedIpv6Host(meta, hostStart, authorityEnd);
  if (hostEnd < 0) {
    const domain = parseDomain(meta, hostStart, tldSet, tldSkeletonSet, {
      allowUnknownTld: true,
    });
    parsedDomain = domain;
    if (domain) {
      const boundedLabels = domain.labels.filter(
        (label) => label.end <= authorityEnd,
      );
      // Authority trimming may intentionally stop before zero-width glued
      // prose; do not reuse label ends that crossed that trimmed boundary.
      if (boundedLabels.length >= 2) {
        hostEnd = boundedLabels[boundedLabels.length - 1]?.end ?? -1;
        hostDomain =
          boundedLabels.length === domain.labels.length
            ? domain
            : {
                start: boundedLabels[0]?.start ?? hostStart,
                end: hostEnd,
                pos: hostEnd,
                labels: boundedLabels,
              };
      }
    }

    if (hostEnd < 0 || hostEnd < authorityEnd) {
      const explicitHostDomain = parseExplicitHostDomain(
        meta,
        hostStart,
        authorityEnd,
      );
      if (explicitHostDomain) {
        const explicitHostEnd =
          explicitHostDomain.labels[explicitHostDomain.labels.length - 1]
            ?.end ?? -1;
        if (explicitHostEnd > hostEnd) {
          hostEnd = explicitHostEnd;
          hostDomain = explicitHostDomain;
        }
      }
    }

    if (hostEnd < 0 || hostEnd > authorityEnd) {
      const label =
        parseExplicitHostLabel(meta, hostStart, authorityEnd) ??
        parseLabel(meta, hostStart);
      const spacedHostContinuation = consumeSpacedHostContinuation(
        meta,
        authorityEnd,
        stoppedAtWhitespace &&
          ((label?.raw.length ?? 0) <= 3 ||
            startsWithSpacedHostMarker(meta, authorityEnd) ||
            startsWithDefangedDotContinuation(meta, authorityEnd) ||
            startsWithShortSpacedLabelContinuation(meta, authorityEnd)),
      );
      if (label && label.end <= authorityEnd && spacedHostContinuation) {
        const continuedDomain =
          parsedDomain ??
          parseDomain(
            meta,
            spacedHostContinuation.start,
            tldSet,
            tldSkeletonSet,
            { allowUnknownTld: true },
          );
        return {
          start: pos,
          end: spacedHostContinuation.end,
          pos: spacedHostContinuation.pos,
          domain: continuedDomain,
          domainStart: continuedDomain ? hostStart : null,
        };
      }
      hostEnd = label && label.end <= authorityEnd ? label.end : -1;
    }
  }
  if (hostEnd < 0) return null;

  if (
    hostEnd + 1 === authorityEnd &&
    hasFollowingPathTail &&
    meta.symbol[hostEnd] === "."
  ) {
    hostEnd = authorityEnd;
  }
  if (
    hostEnd + 1 < authorityEnd &&
    meta.symbol[hostEnd] === "." &&
    meta.symbol[hostEnd + 1] === ":"
  ) {
    hostEnd++;
  }

  // Whitespace after `//` is only accepted with stronger host evidence; a
  // plain word would turn ordinary prose like `http:// next` into a URL.
  if (
    skippedAuthorityWhitespace &&
    hostEnd === authorityEnd &&
    !hasFollowingPathTail &&
    meta.symbol[hostStart] !== "[" &&
    !meta.symbol.slice(hostStart, authorityEnd).includes(".")
  ) {
    return null;
  }

  const endAfterPort = parsePort(meta, hostEnd, authorityEnd);
  if (endAfterPort < 0 || endAfterPort !== authorityEnd) return null;

  let end = authorityEnd;
  const pathTail = maybeConsumePathTail(meta, authorityEnd);
  if (pathTail && pathTail.end > end) {
    end = pathTail.end;
    scanResumeEnd = pathTail.pos;
  }

  return {
    start: pos,
    end,
    pos: Math.max(end, scanResumeEnd),
    domain: hostDomain,
    domainStart: hostDomain?.start ?? null,
  };
};
