import type { TextFilter } from "@textfilters/core";

export interface UrlFilterOptions {
  readonly tlds?: readonly string[];
  readonly allowedDomains?: readonly string[];
}

export interface UrlFilter extends TextFilter {
  readonly name: "url";
}

export type CodePointRange = readonly [start: number, end: number];

export interface UrlScanInput {
  readonly text: string;
}

export type UrlRangeMatchSink = (
  match: { readonly range: CodePointRange },
  codePoints: readonly string[],
) => boolean | void;

export interface UrlRangeScanner {
  check(input: UrlScanInput): boolean;
  scan(input: UrlScanInput, sink: UrlRangeMatchSink): boolean;
}
