import { describe, expect, it } from "vitest";

import { createProfanityFilter, filter } from "../src";
import { LOOSE_BASE } from "../src/terms/loose-base";
import { STRICT_BASE } from "../src/terms/strict-base";

import { mask } from "./helpers";

describe("Russian coverage audit", () => {
  it("keeps strict and loose Russian dictionary views distinct", () => {
    const strictOnly = createProfanityFilter(STRICT_BASE, []);
    const looseOnly = createProfanityFilter([], LOOSE_BASE);

    expect(strictOnly.censor("блядь")).toBe("*****");
    expect(strictOnly.censor("ебаный")).toBe("******");
    expect(strictOnly.censor("ебанутый")).toBe("********");
    expect(strictOnly.censor("небанальный")).toBe("небанальный");
    expect(strictOnly.censor("б л я д ь")).toBe("б л я д ь");
    expect(looseOnly.censor("б л я д ь")).toBe("*********");
    expect(strictOnly.censor("п-и-з-д-е-ц")).toBe("п-и-з-д-е-ц");
    expect(looseOnly.censor("п-и-з-д-е-ц")).toBe("***********");
  });

  it("keeps loose prihue suffixes from crossing whitespace", () => {
    const cases: Array<[string, string]> = [
      ["прихуе я", "****** я"],
      ["прихуе лом", "****** лом"],
      ["заеб кот", "**** кот"],
      ["ебат кот", "**** кот"],
      ["ebat rabbit", "**** rabbit"],
      ["e6at rabbit", "**** rabbit"],
      ["eblan rabbit", "***** rabbit"],
      ["ebliv rabbit", "***** rabbit"],
      ["ebuch rabbit", "***** rabbit"],
      ["ebash rabbit", "***** rabbit"],
      ["zaebash rabbit", "******* rabbit"],
      ["uebat rabbit", "***** rabbit"],
      ["uebal rabbit", "***** rabbit"],
      ["ueban rabbit", "***** rabbit"],
      ["ebet rabbit", "**** rabbit"],
      ["e6et rabbit", "**** rabbit"],
      ["yebet rabbit", "***** rabbit"],
      ["jebet rabbit", "***** rabbit"],
      ["zayebet rabbit", "******* rabbit"],
      ["yeblan rabbit", "****** rabbit"],
      ["jebliv rabbit", "****** rabbit"],
      ["yebuch rabbit", "****** rabbit"],
      ["uyebat rabbit", "****** rabbit"],
      ["ujebal rabbit", "****** rabbit"],
      ["uyeban rabbit", "****** rabbit"],
      ["yobat rabbit", "***** rabbit"],
      ["jobat rabbit", "***** rabbit"],
      ["zayobal rabbit", "******* rabbit"],
      ["е6-ал кот", "***** кот"],
      ["е6-а-л кот", "****** кот"],
      ["е6аш слово", "**** слово"],
      ["заеб@л и пошёл", "****** и пошёл"],
      ["прихуе л и дальше", "******** и дальше"],
      ["пизда 4 раза", "***** 4 раза"],
      ["хуяч 4 раза", "**** 4 раза"],
      ["ахуев 4 раза", "***** 4 раза"],
      ["блеа 6 лет", "**** 6 лет"],
      ["хуе 1 тариф", "*** 1 тариф"],
      ["хуй 1 номер", "*** 1 номер"],
      ["хуев 1 вариант", "**** 1 вариант"],
      ["прихуе 1 елка", "****** 1 елка"],
      ["хуе 1 сосна", "*** 1 сосна"],
      ["охуе 1 енот", "**** 1 енот"],
      ["охуе 1 т", "**** 1 т"],
      ["хуйня-e6atb-слово", "*****************"],
      ["хуйня-E-6-анкета", "*****-E-6-анкета"],
      ["о-хуи текст", "***** текст"],
      ["хуй 1 ня", "*** 1 ня"],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input), input).toBe(expected);
    }
  });

  it("keeps reviewed leet suffixes from borrowing the next word", () => {
    const cases: Array<[string, string]> = [
      ["хуя4 кот", "**** кот"],
      ["pidor rabbit", "***** rabbit"],
      ["pidoras rabbit", "******* rabbit"],
      ["hueta rabbit", "***** rabbit"],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input), input).toBe(expected);
    }
  });

  it("preserves representative metadata for loose bypass matches", () => {
    const cases = [
      {
        input: "х1у1й",
        expected: {
          ruleId: "ru.obscene.huy.digit.split.loose",
          category: "OBSCENE_MAT",
          severity: "high",
          mode: "loose",
        },
      },
      {
        input: "п1и1з1д1а",
        expected: {
          ruleId: "ru.obscene.pizda.digit.split.loose",
          category: "OBSCENE_MAT",
          severity: "high",
          mode: "loose",
        },
      },
      {
        input: "п1и1з1д1е1ц",
        expected: {
          ruleId: "ru.vulgar.pizdec.digit.split.loose",
          category: "VULGAR",
          severity: "medium",
          mode: "loose",
        },
      },
      {
        input: "зае6ал",
        expected: {
          ruleId: "ru.obscene.eb.prefix.basic.six.loose",
          category: "OBSCENE_MAT",
          severity: "high",
          mode: "loose",
        },
      },
      {
        input: "уе6ал",
        expected: {
          ruleId: "ru.insult.eb.prefix.u.six.loose",
          category: "STRONG_INSULT",
          severity: "high",
          mode: "loose",
        },
      },
      {
        input: "хуя4ить",
        expected: {
          ruleId: "ru.vulgar.huyach.family",
          category: "VULGAR",
          severity: "medium",
          mode: "strict",
        },
      },
    ];

    for (const { input, expected } of cases) {
      expect(filter.analyze(input), input).toEqual(
        expect.arrayContaining([expect.objectContaining(expected)]),
      );
    }
  });

  it("preserves taxonomy for category-filtered six-as-b matches", () => {
    expect(filter.check("уе6ал", { categories: ["STRONG_INSULT"] })).toBe(true);
    expect(filter.check("уе6ал", { categories: ["OBSCENE_MAT"] })).toBe(false);
  });

  it("continues to mask already audited whole-token examples exactly", () => {
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
});
