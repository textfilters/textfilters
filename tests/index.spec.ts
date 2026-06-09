import { describe, expect, it } from "vitest";

import {
  createProfanityFilter,
  filter,
  PROFANITY_FILTER_NAME,
  profanityFilter,
} from "../src/index.js";

const mask = (value: string): string => "*".repeat(value.length);

describe("compatibility behavior", () => {
  it("exposes the default instance and the compatible factory alias", () => {
    expect(filter.name).toBe(PROFANITY_FILTER_NAME);
    expect(profanityFilter(["fff"], []).censor("fff ggg")).toBe("*** ggg");
  });

  it("censors strict profanities by whole token length", () => {
    expect(filter.censor("привет блядь!")).toBe("привет *****!");
    expect(filter.censor("привет блять!")).toBe("привет *****!");
  });

  it("handles latin homoglyphs and fullwidth ASCII in strict matching", () => {
    expect(filter.censor("Ебaть смешно")).toBe("***** смешно");
    expect(filter.censor("Bыеб")).toBe("****");
    expect(filter.censor("mудак")).toBe("*****");
    expect(filter.censor("hахуй")).toBe("*****");
    expect(filter.censor("блядb")).toBe("*****");
    expect(filter.censor("xуй")).toBe("***");
    expect(filter.censor("пиздeц")).toBe("******");
    expect(filter.censor("eбaть")).toBe("*****");
    expect(filter.censor("ｅбать")).toBe("*****");
    expect(filter.censor("Oxyeть")).toBe("******");
  });

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

  it("keeps current false-positive locks untouched", () => {
    const neutral = [
      "blender",
      "bleyanie",
      "блеяние",
      "блян",
      "удалять",
      "хулиган",
      "Хулио",
      "х у л и г а н",
      "х у л и о",
      "нахер",
      "страхуеть",
      "ахуетька",
      "ахуетье",
      "похерил",
      "тикитоке батов",
      "небанальный",
      "ебург как сокращение",
      "хлеб",
      "лебедь",
      "пиксебатл",
      "съесть",
      "съемка",
      "вьетнам",
      "отъезд",
      "план",
      "бланк",
      "долбить",
    ];

    for (const input of neutral) {
      expect(filter.censor(input)).toBe(input);
    }
  });

  it("keeps the current RU profanity corpus behavior", () => {
    const cases: Array<[string, string]> = [
      ["пизд", "****"],
      ["пизде", "*****"],
      ["пизды", "*****"],
      ["пиииздец", mask("пиииздец")],
      ["п-и-и-з-д-е-ц", mask("п-и-и-з-д-е-ц")],
      ["п-и-и-з-д-е-е-е-ц", mask("п-и-и-з-д-е-е-е-ц")],
      ["п и и з д е ц", mask("п и и з д е ц")],
      ["п и з д е е ц", mask("п и з д е е ц")],
      ["хуе", "***"],
      ["хуй", "***"],
      ["хуя", "***"],
      ["хуи", "***"],
      ["хую", "***"],
      ["хуесос", "******"],
      ["ахуеть", "******"],
      ["а-х-у-е-т-ь", "***********"],
      ["ебу", "***"],
      ["не ебу", "не ***"],
      ["я ебу", "я ***"],
      ["ебал", "****"],
      ["ебали", "*****"],
      ["ебало", "*****"],
      ["ебут", "****"],
      ["ебем", "****"],
      ["ебешь", "*****"],
      ["ебете", "*****"],
      ["ебись", "*****"],
      ["ёбну", "****"],
      ["ебнуть", "******"],
      ["ебнулся", "*******"],
      ["хитровыебанный", mask("хитровыебанный")],
      ["хитровыебаный", mask("хитровыебаный")],
      ["хитро выебанный", `хитро ${mask("выебанный")}`],
      ["объебали", mask("объебали")],
      ["обьебали", mask("обьебали")],
      ["съебал", "******"],
      ["сьебал", "******"],
      ["съебывай", "********"],
      ["сьебывай", "********"],
      ["въебал", "******"],
      ["вьебал", "******"],
      ["отъебись", "********"],
      ["отьебись", "********"],
      ["ёб твою мать", mask("ёб твою мать")],
      ["еб твою мать", mask("еб твою мать")],
      ["е6 твою мать", mask("е6 твою мать")],
      ["eб твою мать", mask("eб твою мать")],
      ["ёбтвоюмать", mask("ёбтвоюмать")],
      ["ебтвоюмать", mask("ебтвоюмать")],
      ["ёбля", "****"],
      ["хуевый", mask("хуевый")],
      ["охуительно", mask("охуительно")],
      ["прихуел", mask("прихуел")],
      ["прихуели", mask("прихуели")],
      ["ебливая", mask("ебливая")],
      ["ебливый", mask("ебливый")],
      ["ты еблан", "ты *****"],
      ["я не еблан", "я не *****"],
      ["долбаеб", mask("долбаеб")],
      ["долбаёб", mask("долбаёб")],
      ["долбаебы", mask("долбаебы")],
      ["долбаёбище", mask("долбаёбище")],
      ["долбоеб", mask("долбоеб")],
      ["долбоёб", mask("долбоёб")],
      ["лять", "****"],
      ["пиздееец", "********"],
      ["п и д о р", mask("п и д о р")],
      ["е б а н ы й", mask("е б а н ы й")],
      ["х у й н я", mask("х у й н я")],
      ["о х у е т ь", mask("о х у е т ь")],
      ["ху-ей", "*****"],
      ["хуйня-фикс", "*****-фикс"],
      ["схуйня-фикс", "схуйня-фикс"],
      ["запиздячить", mask("запиздячить")],
      ["запuздячить", mask("запuздячить")],
      ["распиздяйство", mask("распиздяйство")],
      ["распuздяйство", mask("распuздяйство")],
      ["распи3дяйство", mask("распи3дяйство")],
      ["хуета", mask("хуета")],
      ["хуeта", mask("хуeта")],
      ["xуета", mask("xуета")],
      ["хyета", mask("хyета")],
      ["хуетень", mask("хуетень")],
      ["ни хуя", "ни ***"],
      ["нихуя", mask("нихуя")],
      ["ниxуя", mask("ниxуя")],
      ["нuхуя", mask("нuхуя")],
      ["н и х у я", mask("н и х у я")],
      ["н.и.х.у.я", mask("н.и.х.у.я")],
      ["н  и  х  у  я", mask("*************")],
      ["н..и..х..у..я", mask("*************")],
      ["н--и--х--у--я", mask("*************")],
      ["н__и__х__у__я", mask("*************")],
      ["н/u/х/у/я", mask("*********")],
      ["н u х у я", mask("*********")],
      ["н.u.х.у.я", mask("*********")],
      ["хуяк-хуяк", mask("хуяк-хуяк")],
      ["хуякнул", mask("хуякнул")],
      ["охуячить", mask("охуячить")],
      ["захуячить", mask("захуячить")],
      ["перехуячить", mask("перехуячить")],
      ["отхуячить", mask("отхуячить")],
      ["обхуячить", mask("обхуячить")],
      ["хуячим", mask("хуячим")],
      ["ну хуячим", `ну ${mask("хуячим")}`],
      ["(хуячим", `(${mask("хуячим")}`],
      ["хyячим", mask("хyячим")],
      ["xyячим", mask("xyячим")],
      ["раз*ебали", mask("раз*ебали")],
      ["раз-е-ба-ли", mask("раз-е-ба-ли")],
      ["пиздецнахуй", mask("пиздецнахуй")],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input), input).toBe(expected);
    }
  });

  it("trims neutral hyphen tails without exposing profane tails", () => {
    const cases: Array<[string, string]> = [
      ["хуйня-фикс", "*****-фикс"],
      ["хуйня-модуль", "*****-модуль"],
      ["хуйня-fix", "*****-fix"],
      ["хуйня-123", "*****-123"],
      ["х-у-й-н-я-фикс", "*********-фикс"],
      ["х у й н я-фикс", "*********-фикс"],
      ["хуйня-хуй", mask("*****-***")],
      ["хуйня-пиздец", mask("*****-******")],
      ["хуйня-п-и-з-д-е-ц", mask("*****-***********")],
      ["хуйня-нихуя", mask("*****-*****")],
      ["хуйня-ниxуя", mask("*****-*****")],
      ["хуйня-нuхуя", mask("*****-*****")],
      ["хуйня-нихуя-фикс", "***********-фикс"],
      ["хуйня-фикс-хуй", mask("*****-****-***")],
      ["хуйня-фикс-пиздец", mask("*****-****-******")],
      ["хуйня-фикс-п-и-з-д-е-ц", mask("*****-****-***********")],
      ["хуйня-х у й-фикс", "***********-фикс"],
      ["хуйня-п и з д е ц-фикс", "*****************-фикс"],
      ["хуйня-п.и.з.д.е.ц", mask("*****-***********")],
      ["хуйня-х.у.й", mask("*****-*****")],
      ["хуйня-еб твою мать", mask("*****-** **** ****")],
      ["хуйня-е6 твою мать", mask("*****-** **** ****")],
      [
        `хуйня-е6${" ".repeat(56)}твою мать`,
        mask(`хуйня-е6${" ".repeat(56)}твою мать`),
      ],
      ["хуйня-ёб твою мать", mask("*****-** **** ****")],
      ["хуйня-eб твою мать", mask("*****-** **** ****")],
      ["хуйня-ебтвоюмать", mask("*****-**********")],
      ["хуйня-хлеб", "*****-хлеб"],
      ["хуйня-пиксебатл", "*****-пиксебатл"],
      ["хуйня-ебург", "*****-ебург"],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input), input).toBe(expected);
    }
  });

  it("preserves current user repro behavior", () => {
    const cases: Array<[string, string]> = [
      [
        "даунка ебливая хуйня стараясаагвымими о",
        `даунка ${mask("ебливая")} ${mask("хуйня")} стараясаагвымими о`,
      ],
      ["какой же хуесос этот чел", `какой же ${mask("хуесос")} этот чел`],
      [
        "правда не знаю нахуя мне это нужно",
        "правда не знаю ***** мне это нужно",
      ],
      ["хуй блять пизда", "*** ***** *****"],
      [
        "Это не первая и не последняя ёбля, никто не остановит нас",
        "Это не первая и не последняя ****, никто не остановит нас",
      ],
      [
        "если был то это ИТД или пиксебатл реддита",
        "если был то это ИТД или пиксебатл реддита",
      ],
      ["Зачем удалять блоки из теста", "Зачем удалять блоки из теста"],
      ["бляха-муха", "бляха-муха"],
      ["Сукс2 на x4485", "Сукс2 на x4485"],
      ["Сукс2 на x4485 y6125", "Сукс2 на x4485 y6125"],
      ["Ну это, пи здец... хуй!", "Ну это, *******... ***!"],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input)).toBe(expected);
      expect(filter.censor(input).length).toBe(input.length);
    }
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

  it("preserves length, code points around emoji, multiline text, and idempotency", () => {
    const samples = [
      "первая строка\nпиздец тут\nтретья строка хуй",
      "🙂 пиздец 🔥 и хуй ✅",
      "пи\u200Bздец",
      `${"a".repeat(5000)} п и з д е ц ${"b".repeat(5000)}`,
      "обычный текст",
      "eбaть, xуй, blender",
    ];

    for (const input of samples) {
      const once = filter.censor(input);
      expect(once.length).toBe(input.length);
      expect(filter.censor(once)).toBe(once);
    }

    expect(filter.censor("🙂 пиздец 🔥 и хуй ✅")).toBe(
      "🙂 ****** 🔥 и *** ✅",
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

describe("public package improvements", () => {
  it("exposes a stable filter name and check helper", () => {
    expect(filter.name).toBe(PROFANITY_FILTER_NAME);
    expect(filter.check("привет блядь")).toBe(true);
    expect(filter.check("привет")).toBe(false);
  });

  it("uses built-in dictionaries for the default factory instance", () => {
    expect(createProfanityFilter().censor("привет блядь")).toBe("привет *****");
  });

  it("treats runtime terms as normalized literals, not regular expressions", () => {
    expect(createProfanityFilter(["ёлка"], []).censor("елка")).toBe("****");
    expect(createProfanityFilter(["foo\\.bar"], []).censor("foo.bar")).toBe(
      "*******",
    );
    expect(createProfanityFilter(["foo|bar"], []).censor("bar")).toBe("bar");
    expect(createProfanityFilter(["foo|bar"], []).censor("foo|bar")).toBe(
      "*******",
    );
    expect(createProfanityFilter(["[^\\W]oo"], []).censor("boo")).toBe("boo");
    expect(
      createProfanityFilter(["[^\\P{Script=Latin}]oo"], []).censor("boo"),
    ).toBe("boo");
    expect(createProfanityFilter(["[ｂ]oo"], []).censor("boo")).toBe("boo");
    expect(createProfanityFilter(["[ｂ]oo"], []).censor("ｂoo")).toBe("ｂoo");
    expect(createProfanityFilter(["ｂoo"], []).censor("ｂoo")).toBe("***");
    expect(createProfanityFilter(["[ａ-ｚ]ёлка"], []).censor("ｂелка")).toBe(
      "ｂелка",
    );
    expect(createProfanityFilter([], ["[.a]bad"]).censor(". b a d")).toBe(
      ". b a d",
    );
  });

  it("keeps runtime regex-like terms safe because they are literals", () => {
    const f = createProfanityFilter(["a?"], ["(?=a)"]);
    f.addStrict("(");
    f.addStrict(".");
    f.addStrict("!!");
    f.addStrict("!! !!");
    f.addLoose("[.a]bad");

    expect(f.censor("a")).toBe("a");
    expect(f.censor("a?")).toBe("**");
    expect(
      createProfanityFilter(["_bad", "-bad"], []).censor("_bad -bad"),
    ).toBe("**** ****");
    expect(f.censor("(")).toBe("*");
    expect(f.censor("...")).toBe("***");
    expect(f.censor("!!")).toBe("**");
    expect(f.censor("!! !!")).toBe("*****");
    expect(createProfanityFilter(["foo\\/bar"], []).censor("foo/bar")).toBe(
      "*******",
    );
    expect(f.censor(". b a d")).toBe("* b a d");
    expect(createProfanityFilter([], ["!!"]).censor("!!")).toBe("**");
    expect(createProfanityFilter([], ["!"]).censor("!")).toBe("*");
    expect(createProfanityFilter([], ["(?=𐐀)", "𐐀"]).censor("𐐀")).toBe("**");
  });

  it("preserves UTF-16 length for astral strict and loose tokens", () => {
    expect(createProfanityFilter(["𐐀"], []).censor("𐐀")).toBe("**");
    expect(createProfanityFilter([], ["𐐀"]).censor("𐐀")).toBe("**");
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
