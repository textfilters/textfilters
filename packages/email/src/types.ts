import type { TextFilter } from "@textfilters/core";

export interface EmailFilterOptions {
  readonly matchObfuscated?: boolean;
  readonly allowedEmails?: readonly string[];
  readonly allowedUsernames?: readonly string[];
  readonly allowedDomains?: readonly string[];
}

export interface EmailFilter extends TextFilter {
  readonly name: "email";
}

export type CodePointRange = readonly [start: number, end: number];

export interface EmailScanHints {
  readonly hasNonAscii?: boolean;
  readonly hasAtSign?: boolean;
  readonly hasDot?: boolean;
}

export interface EmailScanInput {
  readonly text: string;
  readonly codePoints: readonly string[];
  readonly hints?: EmailScanHints;
}

export type EmailRangeMatchSink = (match: {
  readonly range: CodePointRange;
}) => boolean | void;

export type EmailRangeScanResult = {
  readonly ranges: readonly CodePointRange[];
};

export interface EmailRangeScanner {
  check(input: EmailScanInput): boolean;
  scan(input: EmailScanInput): EmailRangeScanResult;
  scan(input: EmailScanInput, sink: EmailRangeMatchSink): boolean | void;
}
