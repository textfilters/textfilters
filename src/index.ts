import { normalizeMaskChar, type TextCodePointRange } from "@textfilters/core";

import {
  URL_FILTER_NAME,
  type UrlFilter,
  type UrlFilterConfig,
} from "./contracts.js";
import { createMeta, toSkeleton } from "./meta.js";
import { collectRanges } from "./ranges.js";
import { DEFAULT_TLDS, normalizeTlds } from "./tlds.js";

export {
  URL_FILTER_NAME,
  type UrlFilter,
  type UrlFilterConfig,
} from "./contracts.js";

const maskUrlRanges = (
  codePoints: readonly string[],
  ranges: readonly TextCodePointRange[],
  maskChar: string,
): string => {
  if (ranges.length === 0) return codePoints.join("");

  const masked = new Array<boolean>(codePoints.length).fill(false);
  for (const [start, end] of ranges) {
    const left = Math.max(0, start);
    const right = Math.min(codePoints.length, end);
    for (let i = left; i < right; i++) masked[i] = true;
  }

  // Repeat by the source code point's UTF-16 width so callers keep stable
  // string offsets even when the input contains astral symbols.
  return codePoints
    .map((codePoint, index) =>
      masked[index] ? maskChar.repeat(codePoint.length) : codePoint,
    )
    .join("");
};

const normalizeLengthPreservingMaskChar = (
  maskChar: string | undefined,
): string => {
  const normalized = normalizeMaskChar(maskChar);
  // Astral mask characters would expand BMP URLs; fall back to one code unit.
  return normalized.length === 1 ? normalized : "*";
};

export function createUrlFilter(config: UrlFilterConfig = {}): UrlFilter {
  const tlds = normalizeTlds(config.tlds);
  const tldSet = new Set(tlds);
  const tldSkeletonSet = new Set(tlds.map((tld) => toSkeleton(tld)));
  const maskChar = normalizeLengthPreservingMaskChar(config.maskChar);

  return {
    name: URL_FILTER_NAME,
    censor(text) {
      if (text === null || text === undefined) return "";
      const source = String(text);
      if (!source) return source;
      const meta = createMeta(source);
      const ranges = collectRanges(meta, tldSet, tldSkeletonSet);
      return maskUrlRanges(meta.codePoints, ranges, maskChar);
    },
  };
}

export function urlFilter(config?: UrlFilterConfig): UrlFilter {
  return createUrlFilter(config);
}

export const filter = createUrlFilter({ tlds: DEFAULT_TLDS });
