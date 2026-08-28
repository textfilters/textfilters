import type { TextFilter } from "@textfilters/core";

export interface UrlFilterOptions {
  readonly tlds?: readonly string[];
  readonly allowedDomains?: readonly string[];
}

export interface UrlFilter extends TextFilter {
  readonly name: "url";
}

export type CodePointRange = readonly [start: number, end: number];

export interface UrlScanHints {
  readonly hasNonAscii?: boolean;
  readonly hasDot?: boolean;
  readonly hasSlash?: boolean;
  readonly hasColon?: boolean;
}

export interface UrlScanInput {
  readonly text: string;
  readonly codePoints: readonly string[];
  readonly hints?: UrlScanHints;
}

export type UrlRangeMatchSink = (match: {
  readonly range: CodePointRange;
}) => boolean | void;

export type UrlRangeScanResult = {
  readonly ranges: readonly CodePointRange[];
};

export interface UrlRangeScanner {
  check(input: UrlScanInput): boolean;
  scan(input: UrlScanInput): UrlRangeScanResult;
  scan(input: UrlScanInput, sink: UrlRangeMatchSink): boolean | void;
}
