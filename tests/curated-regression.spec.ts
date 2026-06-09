import { describe, expect, it } from "vitest";

import { filter } from "../src/index.js";

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
      "бляха-муха",
      "херня, но не мат",
      "ебург как сокращение",
      "х у л и г а н",
    ];

    for (const input of cases) {
      expect(filter.censor(input)).toBe(input);
    }
  });
});
