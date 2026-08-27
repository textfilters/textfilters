import type { TextCodePointRange, TextFilter } from "@textfilters/core";

// Keep public API types in a dependency-light module so the entrypoint can
// re-export them without exposing parser internals.
export type AmbiguousSpacedDotPolicy = "preserve" | "block";

export interface UrlFilterConfig {
  readonly tlds?: readonly string[];
  readonly maskChar?: string;
  readonly allowedDomains?: readonly string[];
  readonly ambiguousSpacedDots?: AmbiguousSpacedDotPolicy;
}

export type UrlScannerConfig = Omit<UrlFilterConfig, "maskChar">;

export const URL_FILTER_NAME = "url";

export interface UrlFilter extends TextFilter {
  readonly name: typeof URL_FILTER_NAME;
}

export interface UrlScanHints {
  readonly hasNonAscii?: boolean;
  readonly hasDot?: boolean;
  readonly hasSlash?: boolean;
  readonly hasColon?: boolean;
}

export interface UrlScanInput {
  readonly text: string;
  /** The reusable `Array.from(text)` code-point view prepared by the caller. */
  readonly codePoints: readonly string[];
  readonly hints?: UrlScanHints;
}

export type UrlRangeScanResult = {
  readonly ranges: readonly TextCodePointRange[];
};

export type UrlRangeMatch = {
  readonly range: TextCodePointRange;
};

export type UrlRangeMatchSink = (match: UrlRangeMatch) => boolean | void;

export interface UrlRangeScanner {
  readonly name: typeof URL_FILTER_NAME;
  readonly allocationAware: true;
  check(input: UrlScanInput): boolean;
  scan(input: UrlScanInput): UrlRangeScanResult;
  scan(input: UrlScanInput, sink: UrlRangeMatchSink): boolean | void;
}
