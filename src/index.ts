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
import { createUrlScanner, scanUrlRanges } from "./scanner.js";
import { DEFAULT_TLDS, normalizeTlds } from "./tlds.js";

export {
  URL_FILTER_NAME,
  type UrlFilter,
  type UrlFilterConfig,
  type UrlRangeMatch,
  type UrlRangeMatchSink,
  type UrlRangeScanner,
  type UrlRangeScanResult,
  type UrlScanInput,
} from "./contracts.js";
export {
  checkUrlRanges,
  createUrlScanner,
  scanUrlRangeMatches,
  scanUrlRanges,
  type UrlScannerConfig,
} from "./scanner.js";

const maskUrlRanges = (
  codePoints: readonly string[],
  ranges: readonly TextCodePointRange[],
  maskChar: string,
): string => {
  if (ranges.length === 0) return codePoints.join("");
  return maskCodePointRangesPreservingLength(codePoints, ranges, maskChar);
};

export function createUrlFilter(config: UrlFilterConfig = {}): UrlFilter {
  const scanner = createUrlScanner({ tlds: normalizeTlds(config.tlds) });
  const maskChar = config.maskChar ?? "*";

  return {
    name: URL_FILTER_NAME,
    censor(text) {
      const source = normalizeTextInput(text);
      if (!source) return source;
      const codePoints = Array.from(source);
      const ranges = scanner.scan({ text: source, codePoints }).ranges;
      return maskUrlRanges(codePoints, ranges, maskChar);
    },
  };
}

export function urlFilter(config?: UrlFilterConfig): UrlFilter {
  return createUrlFilter(config);
}

export const filter = createUrlFilter({ tlds: DEFAULT_TLDS });
