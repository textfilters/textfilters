import type { TextCodePointRange } from "@textfilters/core";

export const EMAIL_FILTER_NAME = "email";

export interface EmailFilterOptions {
  readonly maskChar?: string;
  readonly matchObfuscated?: boolean;
  readonly allowLocalhost?: boolean;
  readonly allowSingleLabelDomain?: boolean;
  readonly excludeEmails?: readonly string[];
  readonly excludeUsernames?: readonly string[];
  readonly excludeDomains?: readonly string[];
}

export interface EmailFilter {
  readonly name: typeof EMAIL_FILTER_NAME;
  censor(text: unknown): string;
}

export interface EmailScanHints {
  readonly textLength?: number;
  readonly hasNonAscii?: boolean;
  readonly hasAtSign?: boolean;
  readonly hasDot?: boolean;
}

export interface EmailScanInput {
  readonly text: string;
  readonly codePoints: readonly string[];
  readonly hints?: EmailScanHints;
}

export type EmailRangeScanResult = {
  readonly ranges: readonly TextCodePointRange[];
};

export type EmailRangeMatch = {
  readonly range: TextCodePointRange;
};

export type EmailRangeMatchSink = (match: EmailRangeMatch) => boolean | void;

export interface EmailRangeScanner {
  readonly name: typeof EMAIL_FILTER_NAME;
  readonly allocationAware: true;
  check(input: EmailScanInput): boolean;
  scan(input: EmailScanInput): EmailRangeScanResult;
  scan(input: EmailScanInput, sink: EmailRangeMatchSink): boolean | void;
}
