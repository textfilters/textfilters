import { describe, expect, it } from "vitest";

import { createProfanityFilter, filter } from "../src";
import {
  normalizeForMatchSameLen,
  normalizeForMatchSameLenWithoutHomoglyphs,
  prepareForMatchSameLen,
  prepareForMatchSameLenWithoutHomoglyphs,
} from "../src/normalization/text.js";

describe("normalization", () => {
  it("keeps fused preparation byte-compatible with both normalization strategies", () => {
    const samples = [
      "plain ASCII",
      "ёЁ еЕ",
      "Ａｚ１２！ fullwidth",
      "Aexy BHMOPT",
      "\u200B\u200C\u200D\uFEFF\u2060",
      "🙂𐐀🔥",
      "e\u0301 combining",
      "🙂Ａeё\u200BＺ mixed",
    ];
    const strategies = [
      {
        normalize: normalizeForMatchSameLen,
        prepare: prepareForMatchSameLen,
      },
      {
        normalize: normalizeForMatchSameLenWithoutHomoglyphs,
        prepare: prepareForMatchSameLenWithoutHomoglyphs,
      },
    ];

    for (const strategy of strategies) {
      for (const source of samples) {
        const visited: Array<{ char: string; position: number }> = [];
        const prepared = strategy.prepare(source, (char, position) => {
          visited.push({ char, position });
        });

        expect(prepared, source).toBe(strategy.normalize(source));
        expect(prepared.length, source).toBe(source.length);
        expect(visited.map(({ char }) => char).join(""), source).toBe(prepared);
        expect(
          visited.map(({ position }) => position),
          source,
        ).toEqual(codePointPositions(source));
      }
    }
  });

  it("handles latin homoglyphs and fullwidth ASCII in strict matching", () => {
    expect(filter.censor("Ебaть смешно")).toBe("***** смешно");
    expect(filter.censor("Bыеб")).toBe("****");
    expect(filter.censor("mудак")).toBe("*****");
    expect(filter.censor("hахуй")).toBe("*****");
    expect(filter.censor("блядb")).toBe("*****");
    expect(filter.censor("xуй")).toBe("***");
    expect(filter.censor("пиздeц")).toBe("******");
    expect(filter.censor("eбaть")).toBe("*****");
    expect(filter.censor("ｅбать")).toBe("*****");
    expect(filter.censor("Oxyeть")).toBe("******");
  });

  it("preserves length, code points around emoji, multiline text, and idempotency", () => {
    const samples = [
      "первая строка\nпиздец тут\nтретья строка хуй",
      "🙂 пиздец 🔥 и хуй ✅",
      "пи\u200Bздец",
      "е6\u200Bал",
      `${"a".repeat(5000)} п и з д е ц ${"b".repeat(5000)}`,
      "обычный текст",
      "eбaть, xуй, blender",
    ];

    for (const input of samples) {
      const once = filter.censor(input);
      expect(once.length).toBe(input.length);
      expect(filter.censor(once)).toBe(once);
    }

    expect(filter.censor("🙂 пиздец 🔥 и хуй ✅")).toBe(
      "🙂 ****** 🔥 и *** ✅",
    );
    expect(filter.censor("е6\u200Bал")).toBe("*****");
  });

  it("preserves UTF-16 length for astral strict and loose tokens", () => {
    expect(createProfanityFilter(["𐐀"], []).censor("𐐀")).toBe("**");
    expect(createProfanityFilter([], ["𐐀"]).censor("𐐀")).toBe("**");
  });

  it("keeps zero-width split markers outside strict token bounds", () => {
    const strictOnly = createProfanityFilter(["бля", "foo"], []);
    const strictDotPhrase = createProfanityFilter(["foo.bar"], []);

    expect(strictOnly.censor("бля\u200B")).toBe("***\u200B");
    expect(strictOnly.censor("foo\u200B")).toBe("***\u200B");
    expect(strictDotPhrase.censor("foo\u200Bbar")).toBe("foo\u200Bbar");
    expect(filter.censor("пи\u200Bздец")).toBe("*******");
  });
});

const codePointPositions = (value: string): number[] => {
  const positions: number[] = [];

  for (let position = 0; position < value.length; ) {
    positions.push(position);
    position += (value.codePointAt(position) ?? 0) > 0xffff ? 2 : 1;
  }

  return positions;
};
