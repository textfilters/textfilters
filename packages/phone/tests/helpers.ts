import type { CodePointRange } from "../src/contracts.js";
import { toRawChar } from "../src/digits.js";
import { createMeta } from "../src/meta.js";
import { collectCandidateRangeMatches } from "../src/scanner.js";

export interface PhoneScanHints {
  readonly digitCount?: number;
}

export interface PhoneScanInput {
  readonly text: string;
  readonly codePoints: readonly string[];
  readonly hints?: PhoneScanHints;
}

export interface PhoneRangeScanResult {
  readonly ranges: readonly CodePointRange[];
}

export type PhoneRangeMatchSink = (match: {
  readonly range: CodePointRange;
}) => boolean | void;

export interface PhoneRangeScanner {
  check(input: PhoneScanInput): boolean;
  scan(input: PhoneScanInput): PhoneRangeScanResult;
  scan(input: PhoneScanInput, sink: PhoneRangeMatchSink): boolean | void;
}

export function createPhoneScanner(): PhoneRangeScanner {
  function scan(input: PhoneScanInput): PhoneRangeScanResult;
  function scan(input: PhoneScanInput, sink: PhoneRangeMatchSink): boolean;
  function scan(input: PhoneScanInput, sink?: PhoneRangeMatchSink) {
    if (sink === undefined) return { ranges: scanPhoneRanges(input.text) };
    return scanPhoneRangeMatches(input, sink);
  }

  return { check: checkPhoneRanges, scan };
}

export function scanPhoneRanges(text: string): readonly CodePointRange[] {
  if (!hasPhoneCandidate(text)) return [];
  const ranges: CodePointRange[] = [];
  scanPhoneRangeMatches({ text, codePoints: Array.from(text) }, (match) => {
    ranges.push(match.range);
  });
  return ranges;
}

export function checkPhoneRanges(input: PhoneScanInput): boolean {
  if (!hasPhoneCandidateInput(input)) return false;
  let found = false;
  collectCandidateRangeMatches(createMeta(input.text), () => {
    found = true;
    return false;
  });
  return found;
}

export function scanPhoneRangeMatches(
  input: PhoneScanInput,
  sink: PhoneRangeMatchSink,
): boolean {
  if (!hasPhoneCandidateInput(input)) return true;

  let pending: CodePointRange | undefined;
  let stopped = false;
  const completed = collectCandidateRangeMatches(
    createMeta(input.text),
    (range) => {
      if (!pending) {
        pending = range;
      } else if (range[0] <= pending[1]) {
        pending = [pending[0], Math.max(pending[1], range[1])];
      } else {
        if (sink({ range: pending }) === false) {
          stopped = true;
          return false;
        }
        pending = range;
      }
      return true;
    },
  );

  if (stopped) return false;
  return pending === undefined || sink({ range: pending }) !== false
    ? completed !== false
    : false;
}

function hasPhoneCandidateInput(input: PhoneScanInput): boolean {
  if (
    input.hints?.digitCount !== undefined &&
    input.hints.digitCount < 10 &&
    /^[\x00-\x7f]*$/u.test(input.text)
  ) {
    return false;
  }
  return hasPhoneCandidate(input.text);
}

function hasPhoneCandidate(text: string): boolean {
  let digitCount = 0;
  for (const codePoint of text) {
    const raw = toRawChar(codePoint);
    if (raw >= "0" && raw <= "9" && ++digitCount >= 10) return true;
  }
  return false;
}
