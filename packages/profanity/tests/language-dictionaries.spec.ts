import { describe, expect, it } from "vitest";

import {
  createProfanityFilterFromDictionary,
  validateProfanityLanguageDictionary,
  type ProfanityLanguageDictionary,
} from "../src";
import { RUSSIAN_PROFANITY_DICTIONARY } from "../src/languages/ru";
import {
  assertLanguageDictionaryInvariants,
  assertLanguagePackDictionaryContract,
} from "./language-dictionary-helpers";

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

  it("validates the built-in Russian dictionary with the public validator", () => {
    expect(
      validateProfanityLanguageDictionary(RUSSIAN_PROFANITY_DICTIONARY),
    ).toEqual([]);
  });

  it("validates a minimal custom non-Russian dictionary with the public validator", () => {
    expect(
      validateProfanityLanguageDictionary(CUSTOM_LANGUAGE_PACK_DICTIONARY),
    ).toEqual([]);
  });

  it("allows long source patterns to be authored as joined fragments", () => {
    const dictionary = {
      language: "zz",
      rules: [
        {
          id: "zz.vulgar.fragmented",
          category: "VULGAR",
          severity: "low",
          source: ["q", "[._-]?", "w", "[._-]?", "r"],
          match: {
            strict: {},
            loose: {},
          },
        },
      ],
    } as const satisfies ProfanityLanguageDictionary;
    const customFilter = createProfanityFilterFromDictionary(dictionary);

    expect(validateProfanityLanguageDictionary(dictionary)).toEqual([]);
    expect(customFilter.check("q-w-r")).toBe(true);
    expect(customFilter.analyze("q-w-r")[0]).toMatchObject({
      ruleId: "zz.vulgar.fragmented",
      category: "VULGAR",
      severity: "low",
    });
  });

  it("creates a filter from a minimal custom non-Russian dictionary", () => {
    const customFilter = createProfanityFilterFromDictionary(
      CUSTOM_LANGUAGE_PACK_DICTIONARY,
    );

    expect(customFilter.check("qwr")).toBe(true);
    expect(customFilter.check("q-w-r")).toBe(true);
    expect(customFilter.check("qwwr")).toBe(true);
    expect(customFilter.check("vnn")).toBe(true);
    expect(customFilter.analyze("qwr")[0]).toMatchObject({
      ruleId: "zz.vulgar.qwr",
      category: "VULGAR",
      severity: "low",
      mode: "strict",
    });
    expect(customFilter.analyze("qwwr")[0]).toMatchObject({
      ruleId: "zz.vulgar.qwr",
      category: "VULGAR",
      severity: "low",
      mode: "loose",
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
});
