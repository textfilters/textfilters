import { describe, expect, it } from "vitest";

import { filter } from "../src/index.js";

const mask = (value: string): string => "*".repeat(value.length);

describe("@textfilters/url curated regressions", () => {
  it("masks accepted URL forms from the shared filter corpus", () => {
    const cases: Array<[string, string]> = [
      ["https://example.com", mask("https://example.com")],
      ["sub.domain.co.uk/path", mask("sub.domain.co.uk/path")],
      ["bit.ly/abc123", mask("bit.ly/abc123")],
      ["goo.gl/test", mask("goo.gl/test")],
      ["пример.рф", mask("пример.рф")],
      ["https://пример.рф/путь", mask("https://пример.рф/путь")],
      ["site dot com", mask("site dot com")],
      ["site[.]com", mask("site[.]com")],
      ["hxxps://example[.]com", mask("hxxps://example[.]com")],
      ["http : // example . com", mask("http : // example . com")],
      ["https[:]//example[.]com", mask("https[:]//example[.]com")],
      ["https://example.com.", `${mask("https://example.com")}.`],
    ];

    for (const [input, expected] of cases) {
      expect(filter.censor(input)).toBe(expected);
    }
  });

  it("keeps unknown bare domains and prose locks unchanged", () => {
    const cases = [
      "example.unknown/path",
      "the dotcom bubble",
      "hello dotnet now",
      "not dotorg",
    ];

    for (const input of cases) {
      expect(filter.censor(input)).toBe(input);
    }
  });
});
