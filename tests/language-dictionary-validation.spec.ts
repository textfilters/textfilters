import { describe, expect, it } from "vitest";

import {
  compileProfanityDictionary,
  createProfanityFilterFromDictionary,
  validateProfanityLanguageDictionary,
  type ProfanityLanguageDictionary,
  type ProfanityLanguageDictionaryValidationIssue,
} from "../src";
import { assertLanguageDictionaryInvariants } from "./language-dictionary-helpers";

const issueSummary = (
  issues: readonly ProfanityLanguageDictionaryValidationIssue[],
): Array<Pick<ProfanityLanguageDictionaryValidationIssue, "path" | "code">> =>
  issues.map(({ path, code }) => ({ path, code }));

describe("language dictionary validation", () => {
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
        {
          id: "zz.vulgar.noop",
          category: "VULGAR",
          severity: "low",
          source: "qw2",
          match: {
            loose: {
              hyphenTailMin: 2,
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
      {
        path: "rules[2].match.loose.hyphenTailMin",
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

  it("validates source fragments before compiling the joined pattern", () => {
    const issues = validateProfanityLanguageDictionary({
      language: "zz",
      rules: [
        {
          id: "zz.vulgar.empty",
          category: "VULGAR",
          severity: "low",
          source: ["q", ""],
          match: {
            strict: {},
          },
        },
        {
          id: "zz.vulgar.spaced",
          category: "VULGAR",
          severity: "low",
          source: ["q", " wr"],
          match: {
            strict: {},
          },
        },
        {
          id: "zz.vulgar.invalid",
          category: "VULGAR",
          severity: "low",
          source: ["q", "("],
          match: {
            strict: {},
          },
        },
      ],
    });

    expect(issueSummary(issues)).toEqual([
      { path: "rules[0].source", code: "invalid_source" },
      { path: "rules[1].source[1]", code: "source_not_trimmed" },
      { path: "rules[2].source", code: "invalid_source_pattern" },
    ]);
  });

  it("rejects invalid dictionaries before compiling filters", () => {
    const invalidPatternDictionary = {
      language: "zz",
      rules: [
        {
          id: "zz.vulgar.valid",
          category: "VULGAR",
          severity: "low",
          source: "qwr",
          match: {
            strict: {},
          },
        },
        {
          id: "zz.vulgar.invalid",
          category: "VULGAR",
          severity: "low",
          source: "(",
          match: {
            strict: {},
          },
        },
      ],
    } as const satisfies ProfanityLanguageDictionary;

    expect(() => compileProfanityDictionary(invalidPatternDictionary)).toThrow(
      "Invalid profanity language dictionary: rules[1].source invalid_source_pattern",
    );
    expect(() =>
      createProfanityFilterFromDictionary(invalidPatternDictionary),
    ).toThrow(
      "Invalid profanity language dictionary: rules[1].source invalid_source_pattern",
    );
  });

  it("rejects unsupported dictionary shapes before compilation", () => {
    const unsupportedShape = {
      language: "zz",
      rules: [
        {
          id: "zz.vulgar.qwr",
          category: "VULGAR",
          severity: "low",
          source: "qwr",
          match: {
            fuzzy: {},
          },
        },
      ],
    } as unknown as ProfanityLanguageDictionary;

    expect(() => compileProfanityDictionary(unsupportedShape)).toThrow(
      "Invalid profanity language dictionary: rules[0].match.fuzzy unsupported_match_key",
    );
  });

  it("treats undefined match modes as absent", () => {
    const dictionary = {
      language: "zz",
      rules: [
        {
          id: "zz.vulgar.loose",
          category: "VULGAR",
          severity: "low",
          source: "qwr",
          match: {
            strict: undefined,
            loose: {},
          },
        },
        {
          id: "zz.vulgar.strict",
          category: "VULGAR",
          severity: "low",
          source: "vnn",
          match: {
            strict: {},
            loose: undefined,
          },
        },
      ],
    } as unknown as ProfanityLanguageDictionary;

    expect(validateProfanityLanguageDictionary(dictionary)).toEqual([]);
    expect(createProfanityFilterFromDictionary(dictionary).check("qwr")).toBe(
      true,
    );
  });

  it("treats undefined loose option values as absent", () => {
    const dictionary = {
      language: "zz",
      rules: [
        {
          id: "zz.vulgar.loose",
          category: "VULGAR",
          severity: "low",
          source: "qwr",
          match: {
            loose: {
              stretch: undefined,
              hyphenTail: undefined,
              hyphenTailMin: undefined,
            },
          },
        },
      ],
    } as unknown as ProfanityLanguageDictionary;

    expect(validateProfanityLanguageDictionary(dictionary)).toEqual([]);
    expect(createProfanityFilterFromDictionary(dictionary).check("qwr")).toBe(
      true,
    );
  });

  it("rejects sources that fail after loose matching expansion", () => {
    const dictionary = {
      language: "zz",
      rules: [
        {
          id: "zz.vulgar.named.group",
          category: "VULGAR",
          severity: "low",
          source: "(?<term>qwr)",
          match: {
            loose: {},
          },
        },
      ],
    } as const satisfies ProfanityLanguageDictionary;

    expect(
      issueSummary(validateProfanityLanguageDictionary(dictionary)),
    ).toEqual([{ path: "rules[0].source", code: "invalid_source_pattern" }]);
    expect(() => compileProfanityDictionary(dictionary)).toThrow(
      "Invalid profanity language dictionary: rules[0].source invalid_source_pattern",
    );
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
});
