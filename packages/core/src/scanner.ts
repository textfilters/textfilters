import type {
  AllocationAwareRangeScanner,
  PreparedText,
  RangeMatch,
  RangeMatchSink,
  TextCodePointRange,
  TextHints,
  TextRangePipeline,
  TextRangePipelineCensorResult,
  TextRangePipelineScanResult,
  TextRangeScanner,
  TextRangeScannerOutput,
  TextRangeScanMetadata,
  TextRangeScanResult,
  TextScanInput,
} from "./contracts.js";
import { normalizeTextInput } from "./input.js";
import { censorCodePointRanges } from "./masking.js";
import { mergeCodePointRanges } from "./ranges.js";

const UNICODE_PUNCTUATION_RE = /\p{P}/u;
const UNICODE_DECIMAL_DIGIT_RE = /\p{Decimal_Number}/u;
const preparedTextCache = new WeakSet<PreparedText>();

export function createTextScanInput(value: unknown): TextScanInput {
  const text = normalizeTextInput(value);
  return {
    text,
    codePoints: Array.from(text),
  };
}

export function createPreparedText(value: unknown): PreparedText {
  const text = normalizeTextInput(value);
  const codePoints = Array.from(text);
  const prepared = {
    text,
    codePoints,
    hints: createTextHints(text, codePoints),
  };
  preparedTextCache.add(prepared);
  return prepared;
}

export function createTextHints(
  text: string,
  codePoints: readonly string[] = Array.from(text),
): TextHints {
  let digitCount = 0;
  let punctuationCount = 0;
  let hasAsciiLetter = false;
  let hasWhitespace = false;
  let hasNonAscii = false;
  let hasAtSign = false;
  let hasDot = false;
  let hasSlash = false;
  let hasColon = false;
  let hasPlus = false;

  for (const codePoint of codePoints) {
    const code = codePoint.codePointAt(0) ?? 0;

    if (isWhitespaceCodePoint(codePoint)) {
      hasWhitespace = true;
      if (code > 0x7f) {
        hasNonAscii = true;
      }
      continue;
    }

    if (UNICODE_DECIMAL_DIGIT_RE.test(codePoint)) {
      digitCount++;
      if (code > 0x7f) {
        hasNonAscii = true;
      }
      continue;
    }

    const delimiterCode = hintDelimiterCodePoint(codePoint, code);
    hasAtSign ||= delimiterCode === 0x40;
    hasDot ||= delimiterCode === 0x2e;
    hasSlash ||= delimiterCode === 0x2f;
    hasColon ||= delimiterCode === 0x3a;
    hasPlus ||= delimiterCode === 0x2b;

    if (code > 0x7f) {
      hasNonAscii = true;
      if (UNICODE_PUNCTUATION_RE.test(codePoint)) {
        punctuationCount++;
      }
      continue;
    }

    if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
      hasAsciiLetter = true;
      continue;
    }

    if (code >= 0x21 && code <= 0x7e) {
      punctuationCount++;
    }
  }

  return {
    textLength: text.length,
    codePointLength: codePoints.length,
    isEmpty: text.length === 0,
    hasAsciiOnly: !hasNonAscii,
    hasNonAscii,
    hasDigit: digitCount > 0,
    digitCount,
    hasAsciiLetter,
    hasWhitespace,
    hasPunctuation: punctuationCount > 0,
    punctuationCount,
    hasAtSign,
    hasDot,
    hasSlash,
    hasColon,
    hasPlus,
  };
}

export function createTextRangeScanResult(
  ranges: readonly TextCodePointRange[],
  metadata?: TextRangeScanMetadata,
): TextRangeScanResult {
  return metadata === undefined
    ? { ranges: mergeCodePointRanges(ranges) }
    : { ranges: mergeCodePointRanges(ranges), metadata };
}

export function runTextRangeScanner(
  scanner: TextRangeScanner,
  input: TextScanInput,
): TextRangeScanResult {
  if (isAllocationAwareRangeScanner(scanner)) {
    const prepared = ensurePreparedText(input);
    const matches: RangeMatch[] = [];
    scanPreparedTextRanges(scanner, prepared, (match) => {
      const snapshot = snapshotRangeMatch(match);
      if (snapshot !== undefined) {
        matches.push(snapshot);
      }
    });
    return createTextRangeScanResult(
      matches.map((match) => match.range),
      scanMetadataFromMatches(matches),
    );
  }

  const output =
    typeof scanner === "function" ? scanner(input) : scanner.scan(input);
  return normalizeTextRangeScannerOutput(output);
}

export function createTextRangePipeline(): TextRangePipeline {
  const scanners: TextRangeScanner[] = [];

  const pipeline: TextRangePipeline = {
    use(scanner) {
      if (!isTextRangeScanner(scanner)) {
        throw new TypeError("scanner must be a function or scanner object");
      }

      scanners.push(scanner);
      return pipeline;
    },

    scan(value) {
      return scanTextRanges(value, scanners);
    },

    check(value) {
      return checkTextRanges(value, scanners);
    },

    censor(value, mask) {
      const result = pipeline.scan(value);
      return censorCodePointRanges(result.codePoints, result.ranges, mask);
    },

    process(value, mask) {
      const result = pipeline.scan(value);
      return {
        text: censorCodePointRanges(result.codePoints, result.ranges, mask),
        ranges: result.ranges,
        scanResults: result.scanResults,
      };
    },
  };

  return pipeline;
}

export function scanTextRanges(
  value: unknown,
  scanners: readonly TextRangeScanner[],
): TextRangePipelineScanResult {
  const input = scanners.some(isAllocationAwareRangeScanner)
    ? createPreparedText(value)
    : createTextScanInput(value);
  const scanResults = scanners.map((scanner) =>
    runTextRangeScanner(scanner, input),
  );
  const ranges = mergeCodePointRanges(
    scanResults.flatMap((result) => [...result.ranges]),
  );

  return {
    text: input.text,
    codePoints: input.codePoints,
    ranges,
    scanResults,
  };
}

export function checkTextRanges(
  value: unknown,
  scanners: readonly TextRangeScanner[],
): boolean {
  const input = createTextScanInput(value);
  let prepared: PreparedText | undefined;

  for (const scanner of scanners) {
    if (isAllocationAwareRangeScanner(scanner)) {
      prepared ??= ensurePreparedText(input);
      let found = false;
      scanPreparedTextRanges(scanner, prepared, (match) => {
        if (snapshotRangeMatch(match) === undefined) {
          return true;
        }

        found = true;
        return false;
      });
      if (found) return true;
      continue;
    }

    if (runTextRangeScanner(scanner, input).ranges.length > 0) return true;
  }

  return false;
}

export function scanPreparedTextRanges(
  scanner: AllocationAwareRangeScanner,
  input: PreparedText,
  sink: RangeMatchSink,
): boolean {
  if (!scanner.check(input)) return true;

  let shouldContinue = true;
  const stoppingSink: RangeMatchSink = (match) => {
    if (!shouldContinue) return false;

    const result = sink(match);
    shouldContinue = result !== false;
    return shouldContinue;
  };

  const result = scanner.scan(input, stoppingSink);
  return result === false ? false : shouldContinue;
}

function normalizeTextRangeScannerOutput(
  output: TextRangeScannerOutput,
): TextRangeScanResult {
  if (Array.isArray(output)) {
    return createTextRangeScanResult(output);
  }

  const result = output as TextRangeScanResult;
  return createTextRangeScanResult(result.ranges, result.metadata);
}

function isTextRangeScanner(scanner: unknown): scanner is TextRangeScanner {
  return (
    typeof scanner === "function" ||
    (typeof scanner === "object" &&
      scanner !== null &&
      "scan" in scanner &&
      typeof scanner.scan === "function")
  );
}

function isAllocationAwareRangeScanner(
  scanner: TextRangeScanner,
): scanner is AllocationAwareRangeScanner {
  return (
    typeof scanner === "object" &&
    scanner !== null &&
    "allocationAware" in scanner &&
    scanner.allocationAware === true &&
    "check" in scanner &&
    typeof scanner.check === "function" &&
    "scan" in scanner &&
    typeof scanner.scan === "function"
  );
}

function scanMetadataFromMatches(
  matches: readonly RangeMatch[],
): TextRangeScanMetadata | undefined {
  const metadata = matches.flatMap((match) =>
    match.metadata === undefined ? [] : [match.metadata],
  );

  return metadata.length === 0 ? undefined : { matches: metadata };
}

function snapshotRangeMatch(match: RangeMatch): RangeMatch | undefined {
  const range = normalizeCodePointRange(match.range);
  if (range === undefined) return undefined;

  return {
    range,
    ...(match.metadata === undefined
      ? {}
      : { metadata: { ...match.metadata } }),
  };
}

function normalizeCodePointRange(
  range: TextCodePointRange,
): TextCodePointRange | undefined {
  const start = Math.trunc(Number(range[0]));
  const end = Math.trunc(Number(range[1]));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  if (end <= start) return undefined;
  return [start, end];
}

function isWhitespaceCodePoint(codePoint: string): boolean {
  return /\s/u.test(codePoint);
}

function hintDelimiterCodePoint(codePoint: string, code: number): number {
  if (code <= 0x7f) return code;

  const normalized = codePoint.normalize("NFKC");
  return normalized.length === 1 ? (normalized.codePointAt(0) ?? code) : code;
}

function ensurePreparedText(input: TextScanInput): PreparedText {
  if (preparedTextCache.has(input as PreparedText)) {
    return input as PreparedText;
  }

  const hints = (input as { readonly hints?: unknown }).hints;
  const computedHints = createTextHints(input.text, input.codePoints);

  if (isSameTextHints(hints, computedHints)) {
    return input as PreparedText;
  }

  return {
    ...input,
    hints: computedHints,
  };
}

function isSameTextHints(
  actual: unknown,
  expected: TextHints,
): actual is TextHints {
  if (typeof actual !== "object" || actual === null) return false;

  const hints = actual as Partial<TextHints>;
  return (
    hints.textLength === expected.textLength &&
    hints.codePointLength === expected.codePointLength &&
    hints.isEmpty === expected.isEmpty &&
    hints.hasAsciiOnly === expected.hasAsciiOnly &&
    hints.hasNonAscii === expected.hasNonAscii &&
    hints.hasDigit === expected.hasDigit &&
    hints.digitCount === expected.digitCount &&
    hints.hasAsciiLetter === expected.hasAsciiLetter &&
    hints.hasWhitespace === expected.hasWhitespace &&
    hints.hasPunctuation === expected.hasPunctuation &&
    hints.punctuationCount === expected.punctuationCount &&
    hints.hasAtSign === expected.hasAtSign &&
    hints.hasDot === expected.hasDot &&
    hints.hasSlash === expected.hasSlash &&
    hints.hasColon === expected.hasColon &&
    hints.hasPlus === expected.hasPlus
  );
}
