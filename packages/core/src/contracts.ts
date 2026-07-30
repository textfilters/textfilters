export interface TextCensor {
  readonly name?: string;
  censor(value: string): string;
}

export interface TextGuardInput {
  readonly actorKey?: string;
  readonly text: string;
  readonly nowMs?: number;
}

export type TextGuardReason = string;

export type TextGuardAllowedResult = {
  readonly allowed: true;
};

export type TextGuardBlockedResult = {
  readonly allowed: false;
  readonly reason: TextGuardReason;
};

export type TextGuardResult = TextGuardAllowedResult | TextGuardBlockedResult;

export interface TextGuard {
  readonly name?: string;
  check(input: TextGuardInput): TextGuardResult;
}

export type TextPipelineProcessedResult = {
  readonly allowed: true;
  readonly text: string;
};

export type TextPipelineProcessResult =
  | TextPipelineProcessedResult
  | TextGuardBlockedResult;

export interface CachedTextProcessorOptions {
  readonly maxEntries?: number;
}

export interface CachedTextProcessor<T> {
  readonly maxEntries: number;
  readonly size: number;
  process(value: unknown): T;
  clear(): void;
}

/**
 * Composes guards and censors in deterministic registration order.
 */
export interface TextPipeline {
  use(censor: TextCensor): TextPipeline;
  guard(guard: TextGuard): TextPipeline;
  censor(text: string): string;
  check(input: TextGuardInput): TextGuardResult;
  process(input: TextGuardInput): TextPipelineProcessResult;
}

export type TextRange = readonly [start: number, end: number];
export type TextCodePointRange = readonly [start: number, end: number];

export interface TextHints {
  readonly textLength: number;
  readonly codePointLength: number;
  readonly isEmpty: boolean;
  readonly hasAsciiOnly: boolean;
  readonly hasNonAscii: boolean;
  readonly hasDigit: boolean;
  readonly digitCount: number;
  readonly hasAsciiLetter: boolean;
  readonly hasWhitespace: boolean;
  readonly hasPunctuation: boolean;
  readonly punctuationCount: number;
  readonly hasAtSign: boolean;
  readonly hasDot: boolean;
  readonly hasSlash: boolean;
  readonly hasColon: boolean;
  readonly hasPlus: boolean;
}

export interface TextScanInput {
  readonly text: string;
  readonly codePoints: readonly string[];
}

export interface PreparedText extends TextScanInput {
  readonly hints: TextHints;
}

export type TextRangeScanMetadata = Readonly<Record<string, unknown>>;

export interface RangeMatch {
  readonly range: TextCodePointRange;
  readonly metadata?: TextRangeScanMetadata;
}

export type RangeMatchSink = (match: RangeMatch) => boolean | void;

export interface TextRangeScanResult {
  readonly ranges: readonly TextCodePointRange[];
  readonly metadata?: TextRangeScanMetadata;
}

export type TextRangeScannerOutput =
  | readonly TextCodePointRange[]
  | TextRangeScanResult;

export type TextRangeScannerFunction = (
  input: TextScanInput,
) => TextRangeScannerOutput;

export interface AllocationAwareRangeScanner {
  readonly name?: string;
  readonly allocationAware: true;
  check(input: PreparedText): boolean;
  scan(input: PreparedText, sink: RangeMatchSink): boolean | void;
}

export interface LegacyTextRangeScanner {
  readonly name?: string;
  scan(input: TextScanInput): TextRangeScannerOutput;
}

export type TextRangeScanner =
  | TextRangeScannerFunction
  | LegacyTextRangeScanner
  | AllocationAwareRangeScanner;

export interface TextRangePipelineScanResult {
  readonly text: string;
  readonly codePoints: readonly string[];
  readonly ranges: readonly TextCodePointRange[];
  readonly scanResults: readonly TextRangeScanResult[];
}

export type ScanHints = TextHints;
export type ScanInput = PreparedText;
export type ScanResult = TextRangePipelineScanResult;

export interface TextRangePipelineCensorResult {
  readonly text: string;
  readonly ranges: readonly TextCodePointRange[];
  readonly scanResults: readonly TextRangeScanResult[];
}

export interface TextRangePipeline {
  use(scanner: TextRangeScanner): TextRangePipeline;
  check(value: unknown): boolean;
  scan(value: unknown): TextRangePipelineScanResult;
  censor(value: unknown, mask?: string): string;
  process(value: unknown, mask?: string): TextRangePipelineCensorResult;
}
