import { createEmailTextMeta } from "./normalization.js";
import { collectDirectEmailRange } from "./scanner/matching/direct.js";
import { collectObfuscatedEmailRangeMatches } from "./scanner/matching/obfuscated.js";
import { createExclusionSets } from "./scanner/rules/exclusions.js";
import { TOKEN_VALUE, type ScannerOptions } from "./scanner/core/types.js";
import {
  type CodePointRange as TextCodePointRange,
  type EmailFilterOptions,
} from "./types.js";

const lowerNfkc = (text: string): string =>
  text.normalize("NFKC").toLowerCase();

export function createEmailScanner(config: EmailFilterOptions = {}) {
  const options = createScannerOptions(config);
  return {
    check: (text: string) => checkEmailRangesWithOptions(text, options),
    scan: (text: string) => scanEmailRangesWithOptions(text, options),
  };
}

function createScannerOptions(options: EmailFilterOptions): ScannerOptions {
  return {
    matchObfuscated: options.matchObfuscated !== false,
    exclusions: createExclusionSets(
      options.allowedEmails,
      options.allowedUsernames,
      options.allowedDomains,
    ),
  };
}

function scanEmailRangesWithOptions(
  value: string,
  scannerOptions: ScannerOptions,
): readonly TextCodePointRange[] {
  if (!hasEmailCandidate(value, scannerOptions)) {
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
    collectObfuscatedEmailRangeMatches(meta, scannerOptions, (range) => {
      ranges.push(range);
    });
  }
  return mergeCodePointRanges(ranges);
}

function checkEmailRangesWithOptions(
  value: string,
  scannerOptions: ScannerOptions,
): boolean {
  if (!hasEmailCandidate(value, scannerOptions)) return false;

  const meta = createEmailTextMeta(value);
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

function hasEmailCandidate(
  value: string,
  scannerOptions: ScannerOptions,
): boolean {
  const normalized = lowerNfkc(value);
  if (normalized.includes(TOKEN_VALUE.atSymbol)) return true;
  if (!scannerOptions.matchObfuscated) return false;

  if (!hasWordCandidate(normalized, TOKEN_VALUE.atWord)) return false;
  return (
    normalized.includes(TOKEN_VALUE.dotSymbol) ||
    hasWordCandidate(normalized, TOKEN_VALUE.dotWord)
  );
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

function mergeCodePointRanges(
  ranges: readonly TextCodePointRange[],
): readonly TextCodePointRange[] {
  const sorted = [...ranges].sort(
    (left, right) => left[0] - right[0] || left[1] - right[1],
  );
  const merged: Array<[number, number]> = [];

  for (const [start, end] of sorted) {
    if (start < 0 || end <= start) continue;
    const previous = merged[merged.length - 1];
    if (!previous || start > previous[1]) {
      merged.push([start, end]);
    } else {
      previous[1] = Math.max(previous[1], end);
    }
  }

  return merged;
}
