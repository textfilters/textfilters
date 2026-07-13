import { describe, expect, it } from "vitest";

import {
  createEnglishProfanityFilter,
  createProfanityFilterFromDictionary,
  createProfanityScanner,
  englishProfanityDictionary,
  englishProfanityFilter,
  filter,
  validateProfanityLanguageDictionary,
} from "../src";

const reviewedCases = [
  ["fuck", "en.obscene.fuck.family", "OBSCENE_MAT", "high"],
  ["fucking", "en.obscene.fuck.family", "OBSCENE_MAT", "high"],
  ["fucked", "en.obscene.fuck.family", "OBSCENE_MAT", "high"],
  ["FUCK", "en.obscene.fuck.family", "OBSCENE_MAT", "high"],
  ["Fucking", "en.obscene.fuck.family", "OBSCENE_MAT", "high"],
  ["That was fucked.", "en.obscene.fuck.family", "OBSCENE_MAT", "high"],
  ["!fuck", "en.obscene.fuck.family", "OBSCENE_MAT", "high"],
  ["shit", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["SHIT", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["This is shit.", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["dick", "en.vulgar.dick", "VULGAR", "medium"],
  ["Dick", "en.vulgar.dick", "VULGAR", "medium"],
  ["What a dick!", "en.vulgar.dick", "VULGAR", "medium"],
  ["motherfucker", "en.insult.motherfucker", "STRONG_INSULT", "high"],
  ["MOTHERFUCKER", "en.insult.motherfucker", "STRONG_INSULT", "high"],
  ["motherfucker's", "en.insult.motherfucker", "STRONG_INSULT", "high"],
  ["That motherfucker.", "en.insult.motherfucker", "STRONG_INSULT", "high"],
  ["cock", "en.vulgar.cock", "VULGAR", "medium"],
  ["COCK", "en.vulgar.cock", "VULGAR", "medium"],
  ["A cock!", "en.vulgar.cock", "VULGAR", "medium"],
  ["bitch", "en.insult.bitch", "STRONG_INSULT", "medium"],
  ["Bitch", "en.insult.bitch", "STRONG_INSULT", "medium"],
  ["Hey, bitch.", "en.insult.bitch", "STRONG_INSULT", "medium"],
  ["bastard", "en.insult.bastard", "STRONG_INSULT", "medium"],
  ["BASTARD", "en.insult.bastard", "STRONG_INSULT", "medium"],
  ["You bastard!", "en.insult.bastard", "STRONG_INSULT", "medium"],
  ["Это fucking плохо.", "en.obscene.fuck.family", "OBSCENE_MAT", "high"],
  ["Русский текст: bitch!", "en.insult.bitch", "STRONG_INSULT", "medium"],
  ["shit@", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["fuck@!", "en.obscene.fuck.family", "OBSCENE_MAT", "high"],
  ["bitch@ ", "en.insult.bitch", "STRONG_INSULT", "medium"],
  ["foo@bitch", "en.insult.bitch", "STRONG_INSULT", "medium"],
  ["abc@shit", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["shit.com_extra", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["shit.com-", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["shit..com", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["shit@example.com_extra", "en.obscene.shit", "OBSCENE_MAT", "high"],
  [".shit@example.com", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["shit..tag@example.com", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["shit.@example.com", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["shit@example..com", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["shit@-example.com", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["shit@example-.com", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["shit@localhost", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["foo@shit@example.com", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["foo@bar.shit@example.com", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["foo@@shit@example.com", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["@bitch@example.com", "en.insult.bitch", "STRONG_INSULT", "medium"],
  ["foo@@shit.com", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["foo@.shit.com", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["https://example.com/shit.txt", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["/uploads/shit.png", "en.obscene.shit", "OBSCENE_MAT", "high"],
  ["C:\\files\\bitch.log", "en.insult.bitch", "STRONG_INSULT", "medium"],
  [
    "https://example.com/files/(shit.txt)",
    "en.obscene.shit",
    "OBSCENE_MAT",
    "high",
  ],
] as const;

const falsePositiveCases = [
  "shitake",
  "Dickinson",
  "Dickens",
  "cocktail",
  "cockatoo",
  "Bitchfield",
  "Scunthorpe",
  "unfuckingbelievable",
  "shitake.example",
  "dickinson.example",
  "cocktail.example",
  "reader@shitake.example",
  "dickinson@example.com",
  "cocktail@example.com",
  "dick@example.com",
  "reader@shit.com",
  "foo+shit+bar@example.com",
  "shit+tag@example.com",
  "foo.bitch+tag@example.com",
  "shit@example.co.uk",
  "shit.com",
  "shit.com.",
  "shit.com...",
  "...shit.com",
  "//shit.com",
  "reader@shit.com...",
  "https://example.com/?redirect=shit.com",
  "https://cock.example",
  "shit．com",
  "ｓｈｉｔ．com",
  "https://cock．example",
  "foo＋shit＋bar＠example．com",
  "@shitake_reader",
  "@dickinson",
  "@bitch",
  "@bitch_user",
  "@bastard",
  "＠bitch",
  "＠ｂｉｔｃｈ",
  "cocktail_user",
];

const invalidAddressLikeCases = [
  "shit@",
  "fuck@!",
  "bitch@ ",
  "foo@bitch",
  "abc@shit",
  "shit.com_extra",
  "shit.com-",
  "shit..com",
  "shit@example.com_extra",
  ".shit@example.com",
  "shit..tag@example.com",
  "shit.@example.com",
  "shit@example..com",
  "shit@-example.com",
  "shit@example-.com",
  "shit@localhost",
  "foo@shit@example.com",
  "foo@bar.shit@example.com",
  "foo@@shit@example.com",
  "@bitch@example.com",
  "foo@@shit.com",
  "foo@.shit.com",
  "https://example.com/shit.txt",
  "/uploads/shit.png",
  "C:\\files\\bitch.log",
  "https://example.com/files/(shit.txt)",
];

describe("reviewed English language pack", () => {
  it("validates the maintained dictionary", () => {
    expect(
      validateProfanityLanguageDictionary(englishProfanityDictionary),
    ).toEqual([]);
  });

  it.each(reviewedCases)(
    "matches reviewed case %s with stable metadata",
    (text, ruleId, category, severity) => {
      const match = englishProfanityFilter.analyze(text)[0];

      expect(match).toMatchObject({
        ruleId,
        category,
        severity,
        mode: "strict",
      });
      expect(text.slice(match[0], match[1]).toLowerCase()).toMatch(
        /^(?:fuck(?:ed|ing)?|shit|dick|motherfucker|cock|bitch|bastard)$/u,
      );
    },
  );

  it.each(falsePositiveCases)("does not match neutral context %s", (text) => {
    expect(englishProfanityFilter.check(text)).toBe(false);
    expect(englishProfanityFilter.analyze(text)).toEqual([]);
    expect(englishProfanityFilter.censor(text)).toBe(text);
  });

  it.each(invalidAddressLikeCases)(
    "keeps invalid address-like context detectable: %s",
    (text) => {
      expect(englishProfanityFilter.check(text)).toBe(true);
      expect(englishProfanityFilter.analyze(text).length).toBeGreaterThan(0);
      expect(englishProfanityFilter.censor(text)).not.toBe(text);
    },
  );

  it("preserves UTF-16 source ranges and possessive boundaries", () => {
    const text = "🙂 Это motherfucker's сообщение";
    const [match] = englishProfanityFilter.analyze(text);

    expect(match).toMatchObject({
      0: 7,
      1: 19,
      ruleId: "en.insult.motherfucker",
      category: "STRONG_INSULT",
      severity: "high",
      mode: "strict",
    });
    expect(text.slice(match[0], match[1])).toBe("motherfucker");
    expect(englishProfanityFilter.censor(text)).toBe(
      "🙂 Это ************'s сообщение",
    );
  });

  it("creates isolated filters without changing the Russian default", () => {
    const isolated = createProfanityFilterFromDictionary(
      englishProfanityDictionary,
    );

    expect(isolated.check("fucking")).toBe(true);
    expect(filter.check("fucking")).toBe(false);
  });

  it("exports a read-only shared English filter", () => {
    const mutableExportedRules =
      englishProfanityDictionary.rules as unknown as unknown[];
    const originalRules = [...mutableExportedRules];
    mutableExportedRules.length = 0;

    try {
      expect(englishProfanityFilter.check("fucking")).toBe(true);
      expect(createEnglishProfanityFilter().check("fucking")).toBe(true);
      expect("addStrict" in englishProfanityFilter).toBe(false);
      expect(Object.isFrozen(englishProfanityFilter)).toBe(true);
    } finally {
      mutableExportedRules.push(...originalRules);
    }
  });

  it("uses English normalization for runtime literal mutations", () => {
    const mutable = createEnglishProfanityFilter();

    mutable.addStrict("ass");
    mutable.addLoose("crap");
    expect(mutable.check("ass")).toBe(true);
    expect(mutable.check("ass.com")).toBe(true);
    expect(mutable.check("c-r-a-p")).toBe(true);

    mutable.setStrict(["ass"]);
    mutable.setLoose(["crap"]);
    expect(mutable.check("ass")).toBe(true);
    expect(mutable.check("ass.com")).toBe(true);
    expect(mutable.check("c r a p")).toBe(true);
  });

  it("lets duplicate runtime literals override maintained context exclusions", () => {
    const mutable = createEnglishProfanityFilter();

    mutable.addStrict("SHIT");
    expect(mutable.check("shit.com")).toBe(true);
    expect(mutable.censor("shit.com")).toBe("****.com");

    mutable.setStrict(["bitch"]);
    expect(mutable.check("@bitch")).toBe(true);
    expect(mutable.censor("@bitch")).toBe("@*****");
  });

  it("keeps runtime duplicate metadata independent from maintained rules", () => {
    const mutable = createEnglishProfanityFilter();

    mutable.addStrict("shit");
    expect(mutable.check("shit.com", { minSeverity: "high" })).toBe(false);

    mutable.setStrict([
      { source: "shit", category: "VULGAR", severity: "low" },
    ]);
    expect(
      mutable.analyze("shit.com", { categories: ["VULGAR"] })[0],
    ).toMatchObject({
      mode: "strict",
      category: "VULGAR",
      severity: "low",
    });
    expect(mutable.check("shit.com", { categories: ["OBSCENE_MAT"] })).toBe(
      false,
    );
  });

  it("preserves UTF-16 length when censoring astral runtime literals", () => {
    const mutable = createEnglishProfanityFilter();
    mutable.addStrict("💩");

    expect(mutable.analyze("💩")[0]).toMatchObject({ 0: 0, 1: 2 });
    expect(mutable.censor("💩")).toBe("**");
    expect(mutable.censor("💩")).toHaveLength("💩".length);
  });

  it.each([
    "reader@shit.com",
    "foo+shit+bar@example.com",
    "shit．com",
    "＠bitch",
  ])("keeps scanner output clear for excluded context %s", (text) => {
    const scanner = createProfanityScanner({ filter: englishProfanityFilter });
    const input = { text, codePoints: Array.from(text) };

    expect(scanner.check(input)).toBe(false);
    expect(scanner.scan(input).ranges).toEqual([]);
  });
});
