import { describe, expect, it, vi } from "vitest";
import { createEmailFilter } from "../src/index.js";
import { createEmailScanner } from "../src/scanner.js";
import { createEmailTextMeta } from "../src/normalization.js";
import { collectObfuscatedEmailRangeMatches } from "../src/scanner/matching/obfuscated.js";
import { createExclusionSets } from "../src/scanner/rules/exclusions.js";
import * as direct from "../src/scanner/matching/direct.js";

describe("email retained scanner paths", () => {
  it.each([
    ["contact user@example.com now", [[8, 24]]],
    ["contact user [at] example [dot] com", [[8, 35]]],
    ["contact user(at)example(dot)com", [[8, 31]]],
    ["contact user [@] example [.] com", [[8, 32]]],
    ["plain words only", []],
    ["", []],
    [
      "contact first@example.com and second@example.com",
      [
        [8, 25],
        [30, 48],
      ],
    ],
    [
      "user at example dot com then admin@example.org",
      [
        [0, 23],
        [29, 46],
      ],
    ],
    ["user@example.com dot org", [[0, 24]]],
    [
      "mail user@example.com, then admin [at] example [dot] org.",
      [
        [5, 21],
        [28, 56],
      ],
    ],
    ["😀 user@example.com", [[2, 18]]],
    ["😀 ﬀoo@example.com", [[3, 17]]],
  ] as const)("preserves ranges, ordering and masking: %s", (text, ranges) => {
    const scanner = createEmailScanner();
    const filter = createEmailFilter();
    expect(scanner.scan(text)).toEqual(ranges);
    expect(scanner.check(text)).toBe(ranges.length > 0);
    const points = Array.from(text);
    const matches = ranges.map(([start, end]) => ({
      start: points.slice(0, start).join("").length,
      end: points.slice(0, end).join("").length,
      value: points.slice(start, end).join(""),
      filter: "email",
    }));
    const masked = text.split("");
    for (const { start, end } of matches) masked.fill("#", start, end);
    expect(filter.find(text)).toEqual(matches);
    expect(filter.censor(text, "#")).toBe(masked.join(""));
    expect(filter.process(text, "#")).toEqual({
      matches,
      censored: masked.join(""),
    });
  });

  it("stops direct check after the first accepted candidate", () => {
    const visit = vi.spyOn(direct, "collectDirectEmailRange");
    try {
      expect(
        createEmailFilter().check("first@example.com and second@example.com"),
      ).toBe(true);
      expect(visit).toHaveBeenCalledTimes(1);
    } finally {
      visit.mockRestore();
    }
  });

  it("stops obfuscated check at its first accepted range", () => {
    const text = "user [at] example [dot] com; admin [at] example [dot] org";
    const visit = vi.fn(() => false);
    expect(
      collectObfuscatedEmailRangeMatches(
        createEmailTextMeta(text),
        {
          matchObfuscated: true,
          exclusions: createExclusionSets(),
        },
        visit,
      ),
    ).toBe(false);
    expect(visit.mock.calls).toEqual([[[0, 27]]]);
    expect(createEmailScanner().scan(text)).toEqual([
      [0, 27],
      [29, 57],
    ]);
  });

  it("preserves obfuscation options and each allowlist", () => {
    expect(
      createEmailScanner({ matchObfuscated: false }).scan(
        "contact user at example dot com",
      ),
    ).toEqual([]);
    for (const options of [
      { allowedEmails: ["user@example.com"] },
      { allowedUsernames: ["user"] },
      { allowedDomains: ["example.com"] },
    ]) {
      const scanner = createEmailScanner(options);
      expect(scanner.scan("contact user@example.com")).toEqual([]);
      expect(scanner.check("contact user@example.com")).toBe(false);
    }
  });
});
