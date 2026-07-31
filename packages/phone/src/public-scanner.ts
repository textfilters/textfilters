import { type TextCodePointRange } from "@textfilters/core";

import {
  PHONE_FILTER_NAME,
  type PhoneRangeMatchSink,
  type PhoneRangeScanner,
  type PhoneScannerConfig,
  type PhoneScanInput,
} from "./contracts.js";
import { toRawChar } from "./digits.js";
import { createMeta } from "./meta.js";
import { collectRanges } from "./ranges.js";
import { collectCandidateRangeMatches } from "./scanner.js";

export function createPhoneScanner(
  _config: PhoneScannerConfig = {},
): PhoneRangeScanner {
  function scan(input: PhoneScanInput): {
    ranges: readonly TextCodePointRange[];
  };
  function scan(input: PhoneScanInput, sink: PhoneRangeMatchSink): boolean;
  function scan(input: PhoneScanInput, sink?: PhoneRangeMatchSink) {
    if (sink === undefined) {
      return {
        ranges: scanPhoneRanges(input.text),
      };
    }

    return scanPhoneRangeMatches(input, sink);
  }

  return {
    name: PHONE_FILTER_NAME,
    allocationAware: true,
    check(input) {
      return checkPhoneRanges(input);
    },
    scan,
  };
}

export function scanPhoneRanges(text: unknown): readonly TextCodePointRange[] {
  const source = String(text ?? "");
  if (!source || !hasPhoneCandidate(source)) return [];

  const meta = createMeta(source);
  return collectRanges(meta);
}

export function checkPhoneRanges(input: PhoneScanInput): boolean {
  if (!hasPhoneCandidateInput(input)) return false;

  const meta = createMeta(input.text);
  let found = false;
  collectCandidateRangeMatches(meta, () => {
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

  const meta = createMeta(input.text);
  let pending: TextCodePointRange | null = null;
  let stopped = false;

  const completed = collectCandidateRangeMatches(meta, (range) => {
    if (pending === null) {
      pending = range;
      return true;
    }

    if (range[0] <= pending[1]) {
      pending = [pending[0], Math.max(pending[1], range[1])];
      return true;
    }

    if (sink({ range: pending }) === false) {
      stopped = true;
      return false;
    }

    pending = range;
    return true;
  });

  if (stopped) return false;
  if (pending === null) return completed !== false;
  return sink({ range: pending }) !== false && completed !== false;
}

function hasPhoneCandidate(source: string): boolean {
  let digitCount = 0;

  for (const codePoint of Array.from(source)) {
    const raw = toRawChar(codePoint);
    if (raw >= "0" && raw <= "9") {
      digitCount++;
      if (digitCount >= 10) return true;
    }
  }

  return false;
}

function hasPhoneCandidateInput(input: PhoneScanInput): boolean {
  const hints = input.hints;
  if (
    hints?.digitCount !== undefined &&
    hints.digitCount < 10 &&
    hasAsciiOnly(input.text)
  ) {
    return false;
  }

  return hasPhoneCandidate(input.text);
}

function hasAsciiOnly(source: string): boolean {
  for (let index = 0; index < source.length; index++) {
    if (source.charCodeAt(index) > 0x7f) return false;
  }

  return true;
}
