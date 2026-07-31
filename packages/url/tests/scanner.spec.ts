import { describe, expect, it } from "vitest";

import {
  checkUrlRanges,
  createUrlFilter,
  createUrlScanner,
  scanUrlRangeMatches,
  scanUrlRanges,
  type UrlRangeScanner,
  type UrlRangeScanResult,
  type UrlScanHints,
} from "../src/index.js";
import { mask } from "./helpers.js";

describe("URL scanner", () => {
  it("keeps scanner contracts compatible with shared range shapes", () => {
    const scanner: UrlRangeScanner = createUrlScanner();
    const hints: UrlScanHints = {
      hasNonAscii: false,
      hasDot: true,
      hasSlash: false,
      hasColon: false,
    };
    const text = "visit example.com now";
    const result: UrlRangeScanResult = scanner.scan({
      text,
      codePoints: Array.from(text),
      hints,
    });

    expect(result).toEqual({ ranges: [[6, 17]] });
  });

  it("exposes scanner ranges compatible with code point masking", () => {
    const scanner = createUrlScanner();
    expect(
      scanner.scan({
        text: "visit https://example.com now",
        codePoints: Array.from("visit https://example.com now"),
      }),
    ).toEqual({
      ranges: [[6, 25]],
    });
  });

  it("keeps the public censor wrapper aligned with scanner ranges", () => {
    const text = "go https://example.com/path now";
    const scanner = createUrlScanner();
    const ranges = scanner.scan({
      text,
      codePoints: Array.from(text),
    }).ranges;

    expect(ranges).toEqual([[3, 27]]);
    expect(createUrlFilter({ maskChar: "#" }).censor(text)).toBe(
      `go ${mask("https://example.com/path", "#")} now`,
    );
  });

  it("checks URL candidates without collecting every range", () => {
    const scanner = createUrlScanner();
    const text = "visit https://example.com and https://second.example now";
    const input = { text, codePoints: Array.from(text) };

    expect(scanner.check(input)).toBe(true);
    expect(scanner.check({ text: "plain words only", codePoints: [] })).toBe(
      false,
    );
    expect(checkUrlRanges(input)).toBe(true);
  });

  it("streams scanner ranges into a sink and supports early stop", () => {
    const scanner = createUrlScanner();
    const text = "visit example.com and example.org now";
    const seen: Array<readonly [number, number]> = [];

    const completed = scanner.scan(
      { text, codePoints: Array.from(text) },
      (match) => {
        seen.push(match.range);
        return false;
      },
    );

    expect(completed).toBe(false);
    expect(seen).toEqual([[6, 17]]);
  });

  it("uses shared-style hints to skip clearly clean text", () => {
    expect(
      checkUrlRanges({
        text: "plain words only",
        codePoints: Array.from("plain words only"),
        hints: {
          hasNonAscii: false,
          hasDot: false,
          hasSlash: false,
          hasColon: false,
        },
      }),
    ).toBe(false);
  });

  it("does not let false shared hints hide split-dot URLs", () => {
    const scanner = createUrlScanner();
    const text = "visit example d o t com";
    const input = {
      text,
      codePoints: Array.from(text),
      hints: {
        hasNonAscii: false,
        hasDot: false,
        hasSlash: false,
        hasColon: false,
      },
    };
    const seen: Array<readonly [number, number]> = [];

    expect(scanner.check(input)).toBe(true);
    expect(
      scanner.scan(input, (match) => {
        seen.push(match.range);
        return false;
      }),
    ).toBe(false);
    expect(seen).toEqual([[6, 23]]);
  });

  it("streams prefixed, bare-domain, and punctuation-trimmed ranges", () => {
    const text = "go https://example.com/path, then example.org.";
    const seen: Array<readonly [number, number]> = [];

    expect(
      scanUrlRangeMatches({ text, codePoints: Array.from(text) }, (match) => {
        seen.push(match.range);
      }),
    ).toBe(true);
    expect(seen).toEqual([
      [3, 27],
      [34, 45],
    ]);
  });

  it("supports custom TLD configuration", () => {
    expect(scanUrlRanges("go svc.internal", new Set(["internal"]))).toEqual([
      [3, 15],
    ]);
    expect(scanUrlRanges("go svc.internal")).toEqual([]);
    expect(scanUrlRanges("go example.com", new Set(["internal"]))).toEqual([]);
  });

  it("keeps allowlist behavior aligned across scanner APIs", () => {
    const scanner = createUrlScanner({ allowedDomains: ["trusted.com"] });
    const allowedText = "visit trusted.com/path now";
    const mixedText = "visit trusted.com/path and https://blocked.org/path now";
    const blocked = "https://blocked.org/path";
    const blockedStart = Array.from(
      mixedText.slice(0, mixedText.indexOf(blocked)),
    ).length;
    const blockedEnd = blockedStart + Array.from(blocked).length;
    const mixedInput = { text: mixedText, codePoints: Array.from(mixedText) };
    const seen: Array<readonly [number, number]> = [];

    expect(
      scanner.scan({ text: allowedText, codePoints: Array.from(allowedText) }),
    ).toEqual({ ranges: [] });
    expect(
      scanner.check({
        text: allowedText,
        codePoints: Array.from(allowedText),
      }),
    ).toBe(false);
    expect(scanner.scan(mixedInput)).toEqual({
      ranges: [[blockedStart, blockedEnd]],
    });
    expect(scanner.check(mixedInput)).toBe(true);
    expect(
      scanner.scan(mixedInput, (match) => {
        seen.push(match.range);
      }),
    ).toBe(true);
    expect(seen).toEqual([[blockedStart, blockedEnd]]);
  });

  it("returns no ranges for clearly clean text", () => {
    const scanner = createUrlScanner();
    expect(
      scanner.scan({
        text: "plain words only",
        codePoints: Array.from("plain words only"),
      }),
    ).toEqual({ ranges: [] });
  });

  it("keeps obfuscated URL coverage through the scanner path", () => {
    const astralLetter = "\u{10437}";
    const cyrillicO = "\u043e";
    const rawDotWord = ["\u0442", "\u043e", "\u0447", "\u043a", "\u0430"].join(
      " ",
    );

    expect(scanUrlRanges(`${astralLetter}.com`)).toEqual([[0, 5]]);
    expect(scanUrlRanges("visit hxxp[:]//example[.]com")).toEqual([[6, 28]]);
    expect(scanUrlRanges("visit example dot com")).toEqual([[6, 21]]);
    expect(scanUrlRanges("visit example d o t com")).toEqual([[6, 23]]);
    expect(scanUrlRanges("visit example d-o-t com")).toEqual([[6, 23]]);
    expect(scanUrlRanges(`visit example d${cyrillicO}t com`)).toEqual([
      [6, 21],
    ]);
    expect(scanUrlRanges("visit example ( . ) com")).toEqual([[6, 23]]);
    expect(scanUrlRanges("visit example { . } com")).toEqual([[6, 23]]);
    expect(scanUrlRanges(`visit example ${rawDotWord} com`)).toEqual([[6, 27]]);
    expect(scanUrlRanges("example(.)com")).toEqual([[0, 13]]);
    expect(scanUrlRanges("example{.}com")).toEqual([[0, 13]]);
    expect(scanUrlRanges("example。com")).toEqual([[0, 11]]);
  });
});
