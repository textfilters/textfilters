import { describe, expect, it } from "vitest";

import { filter } from "../src/index.js";

const mask = (value: string): string => "*".repeat(value.length);

describe("@textfilters/email curated regressions", () => {
  it("masks direct and obfuscated addresses from the shared filter corpus", () => {
    const cases: Array<[string, string]> = [
      ["test@example.com", mask("test@example.com")],
      ["a.b+c_d-1@sub.domain.co.uk", mask("a.b+c_d-1@sub.domain.co.uk")],
      ["Пиши на admin@example.com", `Пиши на ${mask("admin@example.com")}`],
      ["<dev@site.com>", `<${mask("dev@site.com")}>`],
      ["(dev@site.com)", `(${mask("dev@site.com")})`],
      ["[dev@site.com]", `[${mask("dev@site.com")}]`],
      ["dev@site.com.", `${mask("dev@site.com")}.`],
      ["dev @ site . com", mask("dev @ site . com")],
      ["dev(at)site(dot)com", mask("dev(at)site(dot)com")],
      ["dev [at] site [dot] com", mask("dev [at] site [dot] com")],
      ["name at domain dot org", mask("name at domain dot org")],
      ["a@b.cd", mask("a@b.cd")],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input)).toBe(expected);
    }
  });

  it("keeps current false-positive locks from the shared filter corpus", () => {
    const cases = [
      "root@localhost",
      "login@@domain.com",
      "login@domain",
      "login@domain.",
      "login@domain.c",
      "login@sub_domain.com",
      "dev собака site точка com",
      "dev-собака-site-точка-ru",
      "john.smith at example dot com",
    ];

    for (const input of cases) {
      expect(filter.censor(input)).toBe(input);
    }
  });
});
