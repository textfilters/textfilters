import { describe, expect, it } from "vitest";

import { combineFilters } from "@textfilters/core";
import { createProfanityFilter } from "@textfilters/profanity";
import english from "@textfilters/profanity-en";
import russian from "@textfilters/profanity-ru";

const filter = createProfanityFilter(russian, english);

describe("Russian adjective regression coverage", () => {
  it.each([
    "ебучая",
    "ебучее",
    "ебучего",
    "ебучей",
    "ебучем",
    "ебучему",
    "ебучею",
    "ебучие",
    "ебучий",
    "ебучим",
    "ебучими",
    "ебучих",
    "ебучую",
  ])("masks the complete inflected word: %s", (word) => {
    const text = `😀 ${word}!`;
    const matches = [
      {
        start: 3,
        end: 3 + word.length,
        value: word,
        filter: "profanity",
        data: { dictionary: "ru", term: word },
      },
    ];
    const censored = `😀 ${"*".repeat(word.length)}!`;

    expect(filter.check(text)).toBe(true);
    expect(filter.find(text)).toEqual(matches);
    expect(filter.censor(text)).toBe(censored);
    expect(filter.process(text)).toEqual({ censored, matches });
    expect(censored.length).toBe(text.length);
  });

  it.each(["ёбучие", "ЕБУЧИЕ", "eбучие", "е-б-у-ч-и-е", "ебу\u200Bчие"])(
    "masks normalized and obfuscated spellings: %s",
    (word) => {
      expect(filter.censor(word)).toBe("*".repeat(word.length));
    },
  );

  it("masks the reported message through filter composition", () => {
    const text = "💬 Ты нарушил ебучие стихотворные правила";
    const combined = combineFilters(filter);

    expect(combined.censor(text)).toBe(
      "💬 Ты нарушил ****** стихотворные правила",
    );
    expect(combined.find(text)).toEqual([
      {
        start: 14,
        end: 20,
        value: "ебучие",
        filter: "profanity",
        data: { dictionary: "ru", term: "ебучие" },
      },
    ]);
  });

  it.each([
    "чебуреки",
    "учебники",
    "лечебные процедуры",
    "Ебург",
    "небанальный",
  ])("preserves neutral words and existing allows: %s", (text) => {
    expect(filter.check(text)).toBe(false);
    expect(filter.process(text)).toEqual({ censored: text, matches: [] });
  });
});
