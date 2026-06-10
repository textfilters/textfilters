import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createProfanityFilter,
  filter,
  PROFANITY_FILTER_NAME,
  profanityFilter,
} from "../src/index.js";
import type {
  ProfanityCategory,
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

    expect(strict.analyze("абв ok")).toEqual([
      Object.assign([0, 3], {
        mode: "strict",
        category: "STRONG_INSULT",
        severity: "medium",
      }),
    ]);
    expect(strict.censor("абв ok")).toBe("*** ok");
    expect(strict.check("абв ok")).toBe(true);
  });

  it("keeps legacy string-backed public match output compatible", () => {
    const strict = createProfanityFilter(["абв"], []);
    const match = strict.analyze("абв ok")[0];

    expect(match).toEqual(Object.assign([0, 3], { mode: "strict" }));
    expect(match?.ruleId).toBeUndefined();
    expect(match?.category).toBeUndefined();
    expect(match?.severity).toBeUndefined();
    expect(strict.censor("абв ok")).toBe("*** ok");
    expect(strict.check("абв ok")).toBe(true);
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
