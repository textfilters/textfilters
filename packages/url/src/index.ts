import { censorCodePointRanges, normalizeTextInput } from "@textfilters/core";

import {
  URL_FILTER_NAME,
  type UrlFilter,
  type UrlFilterConfig,
} from "./contracts.js";
import { createUrlScanner, scanUrlRanges } from "./scanner.js";
import { DEFAULT_TLDS } from "./tlds.js";

export {
  URL_FILTER_NAME,
  type AmbiguousSpacedDotPolicy,
  type UrlFilter,
  type UrlFilterConfig,
  type UrlRangeMatch,
  type UrlRangeMatchSink,
  type UrlRangeScanner,
  type UrlRangeScanResult,
  type UrlScanHints,
  type UrlScanInput,
} from "./contracts.js";
export {
  checkUrlRanges,
  createUrlScanner,
  scanUrlRangeMatches,
  scanUrlRanges,
  type UrlScannerConfig,
} from "./scanner.js";

export function createUrlFilter(config: UrlFilterConfig = {}): UrlFilter {
  const scanner = createUrlScanner({
    tlds: config.tlds,
    allowedDomains: config.allowedDomains,
    ambiguousSpacedDots: config.ambiguousSpacedDots,
  });
  const maskChar = config.maskChar ?? "*";

  return {
    name: URL_FILTER_NAME,
    censor(text) {
      const source = normalizeTextInput(text);
      if (!source) return source;
      const codePoints = Array.from(source);
      const ranges = scanner.scan({ text: source, codePoints }).ranges;
      return censorCodePointRanges(codePoints, ranges, maskChar);
    },
  };
}

export function urlFilter(config?: UrlFilterConfig): UrlFilter {
  return createUrlFilter(config);
}

export const filter = createUrlFilter({ tlds: DEFAULT_TLDS });
