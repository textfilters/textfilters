import { describe, expect, it } from "vitest";

import { createProfanityFilter, filter } from "../src/index.js";
import { LOOSE_BASE } from "../src/terms/loose-base.js";
import { STRICT_BASE } from "../src/terms/strict-base.js";

import { mask } from "./helpers.js";

describe("Russian coverage audit", () => {
  it("documents covered Russian morphology, normalization, and obfuscation cases", () => {
    const cases: Array<[string, string]> = [
      ["заёбал", mask("заёбал")],
      ["за.е.е.е.б.а.л", mask("за.е.е.е.б.а.л")],
      ["хуёвый", mask("хуёвый")],
      ["хуeта", mask("хуeта")],
      ["xуета", mask("xуета")],
      ["х.у.й.н.ё.й", mask("х.у.й.н.ё.й")],
      ["пиздёж", mask("пиздёж")],
      ["пиздецнахуй", mask("пиздецнахуй")],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input), input).toBe(expected);
    }
  });

  it("covers audited weak Russian forms through dictionary data", () => {
    const cases: Array<[string, string]> = [
      ["съёб", mask("съёб")],
      ["въёб", mask("въёб")],
      ["отъёб", mask("отъёб")],
      ["ахуевший", mask("ахуевший")],
      ["пuдор", mask("пuдор")],
      ["пид0р", mask("пид0р")],
      ["бл9ть", mask("бл9ть")],
      ["бл@ть", mask("бл@ть")],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input), input).toBe(expected);
    }
  });

  it("keeps strict and loose Russian dictionary views distinct", () => {
    const strictOnly = createProfanityFilter(STRICT_BASE, []);
    const looseOnly = createProfanityFilter([], LOOSE_BASE);

    expect(strictOnly.censor("блядь")).toBe("*****");
    expect(strictOnly.censor("б л я д ь")).toBe("б л я д ь");
    expect(looseOnly.censor("б л я д ь")).toBe("*********");
    expect(strictOnly.censor("п-и-з-д-е-ц")).toBe("п-и-з-д-е-ц");
    expect(looseOnly.censor("п-и-з-д-е-ц")).toBe("***********");
  });

  it("keeps audited Russian false positives and unsupported terms unchanged", () => {
    const cases = [
      "себ",
      "отеб",
      "схуйня-фикс",
      "хулиган",
      "небанальный",
      "сука",
      "сучка",
      "гандон",
      "залупа",
      "бл#ть",
    ];

    for (const input of cases) {
      expect(filter.censor(input), input).toBe(input);
    }
  });
});
