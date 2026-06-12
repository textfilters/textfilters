import { describe, expect, it } from "vitest";

import {
  createProfanityFilterFromDictionary,
  filter,
  type ProfanityLanguageDictionary,
} from "../src/index.js";
import { RUSSIAN_PROFANITY_DICTIONARY } from "../src/languages/ru/index.js";
import {
  assertLanguageDictionaryInvariants,
  assertLanguagePackDictionaryContract,
} from "./language-dictionary-helpers.js";

const LANGUAGE_DICTIONARIES = [RUSSIAN_PROFANITY_DICTIONARY] as const;
const CUSTOM_LANGUAGE_PACK_DICTIONARY = {
  language: "zz",
  rules: [
    {
      id: "zz.vulgar.qwr",
      category: "VULGAR",
      severity: "low",
      source: "qwr",
      match: {
        strict: {},
        loose: {
          stretch: true,
        },
      },
    },
    {
      id: "zz.euphemism.vnn",
      category: "EUPHEMISM",
      severity: "soft",
      source: "vnn",
      match: {
        strict: {},
      },
    },
  ],
} as const satisfies ProfanityLanguageDictionary;

describe("language dictionaries", () => {
  it.each(LANGUAGE_DICTIONARIES)(
    "keeps the $language dictionary human-maintained and schema-valid",
    (dictionary) => {
      assertLanguageDictionaryInvariants(dictionary);
    },
  );

  it.each([...LANGUAGE_DICTIONARIES, CUSTOM_LANGUAGE_PACK_DICTIONARY] as const)(
    "keeps the $language dictionary compatible with the language-pack contract",
    (dictionary) => {
      assertLanguagePackDictionaryContract(dictionary);
    },
  );

  it("rejects generated matcher metadata in source dictionaries", () => {
    expect(() =>
      assertLanguageDictionaryInvariants({
        language: "zz",
        rules: [
          {
            id: "builtin:strict:0:abcdefg",
            category: "VULGAR",
            severity: "low",
            source: "qwr",
            match: {
              strict: {},
            },
            ruleId: "compiled-rule",
            order: 1,
          },
        ],
      } as unknown as ProfanityLanguageDictionary),
    ).toThrowError();
  });

  it("creates a filter from a minimal custom non-Russian dictionary", () => {
    const customFilter = createProfanityFilterFromDictionary(
      CUSTOM_LANGUAGE_PACK_DICTIONARY,
    );

    expect(customFilter.check("qwr")).toBe(true);
    expect(customFilter.check("q-w-r")).toBe(true);
    expect(customFilter.check("vnn")).toBe(true);
    expect(customFilter.analyze("qwr")[0]).toMatchObject({
      ruleId: "zz.vulgar.qwr",
      category: "VULGAR",
      severity: "low",
      mode: "strict",
    });
    expect(customFilter.check("qwr", { categories: ["OBSCENE_MAT"] })).toBe(
      false,
    );
  });

  it("keeps runtime mutations on dictionary filters normalized-literal based", () => {
    const customFilter = createProfanityFilterFromDictionary(
      CUSTOM_LANGUAGE_PACK_DICTIONARY,
    );

    customFilter.setStrict(["q\\.wr"]);
    customFilter.setLoose(["qwr"]);

    expect(customFilter.censor("q.wr")).toBe("****");
    expect(customFilter.censor("qXwr")).toBe("qXwr");
    expect(customFilter.censor("q-w-r")).toBe("*****");
    expect(customFilter.censor("qXwr")).toBe("qXwr");
  });

  it("keeps semantic taxonomy metadata on Russian dictionary rules", () => {
    expect(
      RUSSIAN_PROFANITY_DICTIONARY.rules.every(
        (rule) =>
          rule.id !== undefined &&
          rule.category !== undefined &&
          rule.severity !== undefined,
      ),
    ).toBe(true);
    expect(
      RUSSIAN_PROFANITY_DICTIONARY.rules.map((rule) => ({
        id: rule.id,
        category: rule.category,
        severity: rule.severity,
      })),
    ).toContainEqual({
      id: "ru.obscene.blya",
      category: "OBSCENE_MAT",
      severity: "medium",
    });
    expect(
      RUSSIAN_PROFANITY_DICTIONARY.rules.map((rule) => ({
        id: rule.id,
        category: rule.category,
        severity: rule.severity,
      })),
    ).toContainEqual({
      id: "ru.vulgar.huli",
      category: "VULGAR",
      severity: "low",
    });
  });

  it("exposes representative Russian rule metadata in analyze output", () => {
    expect(filter.analyze("бля")[0]).toMatchObject({
      ruleId: "ru.obscene.blya",
      category: "OBSCENE_MAT",
      severity: "medium",
      mode: "strict",
    });
    expect(filter.analyze("хули")[0]).toMatchObject({
      ruleId: "ru.vulgar.huli",
      category: "VULGAR",
      severity: "low",
      mode: "strict",
    });
  });

  it("applies taxonomy filters to Russian built-in rules", () => {
    expect(filter.check("бля", { categories: ["OBSCENE_MAT"] })).toBe(true);
    expect(filter.check("бля", { categories: ["VULGAR"] })).toBe(false);
    expect(filter.check("хули", { severities: ["low"] })).toBe(true);
    expect(filter.check("хули", { minSeverity: "medium" })).toBe(false);
    const input = "бля хули";

    expect(
      filter.analyze(input, {
        categories: ["OBSCENE_MAT"],
        minSeverity: "medium",
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "ru.obscene.blya",
          category: "OBSCENE_MAT",
          severity: "medium",
        }),
      ]),
    );
    expect(
      filter
        .analyze(input, {
          categories: ["OBSCENE_MAT"],
          minSeverity: "medium",
        })
        .every((match) => input.slice(match[0], match[1]) === "бля"),
    ).toBe(true);
  });
});
