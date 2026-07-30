import { describe, expect, it } from "vitest";

import { filter } from "../src/index.js";

const mask = (value: string): string => "*".repeat(Array.from(value).length);

describe("@textfilters/phone curated regressions", () => {
  it("masks accepted phone formats from the shared filter corpus", () => {
    const cases: Array<[string, string]> = [
      ["+79991234567", mask("+79991234567")],
      ["89991234567", mask("89991234567")],
      ["7 999 123 45 67", mask("7 999 123 45 67")],
      ["+7 999 1 2 3 4 5 6 7", mask("+7 999 1 2 3 4 5 6 7")],
      ["+٧ ٩٩٩ ١٢٣ ٤٥ ٦٧", mask("+٧ ٩٩٩ ١٢٣ ٤٥ ٦٧")],
      ["+1 415 555 2671", mask("+1 415 555 2671")],
      ["+44 20 7946 0958", mask("+44 20 7946 0958")],
      ["семь 999 123 45 67", `семь ${mask("999 123 45 67")}`],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input)).toBe(expected);
    }
  });

  it("keeps masked or word-number phone-like strings unchanged", () => {
    const cases = [
      "+7 девятьсот 123 45 67",
      "7999***4567",
      "+7 999 *** ** 67",
      "+7(999)xxx-xx-xx",
    ];

    for (const input of cases) {
      expect(filter.censor(input)).toBe(input);
    }
  });
});
