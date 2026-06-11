import { describe, expect, it } from "vitest";

import { filter } from "../src/index.js";
import { RUSSIAN_PROFANITY_DICTIONARY } from "../src/languages/ru/index.js";
import { assertLanguageDictionaryInvariants } from "./language-dictionary-helpers.js";

const LANGUAGE_DICTIONARIES = [RUSSIAN_PROFANITY_DICTIONARY] as const;

describe("language dictionaries", () => {
  it.each(LANGUAGE_DICTIONARIES)(
    "keeps the $language dictionary human-maintained and schema-valid",
    (dictionary) => {
      assertLanguageDictionaryInvariants(dictionary);
    },
  );

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
