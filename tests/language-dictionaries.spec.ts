import { describe, expect, it } from "vitest";

import {
  createProfanityFilterFromDictionary,
  filter,
  validateProfanityLanguageDictionary,
  type ProfanityLanguageDictionary,
  type ProfanityLanguageDictionaryValidationIssue,
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

const issueSummary = (
  issues: readonly ProfanityLanguageDictionaryValidationIssue[],
): Array<Pick<ProfanityLanguageDictionaryValidationIssue, "path" | "code">> =>
  issues.map(({ path, code }) => ({ path, code }));

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

  it("returns stable issue codes and paths for invalid dictionaries", () => {
    const issues = validateProfanityLanguageDictionary({
      language: "",
      rules: [
        {
          source: "",
          match: {},
        },
        {
          id: "zz.vulgar.duplicate",
          category: "VULGAR",
          severity: "low",
          source: "qwr",
          match: {
            strict: {},
          },
        },
        {
          id: "zz.vulgar.duplicate",
          category: "UNKNOWN",
          severity: "highest",
          source: "qwr",
          match: {
            loose: {
              stretch: false,
              distance: 1,
            },
          },
        },
        {
          id: "builtin:strict:0:abcdefg",
          category: "VULGAR",
          severity: "low",
          source: "qwr",
          match: {
            strict: {
              ruleId: "compiled-rule",
            },
          },
          ruleId: "compiled-rule",
          order: 1,
          re: "qwr",
          ranges: [[0, 3]],
        },
      ],
    });

    expect(issueSummary(issues)).toEqual([
      { path: "language", code: "invalid_language" },
      { path: "rules[0].id", code: "missing_id" },
      { path: "rules[0].category", code: "missing_category" },
      { path: "rules[0].severity", code: "missing_severity" },
      { path: "rules[0].source", code: "invalid_source" },
      { path: "rules[0].match", code: "missing_match_mode" },
      { path: "rules[2].id", code: "duplicate_id" },
      { path: "rules[2].category", code: "invalid_category" },
      { path: "rules[2].severity", code: "invalid_severity" },
      { path: "rules[2].source", code: "duplicate_source" },
      {
        path: "rules[2].match.loose.stretch",
        code: "invalid_loose_option_value",
      },
      {
        path: "rules[2].match.loose.distance",
        code: "unsupported_loose_option",
      },
      { path: "rules[3].id", code: "generated_id" },
      { path: "rules[3].source", code: "duplicate_source" },
      {
        path: "rules[3].match.strict.ruleId",
        code: "unsupported_strict_option",
      },
      {
        path: "rules[3].match.strict.ruleId",
        code: "generated_metadata",
      },
      {
        path: "rules[3].ruleId",
        code: "generated_metadata",
      },
      {
        path: "rules[3].order",
        code: "generated_metadata",
      },
      {
        path: "rules[3].re",
        code: "generated_metadata",
      },
      {
        path: "rules[3].ranges",
        code: "generated_metadata",
      },
    ]);
    expect(issues.every((issue) => issue.message.length > 0)).toBe(true);
  });

  it("flags suspicious authoring keys, language-mismatched ids, and duplicate sources", () => {
    const issues = validateProfanityLanguageDictionary({
      language: "zz",
      rules: [
        {
          id: "ru.vulgar.example",
          category: "VULGAR",
          severity: "low",
          source: " qwr ",
          notes: "not part of the source contract",
          match: {
            strict: {},
            fuzzy: {},
          },
        },
        {
          id: "zz.vulgar.other",
          category: "VULGAR",
          severity: "low",
          source: "qwr",
          match: {
            loose: {
              hyphenTail: false,
              hyphenTailMin: 0,
            },
          },
        },
      ],
    });

    expect(issueSummary(issues)).toEqual([
      { path: "rules[0].notes", code: "unsupported_rule_key" },
      { path: "rules[0].id", code: "language_mismatch_id" },
      { path: "rules[0].source", code: "source_not_trimmed" },
      { path: "rules[0].match.fuzzy", code: "unsupported_match_key" },
      { path: "rules[1].source", code: "duplicate_source" },
      {
        path: "rules[1].match.loose.hyphenTail",
        code: "invalid_loose_option_value",
      },
      {
        path: "rules[1].match.loose.hyphenTailMin",
        code: "invalid_loose_option_value",
      },
    ]);
  });

  it("flags suspicious ids and invalid source patterns before runtime compilation", () => {
    const issues = validateProfanityLanguageDictionary({
      language: "zz",
      rules: [
        {
          id: "zz.vulgar.category-mismatch",
          category: "OBSCENE_MAT",
          severity: "medium",
          source: "(",
          match: {
            strict: {},
          },
        },
      ],
    });

    expect(issueSummary(issues)).toEqual([
      { path: "rules[0].id", code: "invalid_id" },
      { path: "rules[0].source", code: "invalid_source_pattern" },
    ]);

    const suspiciousIssues = validateProfanityLanguageDictionary({
      language: "zz",
      rules: [
        {
          id: "zz.vulgar.category",
          category: "OBSCENE_MAT",
          severity: "medium",
          source: "qwr",
          match: {
            strict: {},
          },
        },
      ],
    });

    expect(issueSummary(suspiciousIssues)).toEqual([
      { path: "rules[0].id", code: "suspicious_id" },
    ]);
  });

  it("returns shape issues instead of throwing for malformed inputs", () => {
    expect(issueSummary(validateProfanityLanguageDictionary(null))).toEqual([
      { path: "$", code: "invalid_dictionary" },
    ]);
    expect(issueSummary(validateProfanityLanguageDictionary({}))).toEqual([
      { path: "language", code: "missing_language" },
      { path: "rules", code: "missing_rules" },
    ]);
    expect(
      issueSummary(
        validateProfanityLanguageDictionary({
          language: "zz",
          rules: "not-array",
        }),
      ),
    ).toEqual([{ path: "rules", code: "invalid_rules" }]);
    expect(
      issueSummary(
        validateProfanityLanguageDictionary({
          language: "zz",
          rules: [],
        }),
      ),
    ).toEqual([{ path: "rules", code: "empty_rules" }]);
    expect(
      issueSummary(
        validateProfanityLanguageDictionary({
          language: "zz",
          rules: [
            {
              id: "not.semantic",
              category: "VULGAR",
              severity: "low",
              source: "qwr",
              match: {
                strict: {},
              },
            },
          ],
        }),
      ),
    ).toEqual([{ path: "rules[0].id", code: "invalid_id" }]);
  });

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
