import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createProfanityFilter,
  filter,
  PROFANITY_FILTER_NAME,
  profanityFilter,
} from "../src/index.js";
import type {
  ProfanityCategory,
  ProfanityMatchOptions,
  ProfanityMatchMode,
  ProfanityMatchRange,
  ProfanitySeverity,
  ProfanityTaxonomyMetadata,
} from "../src/index.js";

import { mask } from "./helpers.js";

describe("public API", () => {
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

  it("treats empty taxonomy option arrays as empty filters", () => {
    const strict = createProfanityFilter(
      [{ source: "alpha", category: "OBSCENE_MAT", severity: "high" }],
      [],
    );

    expect(strict.analyze("alpha", { categories: [] })).toEqual([]);
    expect(strict.analyze("alpha", { severities: [] })).toEqual([]);
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
        })
        .map((match) => input.slice(match[0], match[1])),
    ).toEqual(["alpha"]);
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
    expect(strict.check(input, { categories: ["OBSCENE_MAT"] })).toBe(true);
    expect(strict.censor(input, { categories: ["VULGAR"] })).toBe(
      "alpha **** delta",
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

  it("accepts taxonomy options through the public entrypoint types", () => {
    const options: ProfanityMatchOptions = {
      categories: ["OBSCENE_MAT"],
      severities: ["high"],
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
