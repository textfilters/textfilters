import {
  splitGluedPortProse,
  startsWithDefangedDotContinuation,
  startsWithShortSpacedLabelContinuation,
  startsWithSpacedHostMarker,
  trimAuthorityTrailingNoise,
  trimGluedProseFromAuthority,
  trimZeroWidthBeforeTail,
} from "./authority-tail.js";
import { parseDomain, parseLabel } from "./domain.js";
import {
  parseBracketedIpv6Host,
  parseExplicitHostDomain,
  parseExplicitHostLabel,
  parsePort,
} from "./explicit-host.js";
import { consumeSpacedHostContinuation, maybeConsumePathTail } from "./path.js";
import type { DomainMatch, Match, TextMeta } from "./meta.js";

export interface ExplicitUrlTargetMatch extends Match {
  readonly domain: DomainMatch | null;
  readonly domainStart: number | null;
}

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
