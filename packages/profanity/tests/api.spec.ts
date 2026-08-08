import { describe, expect, expectTypeOf, it } from "vitest";

import {
  compileProfanityDictionary,
  createCustomProfanityFilter,
  createProfanityFilter,
  createProfanityFilterFromCompiledDictionary,
  createProfanityFilterFromDictionary,
  filter,
  PROFANITY_FILTER_NAME,
  type CompiledProfanityDictionary,
  type ProfanityCategory,
  profanityFilter,
  type ProfanityLanguageDictionary,
  type ProfanityLanguageLooseMatchOptions,
  type ProfanityLanguageDictionaryValidationIssue,
  type ProfanityLanguageRuleDefinition,
  type ProfanityLanguageRuleMatch,
  type ProfanityLanguageRuleSource,
  type ProfanityMatchMode,
  type ProfanityMatchOptions,
  type ProfanityMatchRange,
  type ProfanitySeverity,
  type ProfanityTaxonomyMetadata,
  type ReadonlyProfanityFilter,
  russianProfanityDictionary,
  validateProfanityLanguageDictionary,
} from "../src";

const CUSTOM_LANGUAGE_DICTIONARY: ProfanityLanguageDictionary = {
  language: "zz",
  rules: [
    {
      id: "zz.obscene.qwr",
      source: "qwr",
      category: "OBSCENE_MAT",
      severity: "high",
      match: { strict: {} },
    },
    {
      id: "zz.vulgar.vnn",
      source: "vnn",
      category: "VULGAR",
      severity: "low",
      match: { loose: { stretch: true } },
    },
  ],
};

describe("public entrypoint and dictionary lifecycle", () => {
  it("exports language dictionary helpers from the public entrypoint", () => {
    expectTypeOf<CompiledProfanityDictionary>().toEqualTypeOf<{
      readonly language: string;
      readonly strictRuleCount: number;
      readonly looseRuleCount: number;
    }>();
    expectTypeOf<ProfanityLanguageDictionary>().toMatchTypeOf<{
      readonly language: string;
      readonly rules: readonly ProfanityLanguageRuleDefinition[];
    }>();
    expectTypeOf<ProfanityLanguageRuleDefinition>().toMatchTypeOf<{
      readonly id: string;
      readonly category: ProfanityCategory;
      readonly severity: ProfanitySeverity;
      readonly source: ProfanityLanguageRuleSource;
      readonly match: ProfanityLanguageRuleMatch;
    }>();
    expectTypeOf<ProfanityLanguageRuleMatch>().toEqualTypeOf<
      | {
          readonly strict: Record<string, never>;
          readonly loose?: ProfanityLanguageLooseMatchOptions;
        }
      | {
          readonly strict?: Record<string, never>;
          readonly loose: ProfanityLanguageLooseMatchOptions;
        }
    >();
    expectTypeOf<{}>().not.toMatchTypeOf<ProfanityLanguageRuleMatch>();
    expectTypeOf<{
      readonly stretch: true;
    }>().toMatchTypeOf<ProfanityLanguageLooseMatchOptions>();
    expectTypeOf<{
      readonly hyphenTail: true;
      readonly hyphenTailMin: number;
    }>().toMatchTypeOf<ProfanityLanguageLooseMatchOptions>();
    expectTypeOf<{
      readonly stretch: false;
    }>().not.toMatchTypeOf<ProfanityLanguageLooseMatchOptions>();
    expectTypeOf<{
      readonly hyphenTailMin: number;
    }>().not.toMatchTypeOf<ProfanityLanguageLooseMatchOptions>();
    expectTypeOf<{
      readonly stretch: true;
      readonly hyphenTailMin: number;
    }>().not.toMatchTypeOf<ProfanityLanguageLooseMatchOptions>();
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

  it("exports the shared default filter as a read-only type", () => {
    expectTypeOf(filter).toEqualTypeOf<ReadonlyProfanityFilter>();
    expectTypeOf(createProfanityFilter()).toMatchTypeOf<{
      setStrict(list: readonly unknown[]): void;
      setLoose(list: readonly unknown[]): void;
      addStrict(term: unknown): void;
      addLoose(term: unknown): void;
    }>();
  });

  it("exposes the default instance and the compatible factory alias", () => {
    expect(filter.name).toBe(PROFANITY_FILTER_NAME);
    expect(profanityFilter(["fff"], []).censor("fff ggg")).toBe("*** ggg");
  });

  it("creates custom term filters through an unambiguous object factory", () => {
    const custom = createCustomProfanityFilter({
      strict: ["alpha"],
      loose: ["beta"],
    });

    expect(custom.censor("alpha b-e-t-a")).toBe("***** *******");
    expect(createCustomProfanityFilter().check("блядь")).toBe(false);
  });

  it("keeps the shared default filter read-only", () => {
    const errorMessage =
      "The shared profanity filter is read-only. Use createProfanityFilter() or a dictionary factory to create a mutable filter.";

    expect(Object.isFrozen(filter)).toBe(true);
    expect(() => filter.addStrict("shared-only")).toThrow(errorMessage);
    expect(() => filter.addLoose("sharedloose")).toThrow(errorMessage);
    expect(() => filter.setStrict(["replacement-only"])).toThrow(errorMessage);
    expect(() => filter.setLoose(["replacementloose"])).toThrow(errorMessage);

    expect(filter.check("блядь")).toBe(true);
    expect(filter.check("shared-only")).toBe(false);
    expect(filter.check("s-h-a-r-e-d-l-o-o-s-e")).toBe(false);
    expect(filter.check("replacement-only")).toBe(false);
    expect(filter.check("r-e-p-l-a-c-e-m-e-n-t-l-o-o-s-e")).toBe(false);
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

  it("creates filters from an explicitly compiled Russian dictionary", () => {
    const compiled = compileProfanityDictionary(russianProfanityDictionary);
    const dictionaryFilter =
      createProfanityFilterFromCompiledDictionary(compiled);

    expect(compiled).toMatchObject({
      language: "ru",
    });
    expect(compiled.strictRuleCount).toBeGreaterThan(0);
    expect(compiled.looseRuleCount).toBeGreaterThan(0);
    expect(dictionaryFilter.name).toBe(PROFANITY_FILTER_NAME);
    expect(dictionaryFilter.censor("привет блядь")).toBe("привет *****");
    expect(dictionaryFilter.check("привет")).toBe(false);
  });

  it("keeps compiled dictionary state on the returned object without exposing it as metadata", () => {
    const compiled = compileProfanityDictionary(russianProfanityDictionary);
    const copiedCompiled = Object.create(Object.getPrototypeOf(compiled));
    Object.defineProperties(
      copiedCompiled,
      Object.getOwnPropertyDescriptors(compiled),
    );

    expect(Object.keys(compiled)).toEqual([
      "language",
      "normalization",
      "strictRuleCount",
      "looseRuleCount",
    ]);
    expect(
      createProfanityFilterFromCompiledDictionary(
        copiedCompiled as CompiledProfanityDictionary,
      ).check("привет блядь"),
    ).toBe(true);
  });

  it("preserves Russian dictionary metadata in analyze output", () => {
    const dictionaryFilter = createProfanityFilterFromDictionary(
      russianProfanityDictionary,
    );

    expect(dictionaryFilter.analyze("бля")[0]).toMatchObject({
      ruleId: "ru.obscene.blya",
      category: "OBSCENE_MAT",
      severity: "high",
      mode: "strict",
    });
  });

  it("preserves compiled dictionary metadata in analyze output", () => {
    const dictionaryFilter = createProfanityFilterFromCompiledDictionary(
      compileProfanityDictionary(russianProfanityDictionary),
    );

    expect(dictionaryFilter.analyze("бля")[0]).toMatchObject({
      ruleId: "ru.obscene.blya",
      category: "OBSCENE_MAT",
      severity: "high",
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

  it("keeps filters from one compiled dictionary isolated after runtime mutations", () => {
    const compiled = compileProfanityDictionary(russianProfanityDictionary);
    const first = createProfanityFilterFromCompiledDictionary(compiled);
    const second = createProfanityFilterFromCompiledDictionary(compiled);

    first.addStrict("tenant-only");

    expect(first.check("tenant-only")).toBe(true);
    expect(second.check("tenant-only")).toBe(false);
    expect(second.check("блядь")).toBe(true);

    first.setStrict(["replacement-only"]);
    first.setLoose([]);

    expect(first.check("блядь")).toBe(false);
    expect(first.check("replacement-only")).toBe(true);
    expect(second.check("блядь")).toBe(true);
    expect(second.check("replacement-only")).toBe(false);

    second.addLoose("tenantloose");

    expect(second.check("t-e-n-a-n-t-l-o-o-s-e")).toBe(true);
    expect(first.check("t-e-n-a-n-t-l-o-o-s-e")).toBe(false);
  });

  it("creates compiled filters from custom dictionaries", () => {
    const compiled = compileProfanityDictionary(CUSTOM_LANGUAGE_DICTIONARY);
    const dictionaryFilter =
      createProfanityFilterFromCompiledDictionary(compiled);

    expect(compiled).toEqual({
      language: "zz",
      normalization: "cyrillic-homoglyphs",
      strictRuleCount: 1,
      looseRuleCount: 1,
    });
    expect(dictionaryFilter.analyze("qwr")[0]).toMatchObject({
      ruleId: "zz.obscene.qwr",
      category: "OBSCENE_MAT",
      severity: "high",
      mode: "strict",
    });
    expect(dictionaryFilter.check("v-n-n")).toBe(true);
    expect(dictionaryFilter.check("plain")).toBe(false);
  });

  it("does not reuse compiled state for direct mutable dictionary factories", () => {
    const rules = [...CUSTOM_LANGUAGE_DICTIONARY.rules];
    const dictionary: ProfanityLanguageDictionary = {
      language: "zz",
      rules,
    };
    const compiled = compileProfanityDictionary(dictionary);
    const compiledFilter =
      createProfanityFilterFromCompiledDictionary(compiled);

    rules.push({
      id: "zz.vulgar.fragmented",
      source: ["q", "[._-]?", "w", "[._-]?", "r"],
      category: "VULGAR",
      severity: "medium",
      match: { strict: {} },
    });

    const directFilter = createProfanityFilterFromDictionary(dictionary);

    expect(compiledFilter.check("q-w-r")).toBe(false);
    expect(directFilter.check("q-w-r")).toBe(true);
  });

  it("rejects objects that were not returned by the dictionary compiler", () => {
    expect(() =>
      createProfanityFilterFromCompiledDictionary({
        language: "zz",
        strictRuleCount: 0,
        looseRuleCount: 0,
      }),
    ).toThrow(
      "Expected a compiled profanity dictionary created by compileProfanityDictionary().",
    );
  });
});
