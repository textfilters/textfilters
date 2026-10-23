import { describe, expect, it } from "vitest";

import { filter } from "../src/index.js";
import { toRawChar } from "../src/digits.js";

describe("phone candidate regression", () => {
  it.each([
    "10/07 2026 14 04 04",
    "10/07 2026 14 04 04 nostalgia for the old days",
    "10/07 2026 14:04:04",
    "10/07\u00a02026 14 04 04",
    "29/02 2024 14 04 04",
    "07/30 2026 14 04 04",
    "10/07 2026 02 12 34 5678",
    "10/07 2026 14 04 04+0300",
    "10/07 2026 14 04 04.123-03:30",
  ])("preserves a valid date with whitespace before its year: %s", (text) => {
    expect(filter.check(text)).toBe(false);
    expect(filter.find(text)).toEqual([]);
    expect(filter.censor(text)).toBe(text);
    expect(filter.process(text)).toEqual({ censored: text, matches: [] });
  });

  it.each(["", "1", "123", "1234", "12345", "123456789", "12 34 56"])(
    "preserves a spaced timestamp followed by a short numeric tail: %s",
    (tail) => {
      const text = `10/07 2026 14 04 04 ${tail}`;
      expect(filter.check(text)).toBe(false);
      expect(filter.find(text)).toEqual([]);
      expect(filter.censor(text)).toBe(text);
      expect(filter.process(text)).toEqual({ censored: text, matches: [] });
    },
  );

  it.each([
    "+7 999 123 45 67",
    "8 (999) 123-45-67",
    "+44 20 7946 0958",
    "+49/30 2026 140404",
    "202 555 0187",
    "02 12 34 5678",
    "10/07 (2026) 14 04 04",
    "12/03 20 1234 56",
    "29/02 2026 14 04 04",
    "31/04 2026 14 04 04",
    "10/13 3026 14 04 04",
  ])("still masks phones and invalid date-like sequences: %s", (phone) => {
    const prefix = "😀 10/07 2026 call ";
    const text = prefix + phone;
    const matches = [
      { start: prefix.length, end: text.length, value: phone, filter: "phone" },
    ];
    const censored = prefix + "#".repeat(phone.length);
    expect(filter.check(text)).toBe(true);
    expect(filter.find(text)).toEqual(matches);
    expect(filter.censor(text, "#")).toBe(censored);
    expect(filter.process(text, "#")).toEqual({ censored, matches });
  });

  it.each([
    "79991234567",
    "7999 123 456",
    "202 555 0187",
    "02 12 34 5678",
    "+7 999 123 45 67",
    "+44 20 7946 0958",
  ])("masks the complete phone after a date or timestamp: %s", (phone) => {
    for (const prefix of [
      "10/07 2026 14 04 04 ",
      "10/07 2026 14 04 04+0300 ",
      "😀 10/07 2026 14 04 04-0300 ",
      "😀 10/07 2026 14 04 04+00 ",
      "😀 10/07 2026 14 04 04-03 ",
      "😀 10/07 2026 14 04 04+23:59 ",
      "😀 10/07/2026 14 04 04-03:30 ",
      "😀 10/07 2026 14 04 04.123+0300 ",
      "😀 10/07 2026 14 04 04,123-03:30 ",
      "😀 10/07 2026 call ",
      "😀 10/07 2026 14 04 04 ",
      "😀 10/07 2026 00 00 00 ",
      "😀 10/07 2026 23 59 59 ",
      "😀 10/07/2026 14 04 04 ",
      "😀 10/07\u00a02026\u00a014\u00a004\u00a004 ",
      "😀 10/07 2026 14:04:04 ",
    ]) {
      const text = prefix + phone;
      const matches = [
        {
          start: prefix.length,
          end: text.length,
          value: phone,
          filter: "phone",
        },
      ];
      const censored = prefix + "#".repeat(phone.length);
      expect(filter.check(text)).toBe(true);
      expect(filter.find(text)).toEqual(matches);
      expect(filter.censor(text, "#")).toBe(censored);
      expect(filter.process(text, "#")).toEqual({ censored, matches });
    }
  });

  it("still masks a grouped phone immediately after a date", () => {
    const phone = "202 555 0187";
    expect(filter.censor(`10/07 2026 ${phone}`)).toBe(
      `10/07 2026 ${"*".repeat(phone.length)}`,
    );
  });

  it("keeps digit-free and below-threshold inputs clean", () => {
    for (const text of [
      "HELLO",
      "Plain ASCII text! ".repeat(1_000),
      "Обычный текст 😀 mixed words ".repeat(500),
      "prefix 123456789 suffix",
      "prefix １２３４５６７８９ suffix",
      "prefix ⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲ suffix",
      "İ ﬃ Ⅻ ㍿ 😀\u200b",
      "date 2026-03-22 coordinates 55.7558, 37.6173 word1234567890",
    ]) {
      expect(filter.check(text)).toBe(false);
      expect(filter.find(text)).toEqual([]);
      expect(filter.censor(text, "#")).toBe(text);
      expect(filter.process(text, "#")).toEqual({
        censored: text,
        matches: [],
      });
    }
  });

  it("preserves Unicode digits, compatible forms and source offsets", () => {
    for (const number of [
      "+1 202 555 0187",
      "１２３４５６７８９０",
      "٧٩٩٩١٢٣٤٥٦٧",
      "𐒧𐒩𐒩𐒩𐒡𐒢𐒣𐒤𐒥𐒦𐒧",
      "①②③④⑤⑥⑦⑧⑨⓪",
      "+7\u200b999\u200b123\u200b45\u200b67",
    ]) {
      for (const [prefix, suffix] of [
        ["😀 ", " text".repeat(1_000)],
        ["text ".repeat(1_000) + "😀 ", ""],
      ]) {
        const text = prefix + number + suffix;
        const matches = [
          {
            start: prefix.length,
            end: prefix.length + number.length,
            value: number,
            filter: "phone",
          },
        ];
        const censored = prefix + "#".repeat(number.length) + suffix;
        expect(filter.check(text)).toBe(true);
        expect(filter.find(text)).toEqual(matches);
        expect(filter.censor(text, "#")).toBe(censored);
        expect(filter.process(text, "#")).toEqual({ censored, matches });
      }
    }
  });

  it("keeps caller-dependent letter folding and multi-character expansions", () => {
    expect(toRawChar("E")).toBe("e");
    expect(toRawChar("Ｅ")).toBe("e");
    expect(toRawChar("⑩")).toBe("⑩");
    expect(toRawChar("İ")).toBe("İ");
    expect(filter.censor("TEL+79991234567")).toBe("TEL" + "*".repeat(12));
  });
});
