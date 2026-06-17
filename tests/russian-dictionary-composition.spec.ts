import { describe, expect, it } from "vitest";

import { filter, validateProfanityLanguageDictionary } from "../src";
import {
  RUSSIAN_PROFANITY_DICTIONARY,
  RUSSIAN_PROFANITY_FAMILY_DICTIONARIES,
} from "../src/languages/ru";
import russianProfanityRuleOrder from "../src/languages/ru/profanity/order.json" with { type: "json" };

describe("Russian dictionary composition", () => {
  it("validates each built-in Russian family dictionary with the public validator", () => {
    for (const dictionary of RUSSIAN_PROFANITY_FAMILY_DICTIONARIES) {
      expect(validateProfanityLanguageDictionary(dictionary)).toEqual([]);
    }
  });

  it("keeps the assembled Russian dictionary rule count and representative metadata stable", () => {
    expect(RUSSIAN_PROFANITY_DICTIONARY.rules).toHaveLength(122);
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
