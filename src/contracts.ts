import type { TextCodePointRange } from "@textfilters/core";

// Keep public API types in a dependency-light module so the entrypoint can
// re-export them without exposing parser internals.
export interface UrlFilterConfig {
  readonly tlds?: readonly string[];
  readonly maskChar?: string;
}

export const URL_FILTER_NAME = "url";

export interface UrlFilter {
  readonly name: typeof URL_FILTER_NAME;
  censor(text: unknown): string;
}

export interface UrlScanInput {
  readonly text: string;
  readonly codePoints: readonly string[];
}

export interface UrlRangeScanResult {
  readonly ranges: readonly TextCodePointRange[];
}

export interface UrlRangeScanner {
  readonly name: typeof URL_FILTER_NAME;
  scan(input: UrlScanInput): UrlRangeScanResult;
}
