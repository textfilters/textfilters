import type {
  CodePointRange,
  UrlRangeMatchSink,
  UrlScanInput,
} from "../src/contracts.js";
import { createUrlScanner } from "../src/scanner.js";
import { DEFAULT_TLDS } from "../src/tlds.js";

export const mask = (value: string, maskChar = "*"): string =>
  maskChar.repeat(value.length);

export function scanUrlRanges(
  text: string,
  listedTlds: ReadonlySet<string> = new Set(DEFAULT_TLDS),
  _asciiTldTargets?: ReadonlySet<string>,
  allowedDomains: ReadonlySet<string> = new Set(),
): readonly CodePointRange[] {
  return createUrlScanner({
    tlds: [...listedTlds],
    allowedDomains: [...allowedDomains],
  }).scan({ text, codePoints: Array.from(text) }).ranges;
}

export function checkUrlRanges(
  input: UrlScanInput,
  listedTlds: ReadonlySet<string> = new Set(DEFAULT_TLDS),
  _asciiTldTargets?: ReadonlySet<string>,
  allowedDomains: ReadonlySet<string> = new Set(),
): boolean {
  return createUrlScanner({
    tlds: [...listedTlds],
    allowedDomains: [...allowedDomains],
  }).check(input);
}

export function scanUrlRangeMatches(
  input: UrlScanInput,
  sink: UrlRangeMatchSink,
  listedTlds: ReadonlySet<string> = new Set(DEFAULT_TLDS),
  _asciiTldTargets?: ReadonlySet<string>,
  allowedDomains: ReadonlySet<string> = new Set(),
): boolean | void {
  return createUrlScanner({
    tlds: [...listedTlds],
    allowedDomains: [...allowedDomains],
  }).scan(input, sink);
}
