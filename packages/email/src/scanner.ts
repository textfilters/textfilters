import {
  lowerNfkc,
  type TextCodePointRange,
  mergeCodePointRanges,
} from "@textfilters/core";

import { createEmailTextMeta } from "./normalization.js";
import { collectDirectEmailRange } from "./scanner/matching/direct.js";
import {
  collectObfuscatedEmailRangeMatches,
  collectObfuscatedEmailRanges,
  createObfuscatedEmailRangeCursor,
} from "./scanner/matching/obfuscated.js";
import { createExclusionSets } from "./scanner/rules/exclusions.js";
import { TOKEN_VALUE, type ScannerOptions } from "./scanner/core/types.js";
import {
  EMAIL_FILTER_NAME,
  type EmailFilterOptions,
  type EmailRangeMatchSink,
  type EmailRangeScanner,
  type EmailScanInput,
} from "./types.js";

export interface EmailScannerConfig extends EmailFilterOptions {}

export function createEmailScanner(
  config: EmailScannerConfig = {},
): EmailRangeScanner {
  const scannerOptions = createScannerOptions(config);

  function scan(input: EmailScanInput): {
    ranges: readonly TextCodePointRange[];
  };
  function scan(input: EmailScanInput, sink: EmailRangeMatchSink): boolean;
  function scan(input: EmailScanInput, sink?: EmailRangeMatchSink) {
    if (sink === undefined) {
      return {
        ranges: scanEmailRangesWithOptions(input.text, scannerOptions),
      };
    }

    return scanEmailRangeMatchesWithOptions(input, scannerOptions, sink);
  }

  return {
    name: EMAIL_FILTER_NAME,
    allocationAware: true,
    check(input) {
      return checkEmailRangesWithOptions(input, scannerOptions);
    },
    scan,
  };
}

export function scanEmailRanges(
  value: unknown,
  options: EmailFilterOptions = {},
): readonly TextCodePointRange[] {
  return scanEmailRangesWithOptions(
    String(value ?? ""),
    createScannerOptions(options),
  );
}

export function collectEmailRanges(
  value: string,
  options: EmailFilterOptions = {},
): readonly TextCodePointRange[] {
  return scanEmailRanges(value, options);
}

function createScannerOptions(options: EmailFilterOptions): ScannerOptions {
  return {
    allowLocalhost: options.allowLocalhost === true,
    allowSingleLabelDomain: options.allowSingleLabelDomain === true,
    matchObfuscated: options.matchObfuscated !== false,
    exclusions: createExclusionSets(
      options.excludeEmails,
      options.excludeUsernames,
      options.excludeDomains,
    ),
  };
}

function scanEmailRangesWithOptions(
  value: string,
  scannerOptions: ScannerOptions,
): readonly TextCodePointRange[] {
  if (
    !hasEmailCandidateInput({ text: value, codePoints: [] }, scannerOptions)
  ) {
    return [];
  }

  const meta = createEmailTextMeta(value);
  const ranges: TextCodePointRange[] = [];

  // Direct addresses are character-scanned around literal "@" so package
  // scopes and social handles can be rejected with boundary checks.
  for (let i = 0; i < meta.normalized.length; i++) {
    if (meta.normalized[i] !== TOKEN_VALUE.atSymbol) continue;
    const range = collectDirectEmailRange(meta, i, scannerOptions);
    if (range) {
      ranges.push(range);
      i = range[1] - 1;
    }
  }

  if (scannerOptions.matchObfuscated) {
    // Obfuscated addresses need token-level context because words around "at"
    // can be either mailbox introductions or ordinary prose/URL-like text.
    ranges.push(...collectObfuscatedEmailRanges(meta, scannerOptions));
  }
  return mergeCodePointRanges(ranges);
}

export function checkEmailRanges(
  input: EmailScanInput,
  options: EmailFilterOptions = {},
): boolean {
  return checkEmailRangesWithOptions(input, createScannerOptions(options));
}

export function scanEmailRangeMatches(
  input: EmailScanInput,
  sink: EmailRangeMatchSink,
  options: EmailFilterOptions = {},
): boolean {
  return scanEmailRangeMatchesWithOptions(
    input,
    createScannerOptions(options),
    sink,
  );
}

function checkEmailRangesWithOptions(
  input: EmailScanInput,
  scannerOptions: ScannerOptions,
): boolean {
  if (!hasEmailCandidateInput(input, scannerOptions)) return false;

  const meta = createEmailTextMeta(input.text);
  for (let i = 0; i < meta.normalized.length; i++) {
    if (meta.normalized[i] !== TOKEN_VALUE.atSymbol) continue;
    if (collectDirectEmailRange(meta, i, scannerOptions)) return true;
  }

  if (!scannerOptions.matchObfuscated) return false;

  let found = false;
  collectObfuscatedEmailRangeMatches(meta, scannerOptions, () => {
    found = true;
    return false;
  });
  return found;
}

function scanEmailRangeMatchesWithOptions(
  input: EmailScanInput,
  scannerOptions: ScannerOptions,
  sink: EmailRangeMatchSink,
): boolean {
  if (!hasEmailCandidateInput(input, scannerOptions)) return true;

  const meta = createEmailTextMeta(input.text);
  return streamMergedEmailRanges(meta, scannerOptions, (range) =>
    sink({ range }),
  );
}

interface RangeCursor {
  next(): TextCodePointRange | null;
}

function streamMergedEmailRanges(
  meta: ReturnType<typeof createEmailTextMeta>,
  scannerOptions: ScannerOptions,
  sink: (range: TextCodePointRange) => boolean | void,
): boolean {
  const direct = createDirectRangeCursor(meta, scannerOptions);
  const obfuscated = scannerOptions.matchObfuscated
    ? createObfuscatedRangeCursor(meta, scannerOptions)
    : emptyRangeCursor();
  let nextDirect = direct.next();
  let nextObfuscated = obfuscated.next();
  let pending: TextCodePointRange | null = null;

  const takeNext = (): TextCodePointRange | null => {
    if (nextDirect === null && nextObfuscated === null) return null;
    if (nextDirect === null) {
      const range = nextObfuscated;
      nextObfuscated = obfuscated.next();
      return range;
    }
    if (nextObfuscated === null) {
      const range = nextDirect;
      nextDirect = direct.next();
      return range;
    }
    if (
      nextDirect[0] < nextObfuscated[0] ||
      (nextDirect[0] === nextObfuscated[0] &&
        nextDirect[1] <= nextObfuscated[1])
    ) {
      const range = nextDirect;
      nextDirect = direct.next();
      return range;
    }

    const range = nextObfuscated;
    nextObfuscated = obfuscated.next();
    return range;
  };

  for (let range = takeNext(); range !== null; range = takeNext()) {
    if (pending === null) {
      pending = range;
      continue;
    }

    if (range[0] <= pending[1]) {
      pending = [pending[0], Math.max(pending[1], range[1])];
      continue;
    }

    if (sink(pending) === false) return false;
    pending = range;
  }

  return pending === null || sink(pending) !== false;
}

function createDirectRangeCursor(
  meta: ReturnType<typeof createEmailTextMeta>,
  scannerOptions: ScannerOptions,
): RangeCursor {
  let index = 0;

  return {
    next() {
      for (; index < meta.normalized.length; index++) {
        if (meta.normalized[index] !== TOKEN_VALUE.atSymbol) continue;
        const range = collectDirectEmailRange(meta, index, scannerOptions);
        if (range) {
          index = range[1];
          return range;
        }
      }

      return null;
    },
  };
}

function createObfuscatedRangeCursor(
  meta: ReturnType<typeof createEmailTextMeta>,
  scannerOptions: ScannerOptions,
): RangeCursor {
  return createObfuscatedEmailRangeCursor(meta, scannerOptions);
}

function emptyRangeCursor(): RangeCursor {
  return {
    next() {
      return null;
    },
  };
}

function hasEmailCandidateInput(
  input: EmailScanInput,
  scannerOptions: ScannerOptions,
): boolean {
  if (!input.text) return false;

  const hints = input.hints;
  if (
    hints !== undefined &&
    hints.hasAtSign === false &&
    hints.hasDot === false &&
    hints.hasNonAscii === false &&
    !hasObfuscatedEmailWordCandidate(input.text)
  ) {
    return false;
  }

  return hasEmailCandidate(input.text, scannerOptions);
}

function hasEmailCandidate(
  value: string,
  scannerOptions: ScannerOptions,
): boolean {
  const normalized = lowerNfkc(value);
  if (normalized.includes(TOKEN_VALUE.atSymbol)) return true;
  if (!scannerOptions.matchObfuscated) return false;

  if (!hasWordCandidate(normalized, TOKEN_VALUE.atWord)) return false;
  return (
    scannerOptions.allowLocalhost ||
    scannerOptions.allowSingleLabelDomain ||
    normalized.includes(TOKEN_VALUE.dotSymbol) ||
    hasWordCandidate(normalized, TOKEN_VALUE.dotWord)
  );
}

function hasObfuscatedEmailWordCandidate(value: string): boolean {
  return /[aA][tT]|[dD][oO0][tT]/u.test(value);
}

function hasWordCandidate(value: string, word: string): boolean {
  for (
    let index = value.indexOf(word);
    index >= 0;
    index = value.indexOf(word, index + 1)
  ) {
    const before = value[index - 1] ?? "";
    const after = value[index + word.length] ?? "";
    if (!isAsciiLetter(before) && !isAsciiLetter(after)) {
      return true;
    }
  }

  return false;
}

function isAsciiLetter(value: string): boolean {
  return value.length === 1 && value >= "a" && value <= "z";
}
