import {
  maskCodePointRangesPreservingLength,
  normalizeTextInput,
  type TextCodePointRange,
} from "@textfilters/core";

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
  return maskCodePointRangesPreservingLength(codePoints, ranges, maskChar);
};

export function createUrlFilter(config: UrlFilterConfig = {}): UrlFilter {
  const tlds = normalizeTlds(config.tlds);
  const tldSet = new Set(tlds);
  const tldSkeletonSet = new Set(tlds.map((tld) => toSkeleton(tld)));
  const maskChar = config.maskChar ?? "*";

  return {
    name: URL_FILTER_NAME,
    censor(text) {
      const source = normalizeTextInput(text);
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
