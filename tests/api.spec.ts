import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createProfanityFilter,
  createProfanityFilterFromDictionary,
  filter,
  PROFANITY_FILTER_NAME,
  type ProfanityCategory,
  profanityFilter,
  type ProfanityLanguageDictionary,
  type ProfanityLanguageDictionaryValidationIssue,
  type ProfanityLanguageRuleDefinition,
  type ProfanityLanguageRuleSource,
  type ProfanityMatchMode,
  type ProfanityMatchOptions,
  type ProfanityMatchRange,
  type ProfanitySeverity,
  type ProfanityTaxonomyMetadata,
  russianProfanityDictionary,
  validateProfanityLanguageDictionary,
} from "../src";

import { mask } from "./helpers";

describe("public API", () => {
  it("exports language dictionary helpers from the public entrypoint", () => {
    expectTypeOf<ProfanityLanguageDictionary>().toMatchTypeOf<{
      readonly language: string;
      readonly rules: readonly ProfanityLanguageRuleDefinition[];
    }>();
    expectTypeOf<ProfanityLanguageRuleDefinition>().toMatchTypeOf<{
      readonly id?: string;
      readonly source: ProfanityLanguageRuleSource;
      readonly match: {
        readonly strict?: Record<string, never>;
        readonly loose?: {
          readonly stretch?: boolean;
          readonly hyphenTail?: boolean;
          readonly hyphenTailMin?: number;
        };
      };
    }>();
    expectTypeOf<string>().toExtend<ProfanityLanguageRuleSource>();
    expectTypeOf<readonly string[]>().toExtend<ProfanityLanguageRuleSource>();
    expect(russianProfanityDictionary.language).toBe("ru");
    expect(russianProfanityDictionary.rules.length).toBeGreaterThan(0);
  });

  it("exports the language dictionary validator from the public entrypoint", () => {
    expectTypeOf<ProfanityLanguageDictionaryValidationIssue>().toEqualTypeOf<{
      readonly path: string;
      readonly code:
        | "invalid_dictionary"
        | "missing_language"
        | "invalid_language"
        | "missing_rules"
        | "invalid_rules"
        | "empty_rules"
        | "invalid_rule"
        | "missing_id"
        | "invalid_id"
        | "generated_id"
        | "suspicious_id"
        | "duplicate_id"
        | "language_mismatch_id"
        | "missing_category"
        | "invalid_category"
        | "missing_severity"
        | "invalid_severity"
        | "missing_source"
        | "invalid_source"
        | "source_not_trimmed"
        | "invalid_source_pattern"
        | "duplicate_source"
        | "missing_match"
        | "invalid_match"
        | "unsupported_rule_key"
        | "unsupported_match_key"
        | "missing_match_mode"
        | "invalid_strict_options"
        | "unsupported_strict_option"
        | "invalid_loose_options"
        | "unsupported_loose_option"
        | "invalid_loose_option_value"
        | "generated_metadata";
      readonly message: string;
    }>();
    expect(
      validateProfanityLanguageDictionary(russianProfanityDictionary),
    ).toEqual([]);
  });

  it("exports taxonomy metadata types from the public entrypoint", () => {
    expectTypeOf<"OBSCENE_MAT">().toExtend<ProfanityCategory>();
    expectTypeOf<"soft">().toExtend<ProfanitySeverity>();
    expectTypeOf<ProfanityTaxonomyMetadata>().toEqualTypeOf<{
      readonly category?: ProfanityCategory;
      readonly severity?: ProfanitySeverity;
    }>();
    expectTypeOf<ProfanityMatchOptions>().toEqualTypeOf<{
      readonly categories?: readonly ProfanityCategory[];
      readonly severities?: readonly ProfanitySeverity[];
      readonly minSeverity?: ProfanitySeverity;
    }>();
    expectTypeOf<"strict">().toExtend<ProfanityMatchMode>();
    expectTypeOf<ProfanityMatchRange>().toMatchTypeOf<
      Readonly<[start: number, end: number]> & {
        readonly mode: ProfanityMatchMode;
        readonly ruleId?: string;
        readonly category?: ProfanityCategory;
        readonly severity?: ProfanitySeverity;
      }
    >();
  });

  it("exposes the default instance and the compatible factory alias", () => {
    expect(filter.name).toBe(PROFANITY_FILTER_NAME);
    expect(profanityFilter(["fff"], []).censor("fff ggg")).toBe("*** ggg");
  });

  it("exposes a stable filter name and check helper", () => {
    expect(filter.name).toBe(PROFANITY_FILTER_NAME);
    expect(filter.check("привет блядь")).toBe(true);
    expect(filter.check("привет")).toBe(false);
  });

  it("uses built-in dictionaries for the default factory instance", () => {
    expect(createProfanityFilter().censor("привет блядь")).toBe("привет *****");
  });

  it("creates an isolated filter from the Russian language dictionary", () => {
    const dictionaryFilter = createProfanityFilterFromDictionary(
      russianProfanityDictionary,
    );

    expect(dictionaryFilter.name).toBe(PROFANITY_FILTER_NAME);
    expect(dictionaryFilter.censor("привет блядь")).toBe("привет *****");
    expect(dictionaryFilter.check("привет")).toBe(false);
  });

  it("preserves Russian dictionary metadata in analyze output", () => {
    const dictionaryFilter = createProfanityFilterFromDictionary(
      russianProfanityDictionary,
    );

    expect(dictionaryFilter.analyze("бля")[0]).toMatchObject({
      ruleId: "ru.obscene.blya",
      category: "OBSCENE_MAT",
      severity: "medium",
      mode: "strict",
    });
  });

  it("applies taxonomy filters to language dictionary filters", () => {
    const dictionaryFilter = createProfanityFilterFromDictionary(
      russianProfanityDictionary,
    );
    const input = "бля хули";

    expect(dictionaryFilter.check("бля", { categories: ["OBSCENE_MAT"] })).toBe(
      true,
    );
    expect(dictionaryFilter.check("бля", { categories: ["VULGAR"] })).toBe(
      false,
    );
    expect(dictionaryFilter.check("хули", { severities: ["low"] })).toBe(true);
    expect(dictionaryFilter.check("хули", { minSeverity: "medium" })).toBe(
      false,
    );
    expect(
      new Set(
        dictionaryFilter
          .analyze(input, {
            categories: ["OBSCENE_MAT"],
            minSeverity: "medium",
          })
          .map((match) => input.slice(match[0], match[1])),
      ),
    ).toEqual(new Set(["бля"]));
  });

  it("keeps language dictionary instances separate from the shared filter", () => {
    const dictionaryFilter = createProfanityFilterFromDictionary(
      russianProfanityDictionary,
    );

    dictionaryFilter.setStrict(["isolated-only"]);
    dictionaryFilter.setLoose([]);

    expect(dictionaryFilter.check("блядь")).toBe(false);
    expect(dictionaryFilter.check("isolated-only")).toBe(true);
    expect(filter.check("блядь")).toBe(true);
    expect(filter.check("isolated-only")).toBe(false);
  });

  it("keeps censor and check behavior stable through internal range metadata", () => {
    const strict = createProfanityFilter(["bad"], []);
    expect(strict.censor("bad ok")).toBe("*** ok");
    expect(strict.check("bad ok")).toBe(true);
    expect(strict.check("ok")).toBe(false);

    const loose = createProfanityFilter([], ["bad"]);
    expect(loose.censor("b-a-d ok")).toBe("***** ok");
    expect(loose.check("b-a-d ok")).toBe(true);
    expect(loose.check("ok")).toBe(false);
  });

  it("exposes taxonomy metadata on public object-backed match output", () => {
    const strict = createProfanityFilter(
      [{ source: "абв", category: "STRONG_INSULT", severity: "medium" }],
      [],
    );
    const match = strict.analyze("абв ok")[0];
    const metadata: ProfanityTaxonomyMetadata = {
      category: match?.category,
      severity: match?.severity,
    };

    expect(match?.[0]).toBe(0);
    expect(match?.[1]).toBe(3);
    expect(match?.mode).toBe("strict");
    expect(match?.category).toBe("STRONG_INSULT");
    expect(match?.severity).toBe("medium");
    expect(metadata).toEqual({
      category: "STRONG_INSULT",
      severity: "medium",
    });
    expect(strict.censor("абв ok")).toBe("*** ok");
    expect(strict.check("абв ok")).toBe(true);
  });

  it("keeps legacy string-backed public match output compatible", () => {
    const cases = [
      {
        filter: createProfanityFilter(["абв"], []),
        input: "абв ok",
        expectedMatch: Object.assign([0, 3], { mode: "strict" }),
        expectedCensored: "*** ok",
      },
      {
        filter: createProfanityFilter([], ["абв"]),
        input: "а-б-в ok",
        expectedMatch: Object.assign([0, 5], { mode: "loose" }),
        expectedCensored: "***** ok",
      },
    ] as const;

    for (const testCase of cases) {
      const match = testCase.filter.analyze(testCase.input)[0];

      expect(match).toEqual(testCase.expectedMatch);
      expect(match?.ruleId).toBeUndefined();
      expect(match?.category).toBeUndefined();
      expect(match?.severity).toBeUndefined();
      expect(testCase.filter.censor(testCase.input)).toBe(
        testCase.expectedCensored,
      );
      expect(testCase.filter.check(testCase.input)).toBe(true);
    }
  });

  it("filters match output by taxonomy category and severity options", () => {
    const strict = createProfanityFilter(
      [
        { source: "alpha", category: "OBSCENE_MAT", severity: "high" },
        { source: "beta", category: "VULGAR", severity: "low" },
        { source: "gamma", category: "VULGAR", severity: "medium" },
        "delta",
      ],
      [],
    );
    const input = "alpha beta gamma delta";

    expect(strict.analyze(input).map((match) => match.category)).toEqual([
      "OBSCENE_MAT",
      "VULGAR",
      "VULGAR",
      undefined,
    ]);
    expect(
      strict
        .analyze(input, { categories: ["VULGAR"] })
        .map((match) => input.slice(match[0], match[1])),
    ).toEqual(["beta", "gamma"]);
    expect(
      strict
        .analyze(input, { severities: ["low"] })
        .map((match) => input.slice(match[0], match[1])),
    ).toEqual(["beta"]);
    expect(
      strict
        .analyze(input, {
          categories: ["VULGAR"],
          severities: ["medium"],
        })
        .map((match) => input.slice(match[0], match[1])),
    ).toEqual(["gamma"]);
    expect(strict.analyze(input, { categories: ["EUPHEMISM"] })).toEqual([]);
  });

  it("filters match output by minimum taxonomy severity", () => {
    const strict = createProfanityFilter(
      [
        { source: "alpha", category: "EUPHEMISM", severity: "soft" },
        { source: "beta", category: "VULGAR", severity: "low" },
        { source: "gamma", category: "VULGAR", severity: "medium" },
        { source: "delta", category: "OBSCENE_MAT", severity: "high" },
        "epsilon",
      ],
      [],
    );
    const input = "alpha beta gamma delta epsilon";
    const matchedTerms = (options: ProfanityMatchOptions) =>
      strict
        .analyze(input, options)
        .map((match) => input.slice(match[0], match[1]));

    expect(matchedTerms({ minSeverity: "medium" })).toEqual(["gamma", "delta"]);
    expect(matchedTerms({ minSeverity: "soft" })).toEqual([
      "alpha",
      "beta",
      "gamma",
      "delta",
    ]);
    expect(matchedTerms({ minSeverity: "high" })).toEqual(["delta"]);
    expect(
      matchedTerms({
        categories: ["VULGAR"],
        minSeverity: "medium",
      }),
    ).toEqual(["gamma"]);
    expect(
      matchedTerms({
        severities: ["low", "medium"],
        minSeverity: "medium",
      }),
    ).toEqual(["gamma"]);
  });

  it("keeps default behavior unchanged without taxonomy filters", () => {
    const strict = createProfanityFilter(
      [
        { source: "alpha", category: "EUPHEMISM", severity: "soft" },
        { source: "beta", category: "VULGAR", severity: "low" },
        { source: "gamma", category: "STRONG_INSULT", severity: "medium" },
        { source: "delta", category: "OBSCENE_MAT", severity: "high" },
        "epsilon",
      ],
      [],
    );
    const input = "alpha beta gamma delta epsilon";

    expect(
      strict.analyze(input).map((match) => input.slice(match[0], match[1])),
    ).toEqual(["alpha", "beta", "gamma", "delta", "epsilon"]);
    expect(
      strict.analyze(input, {}).map((match) => input.slice(match[0], match[1])),
    ).toEqual(["alpha", "beta", "gamma", "delta", "epsilon"]);
    expect(strict.check(input)).toBe(true);
    expect(strict.check(input, {})).toBe(true);
    expect(strict.censor(input)).toBe("***** **** ***** ***** *******");
    expect(strict.censor(input, {})).toBe("***** **** ***** ***** *******");
  });

  it("applies taxonomy filters as intersections", () => {
    const strict = createProfanityFilter(
      [
        { source: "alpha", category: "EUPHEMISM", severity: "soft" },
        { source: "beta", category: "VULGAR", severity: "low" },
        { source: "gamma", category: "VULGAR", severity: "medium" },
        { source: "delta", category: "STRONG_INSULT", severity: "medium" },
        { source: "epsilon", category: "OBSCENE_MAT", severity: "high" },
        "zeta",
      ],
      [],
    );
    const input = "alpha beta gamma delta epsilon zeta";
    const matchedTerms = (options: ProfanityMatchOptions) =>
      strict
        .analyze(input, options)
        .map((match) => input.slice(match[0], match[1]));

    expect(
      matchedTerms({
        categories: ["VULGAR"],
        severities: ["medium", "high"],
      }),
    ).toEqual(["gamma"]);
    expect(
      matchedTerms({
        categories: ["VULGAR", "STRONG_INSULT"],
        minSeverity: "medium",
      }),
    ).toEqual(["gamma", "delta"]);
    expect(
      matchedTerms({
        severities: ["soft", "medium", "high"],
        minSeverity: "medium",
      }),
    ).toEqual(["gamma", "delta", "epsilon"]);
    expect(
      matchedTerms({
        categories: ["VULGAR"],
        severities: ["low"],
        minSeverity: "medium",
      }),
    ).toEqual([]);
  });

  it("treats empty taxonomy option arrays as empty filters", () => {
    const strict = createProfanityFilter(
      [{ source: "alpha", category: "OBSCENE_MAT", severity: "high" }],
      [],
    );

    expect(strict.analyze("alpha", { categories: [] })).toEqual([]);
    expect(strict.analyze("alpha", { severities: [] })).toEqual([]);
    expect(
      strict.analyze("alpha", {
        severities: [],
        minSeverity: "soft",
      }),
    ).toEqual([]);
    expect(
      strict.analyze("alpha", {
        categories: [],
        severities: ["high"],
      }),
    ).toEqual([]);
    expect(strict.check("alpha", { categories: [] })).toBe(false);
    expect(strict.censor("alpha", { severities: [] })).toBe("alpha");
  });

  it("excludes string-backed matches when taxonomy filters are requested", () => {
    const strict = createProfanityFilter(
      [{ source: "alpha", category: "OBSCENE_MAT", severity: "high" }],
      ["beta"],
    );
    const input = "alpha b-e-t-a";

    expect(
      strict
        .analyze(input, {
          categories: ["OBSCENE_MAT"],
          severities: ["high"],
          minSeverity: "soft",
        })
        .map((match) => input.slice(match[0], match[1])),
    ).toEqual(["alpha"]);
    expect(strict.analyze(input, { minSeverity: "soft" })).toHaveLength(1);
    expect(strict.check(input, { severities: ["low"] })).toBe(false);
    expect(strict.censor(input, { categories: ["VULGAR"] })).toBe(input);
  });

  it("applies taxonomy options to check and censor without mutating matches", () => {
    const strict = createProfanityFilter(
      [
        { source: "alpha", category: "OBSCENE_MAT", severity: "high" },
        { source: "beta", category: "VULGAR", severity: "low" },
        "delta",
      ],
      [],
    );
    const input = "alpha beta delta";
    const matches = strict.analyze(input);
    const firstMatch = matches[0];

    expect(strict.check(input, { severities: ["soft"] })).toBe(false);
    expect(strict.check(input, { minSeverity: "high" })).toBe(true);
    expect(strict.check(input, { categories: ["OBSCENE_MAT"] })).toBe(true);
    expect(strict.censor(input, { categories: ["VULGAR"] })).toBe(
      "alpha **** delta",
    );
    expect(strict.censor(input, { minSeverity: "high" })).toBe(
      "***** beta delta",
    );
    expect(strict.censor(input, { severities: ["high"] })).toBe(
      "***** beta delta",
    );
    expect(firstMatch).toEqual(
      Object.assign([0, 5], {
        mode: "strict",
        category: "OBSCENE_MAT",
        severity: "high",
      }),
    );
  });

  it("keeps check results aligned with analyze and censor on long inputs", () => {
    const strict = createProfanityFilter(
      [
        { source: "alpha", category: "OBSCENE_MAT", severity: "high" },
        { source: "omega", category: "VULGAR", severity: "low" },
      ],
      [{ source: "beta", category: "STRONG_INSULT", severity: "medium" }],
    );
    const input = `alpha ${"plain ".repeat(500)}b-e-t-a omega`;

    expect(strict.check(input)).toBe(true);
    expect(strict.check(input, { categories: ["OBSCENE_MAT"] })).toBe(true);
    expect(strict.check(input, { categories: ["STRONG_INSULT"] })).toBe(true);
    expect(strict.check(input, { minSeverity: "high" })).toBe(true);
    expect(strict.check(input, { severities: ["soft"] })).toBe(false);
    expect(
      strict
        .analyze(input, { categories: ["STRONG_INSULT"] })
        .map((match) => input.slice(match[0], match[1])),
    ).toEqual(["b-e-t-a"]);
    expect(strict.censor(input, { categories: ["VULGAR"] })).toBe(
      input.replace("omega", "*****"),
    );
  });

  it("accepts taxonomy options through the public entrypoint types", () => {
    const options: ProfanityMatchOptions = {
      categories: ["OBSCENE_MAT"],
      severities: ["high"],
      minSeverity: "medium",
    };
    const strict = createProfanityFilter(
      [{ source: "alpha", category: "OBSCENE_MAT", severity: "high" }],
      [],
    );

    expect(strict.analyze("alpha", options)).toHaveLength(1);
    expect(strict.check("alpha", options)).toBe(true);
    expect(strict.censor("alpha", options)).toBe("*****");
  });

  it("supports object-backed terms through mutable dictionary methods", () => {
    const strict = createProfanityFilter([], []);
    strict.setStrict([
      { source: "абв", category: "STRONG_INSULT", severity: "medium" },
    ]);

    expect(strict.analyze("абв ok")).toEqual([
      Object.assign([0, 3], {
        mode: "strict",
        category: "STRONG_INSULT",
        severity: "medium",
      }),
    ]);
    expect(strict.censor("абв ok")).toBe("*** ok");

    const loose = createProfanityFilter([], []);
    loose.addLoose({
      source: "абв",
      category: "EUPHEMISM",
      severity: "soft",
    });

    expect(loose.analyze("а-б-в ok")).toEqual([
      Object.assign([0, 5], {
        mode: "loose",
        category: "EUPHEMISM",
        severity: "soft",
      }),
    ]);
    expect(loose.check("а-б-в ok")).toBe(true);
  });

  it("supports runtime strict and loose dictionary replacement and extension", () => {
    const strict = createProfanityFilter(["fff"], []);
    expect(strict.censor("fff ggg")).toBe("*** ggg");
    strict.setStrict(["ggg"]);
    expect(strict.censor("fff ggg")).toBe("fff ***");
    strict.addStrict("fff");
    expect(strict.censor("fff ggg")).toBe("*** ***");

    const loose = createProfanityFilter([], ["fff"]);
    expect(loose.censor("f f f / g g g")).toBe("***** / g g g");
    loose.setLoose(["ggg"]);
    expect(loose.censor("f f f / g g g")).toBe("f f f / *****");
    loose.addLoose("fff");
    expect(loose.censor("f f f / g g g")).toBe("***** / *****");
    expect(createProfanityFilter([], ["хуйня-фикс"]).censor("хуйня-фикс")).toBe(
      mask("хуйня-фикс"),
    );
  });

  it("keeps built-in rules active when appending runtime literals", () => {
    const strict = createProfanityFilter(undefined, []);
    strict.addStrict("custom");
    expect(strict.censor("блять custom")).toBe("***** ******");

    const loose = createProfanityFilter([], undefined);
    loose.addLoose("custom");
    expect(loose.censor("п-и-з-д-е-ц / c u s t o m")).toBe(
      "*********** / ***********",
    );
  });

  it("leaves empty, whitespace, numbers, and symbols unchanged", () => {
    const cases = [
      "",
      " ",
      "   ",
      "\n",
      "\t",
      " \n\t ",
      "123",
      "42-24",
      "v1.2.3",
      "___",
      "--==--",
      "[]{}()",
    ];

    for (const input of cases) {
      expect(filter.censor(input)).toBe(input);
    }
  });
});
