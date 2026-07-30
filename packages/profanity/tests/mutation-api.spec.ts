import { describe, expect, it } from "vitest";

import { createProfanityFilter, filter } from "../src";
import { mask } from "./helpers";

describe("public mutation and input behavior", () => {
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

  it("keeps factory-created filters mutable after the default export is read-only", () => {
    const mutable = createProfanityFilter([], []);

    mutable.addStrict("strict-only");
    mutable.addLoose("looseonly");

    expect(mutable.check("strict-only")).toBe(true);
    expect(mutable.check("l-o-o-s-e-o-n-l-y")).toBe(true);
    expect(filter.check("strict-only")).toBe(false);
    expect(filter.check("l-o-o-s-e-o-n-l-y")).toBe(false);
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

  it("normalizes empty and non-string public input through core", () => {
    const objectInput = { toString: () => "блядь" };

    expect(filter.censor(null as unknown as string)).toBe("");
    expect(filter.censor(undefined as unknown as string)).toBe("");
    expect(filter.censor(12345 as unknown as string)).toBe("12345");
    expect(filter.censor(objectInput as unknown as string)).toBe("*****");
    expect(filter.check(objectInput as unknown as string)).toBe(true);
    expect(
      filter.analyze(objectInput as unknown as string).length,
    ).toBeGreaterThan(0);
  });
});
