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
  readonly hints?: {
    readonly hasNonAscii?: boolean;
    readonly hasDot?: boolean;
    readonly hasSlash?: boolean;
    readonly hasColon?: boolean;
  };
}

export interface UrlRangeScanResult {
  readonly ranges: readonly TextCodePointRange[];
}

export interface UrlRangeMatch {
  readonly range: TextCodePointRange;
}

export type UrlRangeMatchSink = (match: UrlRangeMatch) => boolean | void;

export interface UrlRangeScanner {
  readonly name: typeof URL_FILTER_NAME;
  readonly allocationAware: true;
  check(input: UrlScanInput): boolean;
  scan(input: UrlScanInput): UrlRangeScanResult;
  scan(input: UrlScanInput, sink: UrlRangeMatchSink): boolean | void;
}
