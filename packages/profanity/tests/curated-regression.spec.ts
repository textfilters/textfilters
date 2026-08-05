import { describe, expect, it } from "vitest";

import { filter } from "../src";

const mask = (value: string): string => "*".repeat(value.length);

describe("@textfilters/profanity curated regressions", () => {
  it("masks accepted obscene-root cases from the shared filter corpus", () => {
    const cases: Array<[string, string]> = [
      ["какой-то хуйня-фикс", "какой-то *****-фикс"],
      ["хуевый кейс", "****** кейс"],
      ["пиииздец", mask("пиииздец")],
      ["объебали лимит", "******** лимит"],
      ["обьебали лимит", "******** лимит"],
      ["прихуел с diff", "******* с diff"],
      ["прихуели от CI", "******** от CI"],
      ["запиздячить patch", "*********** patch"],
      ["распиздяйство в коде", "************* в коде"],
      ["хуета какая-то", "***** какая-то"],
      ["хуяк-хуяк и в prod", "********* и в prod"],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input)).toBe(expected);
    }
  });

  it("masks invisible and spacing evasion cases", () => {
    const cases: Array<[string, string]> = [
      ["е\u200dбаный тест", "******* тест"],
      ["п\u200dиздец", "*******"],
      ["х\u200dуйня", "******"],
      ["н\u200bа\u200bх\u200bу\u200bй", "*********"],
      ["п\u00a0и\u00a0з\u00a0д\u00a0е\u00a0ц", "***********"],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input)).toBe(expected);
    }
  });

  it("keeps accepted low-risk false-positive locks unchanged", () => {
    const cases = [
      "блян",
      "бляха-муха",
      "херес, но не мат",
      "ебург как сокращение",
      "х у л и г а н",
      "пиксебатл",
    ];

    for (const input of cases) {
      expect(filter.censor(input)).toBe(input);
    }
  });

  it("masks the short blya token at punctuation boundaries", () => {
    const cases: Array<[string, string]> = [
      ["Бля", "***"],
      ["бля", "***"],
      ["Бля!", "***!"],
      ["(бля)", "(***)"],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input)).toBe(expected);
    }
  });

  it("keeps source ranges and metadata on the matched token only", () => {
    const input = "последняя ёбля";
    const matches = filter.analyze(input);

    expect(
      matches.map((match) => ({
        start: match[0],
        end: match[1],
        text: input.slice(match[0], match[1]),
        mode: match.mode,
        ruleId: match.ruleId,
        category: match.category,
        severity: match.severity,
      })),
    ).toEqual([
      {
        start: 10,
        end: 14,
        text: "ёбля",
        mode: "strict",
        ruleId: "ru.obscene.eblya",
        category: "OBSCENE_MAT",
        severity: "high",
      },
      {
        start: 10,
        end: 14,
        text: "ёбля",
        mode: "loose",
        ruleId: "ru.obscene.eblya",
        category: "OBSCENE_MAT",
        severity: "high",
      },
    ]);

    const censored = filter.censor(input);
    expect(censored).toBe("последняя ****");
    expect(censored.length).toBe(input.length);

    const astralInput = `🚀 ${input}`;
    expect(
      filter.analyze(astralInput).map((match) => ({
        start: match[0],
        end: match[1],
        text: astralInput.slice(match[0], match[1]),
        mode: match.mode,
      })),
    ).toEqual([
      { start: 13, end: 17, text: "ёбля", mode: "strict" },
      { start: 13, end: 17, text: "ёбля", mode: "loose" },
    ]);
    const astralCensored = filter.censor(astralInput);
    expect(astralCensored).toBe("🚀 последняя ****");
    expect(astralCensored.length).toBe(astralInput.length);
  });
});
