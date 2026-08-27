import type { TextCodePointRange, TextFilter } from "@textfilters/core";

export const PHONE_FILTER_NAME = "phone";

export interface PhoneFilterConfig {
  readonly maskChar?: string;
}

export interface PhoneFilter extends TextFilter {
  readonly name: typeof PHONE_FILTER_NAME;
}

export interface PhoneScannerConfig {}

export interface PhoneScanHints {
  readonly textLength?: number;
  readonly digitCount?: number;
  readonly hasPlus?: boolean;
  readonly hasPunctuation?: boolean;
}

export interface PhoneScanInput {
  readonly text: string;
  readonly codePoints: readonly string[];
  readonly hints?: PhoneScanHints;
}

export interface PhoneRangeScanResult {
  readonly ranges: readonly TextCodePointRange[];
}

export interface PhoneRangeMatch {
  readonly range: TextCodePointRange;
}

export type PhoneRangeMatchSink = (match: PhoneRangeMatch) => boolean | void;

export interface PhoneRangeScanner {
  readonly name: typeof PHONE_FILTER_NAME;
  readonly allocationAware: true;
  check(input: PhoneScanInput): boolean;
  scan(input: PhoneScanInput): PhoneRangeScanResult;
  scan(input: PhoneScanInput, sink: PhoneRangeMatchSink): boolean | void;
}
