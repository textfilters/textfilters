import { describe, expect, it } from "vitest";

import { filter } from "../src/index.js";
import { toRawChar } from "../src/digits.js";

describe("phone candidate regression", () => {
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
