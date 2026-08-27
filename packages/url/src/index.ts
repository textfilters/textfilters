import { createTextFilterFromScanner } from "@textfilters/core";

import {
  URL_FILTER_NAME,
  type UrlFilter,
  type UrlFilterConfig,
} from "./contracts.js";
import { createUrlScanner, scanUrlRanges } from "./scanner.js";

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
  type UrlScannerConfig,
} from "./contracts.js";
export {
  checkUrlRanges,
  createUrlScanner,
  scanUrlRangeMatches,
  scanUrlRanges,
} from "./scanner.js";

export function createUrlFilter(config: UrlFilterConfig = {}): UrlFilter {
  const scanner = createUrlScanner({
    tlds: config.tlds,
    allowedDomains: config.allowedDomains,
    ambiguousSpacedDots: config.ambiguousSpacedDots,
  });
  return createTextFilterFromScanner(URL_FILTER_NAME, scanner, config.maskChar);
}

export function urlFilter(config?: UrlFilterConfig): UrlFilter {
  return createUrlFilter(config);
}

export const filter = createUrlFilter();
