import { describe, expect, it } from "vitest";

import {
  createProfanityFilter,
  type ProfanityDictionary,
} from "../src/index.js";

const russian: ProfanityDictionary = {
  id: "ru",
  deny: ["хуй", "сука", "иди нахуй"],
  allow: ["сука породы лабрадор", "Nguyen Quang Huy"],
  aliases: [
    ["ё", "е"],
    ["x", "х"],
    ["y", "у"],
  ],
};

const english: ProfanityDictionary = {
  id: "en",
  deny: ["fuck", "shit", "faggot", "nigga"],
  allow: ["shitake"],
  aliases: [
    ["α", "a"],
    ["ι", "i"],
    ["υ", "u"],
  ],
};

describe("profanity runtime", () => {
  it("keeps a string-only check, find, censor, and process contract", () => {
    const filter = createProfanityFilter(russian);
    const text = "скажи сука сейчас";
    const matches = filter.find(text);

    expect(filter.check(text)).toBe(true);
    expect(matches).toEqual([
      {
        start: 6,
        end: 10,
        value: "сука",
        filter: "profanity",
        data: { dictionary: "ru", term: "сука" },
      },
    ]);
    expect(filter.censor(text)).toBe("скажи **** сейчас");
    expect(filter.process(text)).toEqual({
      censored: "скажи **** сейчас",
      matches,
    });

    const unsafe = filter as unknown as { check(value: unknown): boolean };
    expect(() => unsafe.check(42)).toThrow("text must be a string");
  });

  it("preserves UTF-16 source ranges after emoji and separators", () => {
    const filter = createProfanityFilter(russian);
    const text = "😀 х-у-й!";

    expect(filter.find(text)).toEqual([
      {
        start: 3,
        end: 8,
        value: "х-у-й",
        filter: "profanity",
        data: { dictionary: "ru", term: "хуй" },
      },
    ]);
    expect(filter.censor(text)).toBe("😀 *****!");
    expect(filter.censor(text).length).toBe(text.length);
  });

  it("normalizes grapheme clusters, fullwidth text, and zero-width text", () => {
    const filter = createProfanityFilter(russian, english, {
      id: "accent",
      deny: ["é"],
      allow: [],
    });

    for (const text of ["ｓｈｉｔ", "sh\u200bi\u200dt", "e\u0301"]) {
      expect(filter.check(text), text).toBe(true);
      expect(filter.censor(text), text).toBe("*".repeat(text.length));
    }
  });

  it("applies contextual lowercase across the complete normalized text", () => {
    const greek: ProfanityDictionary = {
      id: "el",
      deny: ["ος"],
      allow: [],
    };
    const filter = createProfanityFilter(greek);
    const text = "ΟΣ";
    const matches = filter.find(text);

    expect(filter.check(text)).toBe(true);
    expect(matches).toEqual([
      {
        start: 0,
        end: 2,
        value: text,
        filter: "profanity",
        data: { dictionary: "el", term: "ος" },
      },
    ]);
    expect(filter.censor(text)).toBe("**");
    expect(filter.process(text)).toEqual({ censored: "**", matches });
  });

  it("keeps NFKC grapheme regrouping safe across the public API", () => {
    const filter = createProfanityFilter(russian, english);

    for (const text of ["ㄱㅏ", "ㅙㅪ"]) {
      expect(filter.check(text), text).toBe(false);
      expect(filter.find(text), text).toEqual([]);
      expect(filter.censor(text), text).toBe(text);
      expect(filter.process(text), text).toEqual({
        censored: text,
        matches: [],
      });
    }
  });

  it("keeps aliases isolated between dictionaries", () => {
    const englishOnly = createProfanityFilter(english);
    const russianOnly = createProfanityFilter(russian);

    expect(russianOnly.check("xyй")).toBe(true);
    expect(englishOnly.check("xyй")).toBe(false);
    expect(englishOnly.check("fαggot")).toBe(true);
    expect(russianOnly.check("fαggot")).toBe(false);
  });

  it("matches compact separators without skipping letters or unbounded gaps", () => {
    const filter = createProfanityFilter(russian);

    expect(filter.check("х-у-й")).toBe(true);
    expect(filter.check("х у й")).toBe(true);
    expect(filter.check("ху й")).toBe(false);
    expect(filter.check("х хороший у яркий й")).toBe(false);
    expect(filter.check(`х${"-".repeat(17)}у-й`)).toBe(false);
  });

  it("requires dictionary minimum counts for repeated characters", () => {
    const filter = createProfanityFilter(russian, english);

    expect(filter.check("хуй")).toBe(true);
    expect(filter.check("хуууй")).toBe(true);
    expect(filter.check("faggot")).toBe(true);
    expect(filter.check("fagggot")).toBe(true);
    expect(filter.check("fagggggot")).toBe(true);
    expect(filter.check("fagot")).toBe(false);
    expect(filter.check("shiiit")).toBe(true);
    expect(filter.check("n_i_g_g_a")).toBe(true);
    expect(filter.check("n_i_g_a")).toBe(false);
  });

  it("enforces word boundaries while keeping phrase compacting", () => {
    const filter = createProfanityFilter(english, {
      id: "phrases",
      deny: ["tenant phrase"],
      allow: [],
    });

    expect(filter.check("shit")).toBe(true);
    expect(filter.check("s-h-i-t")).toBe(true);
    expect(filter.check("s hit")).toBe(false);
    expect(filter.check("sh it")).toBe(false);
    expect(filter.check("f u c k")).toBe(true);
    expect(filter.check("_shit_")).toBe(true);
    expect(filter.check("shitake")).toBe(false);
    expect(filter.check("tenant phrase")).toBe(true);
    expect(filter.check("tenant-phrase")).toBe(true);
    expect(filter.check("tenantphrase")).toBe(true);
    expect(filter.check("ten antphrase")).toBe(false);
  });

  it("rejects deny entries containing special characters", () => {
    for (const deny of ["пзд@", "еб@ть"]) {
      expect(() =>
        createProfanityFilter({ id: "invalid-deny", deny: [deny], allow: [] }),
      ).toThrow(
        "must contain only Unicode letters, numbers, and single spaces",
      );
    }
  });

  it("matches canonical deny words through compact input separators", () => {
    const filter = createProfanityFilter({
      id: "canonical-deny",
      deny: ["пизда", "блять"],
      allow: [],
    });

    expect(filter.check("пизда")).toBe(true);
    expect(filter.check("п-и-з-д-а")).toBe(true);
    expect(filter.check("б-л-я-т-ь")).toBe(true);
    expect(filter.check("пзд@")).toBe(false);
  });

  it("keeps punctuation available to exact allow entries", () => {
    const filter = createProfanityFilter({
      id: "punctuated-allow",
      deny: ["пизда"],
      allow: ["safe: пизда@example.com"],
    });

    expect(filter.check("safe: пизда@example.com")).toBe(false);
    expect(filter.check("пизда")).toBe(true);
  });

  it("applies exact allow ranges only to the concrete covered deny", () => {
    const filter = createProfanityFilter(russian);
    const text = "сука породы лабрадор, а потом сука";

    expect(filter.find(text).map(({ value }) => value)).toEqual(["сука"]);
    expect(filter.find(text)[0].start).toBe(text.lastIndexOf("сука"));
    expect(filter.censor(text)).toBe("сука породы лабрадор, а потом ****");
    expect(filter.check("сука-породы-лабрадор")).toBe(true);
  });

  it("scans many alternating allow ranges and deny matches in order", () => {
    const filter = createProfanityFilter({
      id: "many-allows",
      deny: ["bad"],
      allow: ["safe bad"],
    });
    const repetitions = 256;
    const text = Array.from({ length: repetitions }, () => "safe bad bad").join(
      " ",
    );

    const matches = filter.find(text);

    expect(matches).toHaveLength(repetitions);
    expect(matches.every(({ value }) => value === "bad")).toBe(true);
  });

  it("chooses the leftmost longest deny match deterministically", () => {
    const filter = createProfanityFilter({
      id: "custom",
      deny: ["bad", "bad phrase", "phrase"],
      allow: [],
    });

    expect(filter.find("bad-phrase bad").map(({ value }) => value)).toEqual([
      "bad-phrase",
      "bad",
    ]);
  });

  it("combines Russian and English dictionaries without shared alias state", () => {
    const filter = createProfanityFilter(russian, english);
    const text = "иди нахуй and f-υ-c-k";

    expect(filter.find(text).map(({ data }) => data.dictionary)).toEqual([
      "ru",
      "en",
    ]);
    expect(filter.process(text, "#").censored).toBe("######### and #######");
  });

  it("rejects duplicate dictionary ids", () => {
    expect(() => createProfanityFilter(russian, { ...russian })).toThrow(
      'dictionary id conflict: "ru" appears at indexes 0 and 1',
    );
  });

  it("rejects normalized deny and allow duplicates with both sources", () => {
    expect(() =>
      createProfanityFilter({
        id: "deny-conflict",
        deny: ["shit", "SHiT"],
        allow: [],
      }),
    ).toThrow('dictionary "deny-conflict" deny conflict: "shit" and "SHiT"');

    expect(() =>
      createProfanityFilter({
        id: "allow-conflict",
        deny: [],
        allow: ["Safe  phrase", "safe phrase"],
      }),
    ).toThrow(
      'dictionary "allow-conflict" allow conflict: "Safe  phrase" and "safe phrase"',
    );
  });

  it("rejects direct deny/allow conflicts with both sources", () => {
    expect(() =>
      createProfanityFilter({
        id: "direct-conflict",
        deny: ["Shit"],
        allow: ["shit"],
      }),
    ).toThrow(
      'dictionary "direct-conflict" deny/allow conflict: deny "Shit" and allow "shit"',
    );
  });

  it("rejects invalid, duplicate, self, chained, and cyclic aliases", () => {
    const create = (aliases: readonly (readonly [string, string])[]) =>
      createProfanityFilter({
        id: "aliases",
        deny: ["word"],
        allow: [],
        aliases,
      });

    expect(() => create([["ab", "c"]])).toThrow(
      'dictionary "aliases" aliases entry "ab=c"',
    );
    expect(() =>
      create([
        ["a", "b"],
        ["Ａ", "c"],
      ]),
    ).toThrow(
      'dictionary "aliases" aliases conflict (duplicate source): "a=b" and "Ａ=c"',
    );
    expect(() => create([["a", "A"]])).toThrow('maps "a" to itself');
    expect(() =>
      create([
        ["a", "b"],
        ["b", "c"],
      ]),
    ).toThrow('aliases conflict (chain or cycle): "a=b" and "b=c"');
    expect(() =>
      create([
        ["a", "b"],
        ["b", "a"],
      ]),
    ).toThrow('aliases conflict (chain or cycle): "a=b" and "b=a"');
  });

  it("snapshots dictionary data into an immutable reusable filter", () => {
    const deny = ["blocked"];
    const filter = createProfanityFilter({ id: "custom", deny, allow: [] });

    deny.push("later");
    expect(filter.check("blocked")).toBe(true);
    expect(filter.check("later")).toBe(false);
    expect(Object.isFrozen(filter)).toBe(true);
    expect("processMany" in filter).toBe(false);
  });

  it("supports an empty dictionary selection", () => {
    const filter = createProfanityFilter();
    expect(filter.process("clean")).toEqual({
      censored: "clean",
      matches: [],
    });
  });
});
