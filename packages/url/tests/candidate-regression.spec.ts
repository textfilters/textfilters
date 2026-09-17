import { describe, expect, it } from "vitest";

import { createUrlFilter } from "../src/index.js";

const filter = createUrlFilter();

describe("domain-dot candidate regression", () => {
  it("preserves clean separator runs through every public operation", () => {
    for (const separator of [
      ".",
      "。",
      "·",
      "𐩐",
      ".\ufe0f",
      ".\u{e0100}",
      ". 😀 ",
    ]) {
      const run = separator.repeat(16_000);
      for (const text of [run, `a1${run}`, `${run}b2`]) {
        expect(filter.check(text)).toBe(false);
        expect(filter.find(text)).toEqual([]);
        expect(filter.censor(text, "#")).toBe(text);
        expect(filter.process(text, "#")).toEqual({
          censored: text,
          matches: [],
        });
      }
    }
  });

  it("keeps sentence dots, selector runs, and non-domain labels clean", () => {
    for (const text of [
      "word. next",
      "слово。 далее",
      "word\ufe0f.\ufe0f next",
      `word${"\ufe0f".repeat(4_000)}.${"\u{e0100}".repeat(4_000)} next`,
      "a1" + ".".repeat(128) + "b2",
      "a1" + "。".repeat(128) + "b2",
      "a1" + "·".repeat(128) + "b2",
      "😀 a. 😀 b",
      "a.\u{e0100} b",
    ]) {
      expect(filter.check(text)).toBe(false);
      expect(filter.process(text)).toEqual({ censored: text, matches: [] });
    }
  });

  it("preserves UTF-16 matches before and after neutral runs", () => {
    for (const link of [
      "example.com",
      "example[.]com",
      "example dot com",
      "https://example.com/path",
    ]) {
      for (const [prefix, suffix] of [
        ["😀 ", " " + "。".repeat(1_024)],
        [".".repeat(1_024) + " 😀 ", ""],
      ]) {
        const text = prefix + link + suffix;
        const matches = [
          {
            start: prefix.length,
            end: prefix.length + link.length,
            value: link,
            filter: "url",
          },
        ];
        const censored = prefix + "#".repeat(link.length) + suffix;
        expect(filter.check(text)).toBe(true);
        expect(filter.find(text)).toEqual(matches);
        expect(filter.censor(text, "#")).toBe(censored);
        expect(filter.process(text, "#")).toEqual({ censored, matches });
      }
    }
  });

  it("preserves allowlists, custom TLDs, and list boundaries", () => {
    const custom = createUrlFilter({
      tlds: ["com"],
      allowedDomains: ["example.com"],
    });
    expect(custom.check("example.com")).toBe(false);
    expect(custom.check("example.org")).toBe(false);
    expect(custom.find("1. sample.com\n2. example.com")).toEqual([
      { start: 3, end: 13, value: "sample.com", filter: "url" },
      { start: 14, end: 28, value: "2. example.com", filter: "url" },
    ]);
  });
});
