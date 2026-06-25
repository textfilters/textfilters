import { describe, expect, it } from "vitest";

import { filter, validateProfanityLanguageDictionary } from "../src";
import {
  RUSSIAN_PROFANITY_DICTIONARY,
  RUSSIAN_PROFANITY_FAMILY_DICTIONARIES,
} from "../src/languages/ru";
import {
  patternTailViews,
  russianFamilyDictionary,
  russianProfileDictionary,
  russianRule,
} from "../src/languages/ru/profanity/authoring";
import russianProfanityRuleOrder from "../src/languages/ru/profanity/order.json" with { type: "json" };

describe("Russian dictionary composition", () => {
  it("keeps Russian authoring tail views ordered consistently", () => {
    expect(
      patternTailViews(
        [
          [String.raw`[aа]`],
          [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
          [String.raw`[oо]`, String.raw`[yу]`],
        ],
        String.raw`[-._]+`,
      ),
    ).toEqual({
      joined: [String.raw`[aа][mм]i`, String.raw`[oо][yу]`, String.raw`[aа]`],
      separated: [
        String.raw`[aа][-._]+[mм][-._]+i`,
        String.raw`[oо][-._]+[yу]`,
        String.raw`[aа]`,
      ],
    });
  });

  it("validates each built-in Russian family dictionary with the public validator", () => {
    for (const dictionary of RUSSIAN_PROFANITY_FAMILY_DICTIONARIES) {
      expect(validateProfanityLanguageDictionary(dictionary)).toEqual([]);
    }
  });

  it("assembles Russian family dictionaries from explicit rule order", () => {
    const first = russianRule({
      id: "ru.test.first",
      category: "VULGAR",
      severity: "low",
      source: "first",
      match: "strict",
    });
    const second = russianRule({
      id: "ru.test.second",
      category: "OBSCENE_MAT",
      severity: "medium",
      source: "second",
      match: "loose",
    });

    expect(
      russianProfileDictionary(
        [russianFamilyDictionary([first]), russianFamilyDictionary([second])],
        ["ru.test.second", "ru.test.first"],
      ).rules,
    ).toEqual([second, first]);
  });

  it("rejects duplicate Russian family rule ids", () => {
    const rule = russianRule({
      id: "ru.test.duplicate",
      category: "VULGAR",
      severity: "low",
      source: "duplicate",
    });

    expect(() =>
      russianProfileDictionary(
        [russianFamilyDictionary([rule]), russianFamilyDictionary([rule])],
        ["ru.test.duplicate"],
      ),
    ).toThrow("Duplicate Russian profanity rule id: ru.test.duplicate");
  });

  it("rejects duplicate Russian rule order ids", () => {
    const rule = russianRule({
      id: "ru.test.ordered",
      category: "VULGAR",
      severity: "low",
      source: "ordered",
    });

    expect(() =>
      russianProfileDictionary(
        [russianFamilyDictionary([rule])],
        ["ru.test.ordered", "ru.test.ordered"],
      ),
    ).toThrow("Duplicate Russian profanity rule order id: ru.test.ordered");
  });

  it("rejects Russian rule order ids without family rules", () => {
    expect(() => russianProfileDictionary([], ["ru.test.missing"])).toThrow(
      "Missing Russian profanity rule id: ru.test.missing",
    );
  });

  it("rejects Russian rule order that omits family rules", () => {
    const rule = russianRule({
      id: "ru.test.omitted",
      category: "VULGAR",
      severity: "low",
      source: "omitted",
    });

    expect(() =>
      russianProfileDictionary([russianFamilyDictionary([rule])], []),
    ).toThrow("Russian profanity rule order does not include every rule.");
  });

  it("keeps representative Russian dictionary metadata stable", () => {
    expect(RUSSIAN_PROFANITY_DICTIONARY.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ru.obscene.blyad.family",
          category: "OBSCENE_MAT",
          severity: "high",
        }),
        expect.objectContaining({
          id: "ru.insult.pidor.family",
          category: "STRONG_INSULT",
          severity: "high",
        }),
        expect.objectContaining({
          id: "ru.vulgar.pizdec.digit.split.loose",
          category: "VULGAR",
          severity: "medium",
        }),
        expect.objectContaining({
          id: "ru.insult.suka.family",
          category: "STRONG_INSULT",
          severity: "high",
        }),
        expect.objectContaining({
          id: "ru.obscene.zalupa.family",
          category: "OBSCENE_MAT",
          severity: "high",
        }),
        expect.objectContaining({
          id: "ru.vulgar.govno.family",
          category: "VULGAR",
          severity: "medium",
        }),
      ]),
    );
  });

  it("keeps Russian rule order ids unique and aligned with the assembled dictionary", () => {
    expect(new Set(russianProfanityRuleOrder).size).toBe(
      russianProfanityRuleOrder.length,
    );
    expect(RUSSIAN_PROFANITY_DICTIONARY.rules.map((rule) => rule.id)).toEqual(
      russianProfanityRuleOrder,
    );
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
