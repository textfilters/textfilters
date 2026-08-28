import { describe, expect, it, vi } from "vitest";

import { filter } from "../src/index.js";
import {
  checkPhoneRanges,
  createPhoneScanner,
  scanPhoneRangeMatches,
  scanPhoneRanges,
  type PhoneRangeScanner,
  type PhoneRangeScanResult,
  type PhoneScanHints,
} from "./helpers.js";

const mask = (value: string, maskChar = "*"): string =>
  maskChar.repeat(Array.from(value).length);

describe("@textfilters/phone scanner", () => {
  it("keeps scanner contracts compatible with shared range shapes", () => {
    const scanner: PhoneRangeScanner = createPhoneScanner();
    const hints: PhoneScanHints = {
      textLength: "call +1 202 555 0187 now".length,
      digitCount: 11,
      hasPlus: true,
      hasPunctuation: true,
    };
    const text = "call +1 202 555 0187 now";
    const result: PhoneRangeScanResult = scanner.scan({
      text,
      codePoints: Array.from(text),
      hints,
    });

    expect(result).toEqual({ ranges: [[5, 20]] });
  });

  it("exposes scanner ranges compatible with code point masking", () => {
    const scanner = createPhoneScanner();
    expect(
      scanner.scan({
        text: "call +1 202 555 0187 now",
        codePoints: Array.from("call +1 202 555 0187 now"),
      }),
    ).toEqual({
      ranges: [[5, 20]],
    });
  });

  it("keeps the public censor wrapper aligned with scanner ranges", () => {
    const text = "call +1 202 555 0187 now";
    const scanner = createPhoneScanner();
    const ranges = scanner.scan({
      text,
      codePoints: Array.from(text),
    }).ranges;

    expect(ranges).toEqual([[5, 20]]);
    expect(filter.censor(text, "#")).toBe(
      `call ${mask("+1 202 555 0187", "#")} now`,
    );
  });

  it("keeps accepted phone coverage through the scanner path", () => {
    expect(scanPhoneRanges("+7 (999) 123-45-67")).toEqual([[0, 18]]);
    expect(scanPhoneRanges("call １２３４５６７８９０ now")).toEqual([[5, 15]]);
    expect(scanPhoneRanges("call ٧٩٩٩١٢٣٤٥٦٧ now")).toEqual([[5, 16]]);
  });

  it("rejects zero-only candidates across scanner APIs", () => {
    for (const text of [
      "0000000000000",
      "000000000000",
      "1.2.3 0000000000",
      "1.2.3 000 000 0000",
      "55.75 0000000000",
      "55.75 000 000 0000",
      "+0000000000",
      "(0000) 000 000",
      "٠٠٠٠٠٠٠٠٠٠",
      "００００００００００",
    ]) {
      const input = { text, codePoints: Array.from(text) };

      expect(scanPhoneRanges(text)).toEqual([]);
      expect(checkPhoneRanges(input)).toBe(false);
      expect(filter.censor(text)).toBe(text);
    }
  });

  it("rescans valid phones after zero-only placeholders", () => {
    const cases = [
      ["000 000 0000 ", "12 3456 7890"],
      ["0000000000 ", "(12) 3456 7890"],
      ["0000000000 ", "(123) 456 7890"],
      ["0000000000 ", "(1234) 567 890"],
      ["0000000000 ", "( 1234) 567 890"],
      ["0000000000 ", "（1234） 567 890"],
      ["0000000000 ", "(1234 123 456 )"],
      ["0000000000 ", "((1234) 567 890)"],
      ["0000000000 ", "( (1234) 567 890 )"],
    ] as const;

    for (const [placeholder, phone] of cases) {
      const text = placeholder + phone;
      const start = Array.from(placeholder).length;
      const input = { text, codePoints: Array.from(text) };

      expect(scanPhoneRanges(text)).toEqual([
        [start, start + Array.from(phone).length],
      ]);
      expect(checkPhoneRanges(input)).toBe(true);
      expect(filter.censor(text)).toBe(placeholder + mask(phone));
    }
  });

  it("does not let short tails bypass zero-only rejection", () => {
    for (const text of [
      "000 000 0000 12",
      "000 000 0000 123",
      "000 000 0000 1234",
      "+000 000 0000 12",
      "(000 000 0000) 12",
    ]) {
      const input = { text, codePoints: Array.from(text) };

      expect(scanPhoneRanges(text)).toEqual([]);
      expect(checkPhoneRanges(input)).toBe(false);
      expect(filter.censor(text)).toBe(text);
    }
  });

  it("keeps shared outer wrappers outside recovered phone ranges", () => {
    const cases = [
      ["(0000000000 ", "79991234567", ")"],
      ["((0000000000) ", "79991234567", ")"],
      ["1.2.3 (0000000000 ", "79991234567", ")"],
    ] as const;

    for (const [prefix, phone, suffix] of cases) {
      const text = prefix + phone + suffix;
      const start = Array.from(prefix).length;

      expect(scanPhoneRanges(text)).toEqual([
        [start, start + Array.from(phone).length],
      ]);
      expect(filter.censor(text)).toBe(prefix + mask(phone) + suffix);
    }
  });

  it("handles long grouped zero runs without producing ranges", () => {
    const text = Array.from({ length: 800 }, () => "0").join(" ");
    const input = { text, codePoints: Array.from(text) };

    expect(scanPhoneRanges(text)).toEqual([]);
    expect(checkPhoneRanges(input)).toBe(false);
  });

  it("preserves phone extensions after zero-only placeholders", () => {
    const cases = [
      ["0000000000 ", "79991234567", "x123"],
      ["0000000000 ", "79991234567", "ext123"],
      ["0000000000 ", "79991234567", "ext.123"],
      ["0000000000 ", "(1234) 567 890", "x123"],
    ] as const;

    for (const [placeholder, phone, extension] of cases) {
      const text = placeholder + phone + extension;
      const start = Array.from(placeholder).length;
      const input = { text, codePoints: Array.from(text) };

      expect(scanPhoneRanges(text)).toEqual([
        [start, start + Array.from(phone).length],
      ]);
      expect(checkPhoneRanges(input)).toBe(true);
      expect(filter.censor(text)).toBe(placeholder + mask(phone) + extension);
    }
  });

  it("preserves structured prefixes before zero placeholders and phones", () => {
    for (const prefix of ["1.2.3 ", "55.75 ", "55,75 ", "1,234.56 "]) {
      const placeholder = "0000000000 ";
      const phone = "79991234567";
      const text = prefix + placeholder + phone;
      const start = Array.from(prefix + placeholder).length;
      const input = { text, codePoints: Array.from(text) };

      expect(scanPhoneRanges(text)).toEqual([
        [start, start + Array.from(phone).length],
      ]);
      expect(checkPhoneRanges(input)).toBe(true);
      expect(filter.censor(text)).toBe(prefix + placeholder + mask(phone));
    }
  });

  it("rescans multiple phones and trailing numbers after zero placeholders", () => {
    const multiple = "0000000000 7999 123 456 202 555 0187";
    const firstPhone = "7999 123 456";
    const secondPhone = "202 555 0187";
    const firstStart = Array.from(
      multiple.slice(0, multiple.indexOf(firstPhone)),
    ).length;
    const secondStart = Array.from(
      multiple.slice(0, multiple.indexOf(secondPhone)),
    ).length;

    expect(scanPhoneRanges(multiple)).toEqual([
      [firstStart, firstStart + Array.from(firstPhone).length],
      [secondStart, secondStart + Array.from(secondPhone).length],
    ]);
    expect(filter.censor(multiple)).toBe(
      `0000000000 ${mask(firstPhone)} ${mask(secondPhone)}`,
    );

    const trailing = "0000000000 79991234567 123456";
    const phone = "79991234567";
    const phoneStart = Array.from(
      trailing.slice(0, trailing.indexOf(phone)),
    ).length;
    expect(scanPhoneRanges(trailing)).toEqual([
      [phoneStart, phoneStart + Array.from(phone).length],
    ]);
    expect(
      checkPhoneRanges({ text: trailing, codePoints: Array.from(trailing) }),
    ).toBe(true);
    expect(filter.censor(trailing)).toBe(`0000000000 ${mask(phone)} 123456`);
  });

  it("returns no ranges for clearly clean text", () => {
    const scanner = createPhoneScanner();
    expect(
      scanner.scan({
        text: "plain words only",
        codePoints: Array.from("plain words only"),
      }),
    ).toEqual({ ranges: [] });
  });

  it("checks phone candidates without collecting every range", () => {
    const scanner = createPhoneScanner();
    const text = "call +1 202 555 0187 or +1 303 555 0199";
    const input = { text, codePoints: Array.from(text) };

    expect(scanner.check(input)).toBe(true);
    expect(checkPhoneRanges(input)).toBe(true);
    expect(scanner.check({ text: "plain words only", codePoints: [] })).toBe(
      false,
    );
  });

  it("streams ranges into a sink and supports early stop", () => {
    const scanner = createPhoneScanner();
    const text = "call +1 202 555 0187 or +1 303 555 0199";
    const seen: Array<readonly [number, number]> = [];

    const completed = scanner.scan(
      { text, codePoints: Array.from(text) },
      (match) => {
        seen.push(match.range);
        return false;
      },
    );

    expect(completed).toBe(false);
    expect(seen).toEqual([[5, 20]]);
  });

  it("uses shared-style hints to skip low-digit text", () => {
    expect(
      checkPhoneRanges({
        text: "code 12345",
        codePoints: Array.from("code 12345"),
        hints: {
          textLength: "code 12345".length,
          digitCount: 5,
          hasPlus: false,
          hasPunctuation: false,
        },
      }),
    ).toBe(false);
  });

  it("does not let non-folded digit hints hide foldable phone digits", () => {
    const scanner = createPhoneScanner();
    const text = "call ⁰¹²³⁴⁵⁶⁷⁸⁹";
    const input = {
      text,
      codePoints: Array.from(text),
      hints: {
        textLength: text.length,
        digitCount: 0,
        hasPlus: false,
        hasPunctuation: false,
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
    expect(seen).toEqual([[5, 15]]);
  });

  it("streams separated, plus-prefixed, and punctuated ranges", () => {
    const text = "call +1 (202) 555-0187, then 303.555.0199";
    const seen: Array<readonly [number, number]> = [];

    expect(
      scanPhoneRangeMatches({ text, codePoints: Array.from(text) }, (match) => {
        seen.push(match.range);
      }),
    ).toBe(true);
    expect(seen).toEqual([
      [5, 22],
      [29, 41],
    ]);
  });

  it("streams merged adjacent ranges", () => {
    const text = "79991234567(79991234567) or 79991234568";
    const seen: Array<readonly [number, number]> = [];

    expect(
      scanPhoneRangeMatches({ text, codePoints: Array.from(text) }, (match) => {
        seen.push(match.range);
        return false;
      }),
    ).toBe(false);
    expect(scanPhoneRanges("79991234567(79991234567)")).toEqual([[0, 24]]);
    expect(seen).toEqual([[0, 24]]);
  });

  it("keeps general structured-number false-positive guards", () => {
    for (const text of [
      "2026-03-22 12:34:56",
      "192.168.1.1:8080",
      "55.7558, 37.6173",
      "version 1.2.3.456",
      "balance 1,234,567.89",
    ]) {
      expect(scanPhoneRanges(text)).toEqual([]);
      expect(filter.censor(text)).toBe(text);
    }
  });

  it("does not trust JSON or machine metadata", () => {
    const text = '{"serverTs":1784477618588}';
    const value = "1784477618588";
    const start = text.indexOf(value);

    expect(scanPhoneRanges(text)).toEqual([[start, start + value.length]]);
    expect(filter.find(text).map((match) => match.value)).toContain(value);
  });
});
