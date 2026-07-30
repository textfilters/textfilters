import { describe, expect, it } from "vitest";

import {
  createProfanityFilter,
  createProfanityFilterFromDictionary,
  type ProfanityMatchOptions,
  type ProfanityTaxonomyMetadata,
} from "../src";

describe("public match metadata and taxonomy options", () => {
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

  it("keeps indexed strict token lookup compatible with custom regexp rules", () => {
    const strict = createProfanityFilterFromDictionary({
      language: "zz",
      rules: [
        {
          id: "zz.obscene.alternative",
          source: "fоо|Ьаr",
          category: "OBSCENE_MAT",
          severity: "high",
          match: { strict: {} },
        },
        {
          id: "zz.obscene.casefold",
          source: "kнuу",
          category: "OBSCENE_MAT",
          severity: "high",
          match: { strict: {} },
        },
        {
          id: "zz.obscene.separator.prefix",
          source: String.raw`[^\p{L}\p{N}]*Ьаd`,
          category: "OBSCENE_MAT",
          severity: "high",
          match: { strict: {} },
        },
        {
          id: "zz.obscene.digit.prefix",
          source: String.raw`[^\p{L}]*Ьаd`,
          category: "OBSCENE_MAT",
          severity: "high",
          match: { strict: {} },
        },
      ],
    });

    expect(strict.check("bar")).toBe(true);
    expect(strict.check("Khuy")).toBe(true);
    expect(strict.check("-bad")).toBe(true);
    expect(strict.check("1bad")).toBe(true);
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

  it("checks taxonomy filters without requiring the first collected match to qualify", () => {
    const strict = createProfanityFilter(
      [
        { source: "alpha", category: "EUPHEMISM", severity: "soft" },
        { source: "beta", category: "VULGAR", severity: "medium" },
        { source: "gamma", category: "OBSCENE_MAT", severity: "high" },
      ],
      [],
    );
    const input = "alpha beta gamma";
    const options: ProfanityMatchOptions = {
      categories: ["VULGAR"],
      minSeverity: "medium",
    };

    expect(strict.check(input, options)).toBe(true);
    expect(
      strict.analyze(input).map((match) => input.slice(match[0], match[1])),
    ).toEqual(["alpha", "beta", "gamma"]);
    expect(
      strict
        .analyze(input, options)
        .map((match) => input.slice(match[0], match[1])),
    ).toEqual(["beta"]);
    expect(strict.censor(input, options)).toBe("alpha **** gamma");
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
});
