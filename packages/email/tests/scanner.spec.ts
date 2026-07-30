import { describe, expect, it } from "vitest";

import {
  checkEmailRanges,
  createEmailFilter,
  createEmailScanner,
  scanEmailRangeMatches,
  scanEmailRanges,
  EMAIL_FILTER_NAME,
  type EmailRangeScanner,
  type EmailRangeScanResult,
  type EmailScanHints,
} from "../src/index.js";

const mask = (value: string, maskChar = "*"): string =>
  maskChar.repeat(Array.from(value).length);

describe("@textfilters/email scanner", () => {
  it("keeps scanner contracts compatible with shared range shapes", () => {
    const scanner: EmailRangeScanner = createEmailScanner();
    const hints: EmailScanHints = {
      textLength: "contact user@example.com now".length,
      hasNonAscii: false,
      hasAtSign: true,
      hasDot: true,
    };
    const text = "contact user@example.com now";
    const result: EmailRangeScanResult = scanner.scan({
      text,
      codePoints: Array.from(text),
      hints,
    });

    expect(result).toEqual({ ranges: [[8, 24]] });
  });

  it("exposes scanner ranges compatible with code point masking", () => {
    const scanner = createEmailScanner();
    expect(
      scanner.scan({
        text: "contact user@example.com now",
        codePoints: Array.from("contact user@example.com now"),
      }),
    ).toEqual({
      ranges: [[8, 24]],
    });
    expect(scanner.name).toBe(EMAIL_FILTER_NAME);
  });

  it("keeps the public censor wrapper aligned with scanner ranges", () => {
    const text = "contact user@example.com now";
    const scanner = createEmailScanner();
    const ranges = scanner.scan({
      text,
      codePoints: Array.from(text),
    }).ranges;

    expect(ranges).toEqual([[8, 24]]);
    expect(createEmailFilter({ maskChar: "#" }).censor(text)).toBe(
      `contact ${mask("user@example.com", "#")} now`,
    );
  });

  it("keeps direct and obfuscated coverage through the scanner path", () => {
    expect(scanEmailRanges("contact user@example.com")).toEqual([[8, 24]]);
    expect(scanEmailRanges("contact user [at] example [dot] com")).toEqual([
      [8, 35],
    ]);
    expect(scanEmailRanges("contact user(at)example(dot)com")).toEqual([
      [8, 31],
    ]);
    expect(scanEmailRanges("contact user [@] example [.] com")).toEqual([
      [8, 32],
    ]);
  });

  it("returns no ranges for clearly clean text", () => {
    const scanner = createEmailScanner();
    expect(
      scanner.scan({
        text: "plain words only",
        codePoints: Array.from("plain words only"),
      }),
    ).toEqual({ ranges: [] });
  });

  it("checks candidates without collecting every range", () => {
    const scanner = createEmailScanner();
    const text = "contact first@example.com and second@example.com";
    const input = { text, codePoints: Array.from(text) };

    expect(scanner.check(input)).toBe(true);
    expect(checkEmailRanges(input)).toBe(true);
    expect(scanner.check({ text: "plain words only", codePoints: [] })).toBe(
      false,
    );
  });

  it("streams ranges into a sink and supports early stop", () => {
    const scanner = createEmailScanner();
    const text = "contact first@example.com and second@example.com";
    const seen: Array<readonly [number, number]> = [];

    const completed = scanner.scan(
      { text, codePoints: Array.from(text) },
      (match) => {
        seen.push(match.range);
        return false;
      },
    );

    expect(completed).toBe(false);
    expect(seen).toEqual([[8, 25]]);
  });

  it("streams mixed direct and obfuscated ranges in source order", () => {
    const scanner = createEmailScanner();
    const text = "user at example dot com then admin@example.org";
    const seen: Array<readonly [number, number]> = [];

    const completed = scanner.scan(
      { text, codePoints: Array.from(text) },
      (match) => {
        seen.push(match.range);
        return false;
      },
    );

    expect(completed).toBe(false);
    expect(seen).toEqual([[0, 23]]);
  });

  it("merges overlapping direct and obfuscated ranges before streaming", () => {
    const scanner = createEmailScanner();
    const text = "user@example.com dot org";
    const seen: Array<readonly [number, number]> = [];

    const completed = scanner.scan(
      { text, codePoints: Array.from(text) },
      (match) => {
        seen.push(match.range);
        return false;
      },
    );

    expect(completed).toBe(false);
    expect(seen).toEqual([[0, 24]]);
  });

  it("uses shared-style hints to skip clearly clean text", () => {
    expect(
      checkEmailRanges({
        text: "plain words only",
        codePoints: Array.from("plain words only"),
        hints: {
          textLength: "plain words only".length,
          hasNonAscii: false,
          hasAtSign: false,
          hasDot: false,
        },
      }),
    ).toBe(false);
  });

  it("streams direct, punctuation-trimmed, and obfuscated ranges", () => {
    const text = "mail user@example.com, then admin [at] example [dot] org.";
    const seen: Array<readonly [number, number]> = [];

    expect(
      scanEmailRangeMatches({ text, codePoints: Array.from(text) }, (match) => {
        seen.push(match.range);
      }),
    ).toBe(true);
    expect(seen).toEqual([
      [5, 21],
      [28, 56],
    ]);
  });

  it("preserves scanner option behavior", () => {
    expect(
      scanEmailRanges("contact user at example dot com", {
        matchObfuscated: false,
      }),
    ).toEqual([]);
    expect(
      scanEmailRanges("contact user@example.com", {
        excludeEmails: ["user@example.com"],
      }),
    ).toEqual([]);
  });
});
