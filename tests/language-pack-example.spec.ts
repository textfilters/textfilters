import { describe, expect, it } from "vitest";

import { zzProfanityDictionary } from "../examples/language-pack/src/dictionary.js";
import {
  createProfanityFilterFromDictionary,
  validateProfanityLanguageDictionary,
} from "../src/index.js";

describe("language pack example", () => {
  it("keeps the example dictionary valid and filter-compatible", () => {
    expect(validateProfanityLanguageDictionary(zzProfanityDictionary)).toEqual(
      [],
    );

    const exampleFilter = createProfanityFilterFromDictionary(
      zzProfanityDictionary,
    );

    expect(exampleFilter.check("qwr")).toBe(true);
    expect(exampleFilter.check("q-w-r")).toBe(true);
    expect(exampleFilter.check("vnn")).toBe(true);
    expect(exampleFilter.analyze("qwr")[0]).toMatchObject({
      ruleId: "zz.vulgar.qwr",
      category: "VULGAR",
      severity: "low",
      mode: "strict",
    });
  });
});
