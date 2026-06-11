import { describe, expect, it } from "vitest";

import { createProfanityFilter, filter } from "../src/index.js";

import { mask } from "./helpers.js";

describe("loose corpus", () => {
  it("censors built-in loose matches across separators without changing length", () => {
    const cases = [
      "ну это пи здец конечно",
      "п-и-з-д-е-ц",
      "п.и.з.д.е.ц",
      "п_и_з_д_е_ц",
      "п-и-з-д-ы",
      "п и д о р",
      "х/у/й",
      "б*л*я*д*ь",
      "е-б-а-л",
      "с-ъ-е-б-а-л",
      "за-е-б-а-л",
      "е-б-н-у-т-ь",
      "о-т-ъ-е-б-и-с-ь",
      "н-а-х-у-й",
      "п-о-х-у-й",
    ];

    for (const input of cases) {
      const output = filter.censor(input);
      expect(output.length).toBe(input.length);
      expect(output).toContain("*");
      expect(output).not.toBe(input);
    }
  });

  it("censors stretched built-in profanity families by default", () => {
    const cases = [
      "хуууй",
      "бляяя",
      "пиииздец",
      "заееебал",
      "выыыеебал",
      "ееебнулся",
      "хуууйню",
      "охуууеть",
    ];

    for (const input of cases) {
      const output = filter.censor(input);
      expect(output.length).toBe(input.length);
      expect(output).toBe(mask(input));
    }
  });

  it("censors mixed separator and stretched built-in profanity families", () => {
    const cases = [
      "х-у-у-у-й",
      "б л я я я",
      "п_и_и_и_з_д_е_ц",
      "за.е.е.е.б.а.л",
      "о/х/у/у/е/т/ь",
      "н а х у у й",
    ];

    for (const input of cases) {
      const output = filter.censor(input);
      expect(output.length).toBe(input.length);
      expect(output).toBe(mask(input));
    }
  });

  it("censors zero-width built-in profanity evasions by default", () => {
    const cases = [
      "х\u200bу\u200bй",
      "п\u200bи\u200bз\u200bд\u200bа",
      "б\u200bл\u200bя",
      "з\u200bа\u200bе\u200bб\u200bа\u200bл",
    ];

    for (const input of cases) {
      const output = filter.censor(input);
      expect(output.length).toBe(input.length);
      expect(output).toBe(mask(input));
      expect(output).not.toBe(input);
      expect(output).toContain("*");
    }
  });

  it("censors stretched obscene families covered by explicit loose metadata", () => {
    const cases = [
      "запиииздячить",
      "распиииздяйство",
      "долбоооеб",
      "хуууячим",
      "захуууячить",
      "ляяять",
    ];

    for (const input of cases) {
      const output = filter.censor(input);
      expect(output.length).toBe(input.length);
      expect(output).toBe(mask(input));
    }
  });

  it("preserves reviewed loose corpus edge cases", () => {
    const cases: Array<[string, string]> = [
      ["хуей", mask("хуей")],
      ["ху-ей", mask("ху-ей")],
      ["бляд!", `${mask("бляд")}!`],
      ["блят!", `${mask("блят")}!`],
      ["б л я д ь", mask("б л я д ь")],
      ["б-л-я-т-ь", mask("б-л-я-т-ь")],
    ];

    for (const [input, expected] of cases) {
      const output = filter.censor(input);
      expect(output.length).toBe(input.length);
      expect(output).toBe(expected);
    }
  });

  it("censors common same-length homoglyph and leet variants through corpus data", () => {
    const cases = ["xyй", "пuздeц", "пи3дец", "е6 твою мать"];

    for (const input of cases) {
      const output = filter.censor(input);
      expect(output.length).toBe(input.length);
      expect(output).toContain("*");
      expect(output).not.toBe(input);
    }
  });

  it("censors mixed separator families from the regression suite", () => {
    const separators = [" ", "-", ".", "_", "/", "*"];
    for (const sep of separators) {
      const input = ["п", "и", "з", "д", "е", "ц"].join(sep);
      const out = filter.censor(input);
      expect(out.length).toBe(input.length);
      expect(out).toContain("*");
      expect(out).not.toBe(input);
    }

    const wideSepInput = ["п", "и", "з", "д", "е", "ц"].join("  ");
    const wideSepOut = filter.censor(wideSepInput);
    expect(wideSepOut.length).toBe(wideSepInput.length);
    expect(wideSepOut).toContain("*");
  });

  it("does not censor standalone nah shorthand but still censors nahuy-root variants", () => {
    const safeCases = ["нах", "пошёл нах", "иди нах"];
    for (const input of safeCases) {
      expect(filter.censor(input)).toBe(input);
    }

    const offensiveCases: Array<[string, string]> = [
      ["нахуй", "*****"],
      ["нахуя", "*****"],
      ["нах уй", "******"],
      ["пиздецнахуй", mask("пиздецнахуй")],
    ];

    for (const [input, expected] of offensiveCases) {
      const out = filter.censor(input);
      expect(out).toBe(expected);
      expect(out.length).toBe(input.length);
    }
  });

  it("respects loose token boundaries around astral letters and split words", () => {
    const loose = createProfanityFilter([], ["bad"]);

    expect(loose.censor("𐐀bad𐐀")).toBe("𐐀bad𐐀");
    expect(loose.censor("bad")).toBe("***");
    expect(loose.censor("b🙂a🙂d")).toBe("*******");
    expect(loose.censor("badminton-court")).toBe("badminton-court");
    expect(loose.censor("b-a-dminton")).toBe("b-a-dminton");
    expect(loose.censor("bad__")).toBe("*****");
    expect(filter.censor("хуй--")).toBe("*****");
    expect(filter.censor("бля текст")).toBe("*** текст");
    expect(loose.censor("bad.word")).toBe("***.word");
    const extended = createProfanityFilter([], undefined);
    extended.addLoose("пиздецок");
    expect(extended.censor("п и з д е ц о к")).toBe("***************");
    expect(
      createProfanityFilter([], ["bad\\.word"]).censor("xxbad.wordyy"),
    ).toBe("xxbad.wordyy");
    expect(createProfanityFilter([], ["bad\\.word"]).censor("bad.word")).toBe(
      "********",
    );
  });
});
