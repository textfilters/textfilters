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

describe("Russian inflected and compound insult regressions", () => {
  it.each([
    "ебанат",
    "ебаната",
    "ебанатами",
    "ебанатов",
    "ебанутая",
    "ебанутого",
    "ебанутый",
    "ебанутыми",
    "ебливую",
    "ебливые",
    "ебливыми",
    "хуета",
    "хуете",
    "хуету",
    "хуетой",
    "хуетами",
    "тупорылая",
    "тупорылого",
    "тупорылый",
    "тупорылыми",
    "мухоеб",
    "мухоебом",
    "мухоебы",
    "мухоебливый",
    "мухоебливую",
    "мухоебливые",
    "мухоебливых",
    "педовыебанная",
    "педовыебанного",
    "педовыебанные",
    "педовыебанными",
    "пиздазасранчик",
    "пиздазасранчика",
    "пиздазасранчики",
    "пиздазасранчиками",
  ])("masks a complete word with source metadata: %s", (word) => {
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

  it.each([
    ["ЕБАНАТ", "ебанат"],
    ["ёбанутый", "ебанутый"],
    ["eбанутый", "ебанутый"],
    ["ебааанутый", "ебанутый"],
    ["х-у-е-т-у", "хуету"],
    ["тупо\u200Bрылый", "тупорылый"],
    ["педо-выебанные", "педовыебанные"],
    ["мухоёбливые", "мухоебливые"],
    ["мухоёб", "мухоеб"],
    ["пизда-засранчики", "пиздазасранчики"],
  ])("preserves original ranges for %s", (word, term) => {
    const text = `💬 ${word}!`;
    const censored = `💬 ${"*".repeat(word.length)}!`;

    expect(filter.process(text)).toEqual({
      censored,
      matches: [
        {
          start: 3,
          end: 3 + word.length,
          value: word,
          filter: "profanity",
          data: { dictionary: "ru", term },
        },
      ],
    });
    expect(censored.length).toBe(text.length);
  });

  it.each([
    {
      text: "Ебанат тупорылый, я замещаю пингвина",
      censored: "****** *********, я замещаю пингвина",
      words: ["Ебанат", "тупорылый"],
    },
    {
      text: "Крч. Если ты писал эту хуету и щас спрашиваешь настолько ебанутый вопрос, то мне жалко твоих родителей",
      censored:
        "Крч. Если ты писал эту ***** и щас спрашиваешь настолько ******** вопрос, то мне жалко твоих родителей",
      words: ["хуету", "ебанутый"],
    },
    {
      text: "Они явно педовыебанные трансгендерные мухоебливые пиздазасранчики",
      censored:
        "Они явно ************* трансгендерные *********** ***************",
      words: ["педовыебанные", "мухоебливые", "пиздазасранчики"],
    },
  ])(
    "masks the reported message through composition: $text",
    ({ text, censored, words }) => {
      const combined = combineFilters(filter);
      const matches = words.map((word) => ({
        start: text.indexOf(word),
        end: text.indexOf(word) + word.length,
        value: word,
        filter: "profanity",
        data: { dictionary: "ru", term: word.toLowerCase() },
      }));

      expect(combined.check(text)).toBe(true);
      expect(combined.find(text)).toEqual(matches);
      expect(combined.censor(text)).toBe(censored);
      expect(combined.process(text)).toEqual({ censored, matches });
      expect(censored.length).toBe(text.length);
    },
  );

  it.each([
    "педагог",
    "педология",
    "мухоловка",
    "мухомор",
    "хлеб",
    "мебель",
    "учебный",
    "небанальный",
    "трансгендерные люди",
    "я замещаю пингвина",
    "мухи прилетели к педагогам",
  ])("preserves neutral words and identity terms: %s", (text) => {
    expect(filter.check(text)).toBe(false);
    expect(filter.process(text)).toEqual({ censored: text, matches: [] });
  });
});
