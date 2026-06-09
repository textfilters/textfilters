import { describe, expect, it } from "vitest";

import { createProfanityFilter, filter } from "../src/index.js";

describe("normalization", () => {
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
  });

  it("preserves UTF-16 length for astral strict and loose tokens", () => {
    expect(createProfanityFilter(["𐐀"], []).censor("𐐀")).toBe("**");
    expect(createProfanityFilter([], ["𐐀"]).censor("𐐀")).toBe("**");
  });
});
