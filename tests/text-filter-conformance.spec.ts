import { describe, expect, it } from "vitest";

import {
  combineFilters,
  type TextFilter,
  type TextMatch,
} from "@textfilters/core";
import { filter as email } from "@textfilters/email";
import { filter as phone } from "@textfilters/phone";
import { createProfanityFilter } from "@textfilters/profanity";
import english from "@textfilters/profanity-en";
import { filter as url } from "@textfilters/url";

const profanity = createProfanityFilter(english);
const combined = combineFilters(url, email, phone, profanity);

const cases = [
  { expectedName: "url", filter: url, text: "😀 https://example.com tail" },
  {
    expectedName: "email",
    filter: email,
    text: "😀 user@example.com tail",
  },
  {
    expectedName: "phone",
    filter: phone,
    text: "😀 +1 202 555 0187 tail",
  },
  { expectedName: "profanity", filter: profanity, text: "😀 shit" },
  {
    expectedName: "combined",
    filter: combined,
    text: "😀 user@example.com, https://example.com, +1 202 555 0187, shit",
  },
] as const;

describe.each(cases)("$expectedName TextFilter conformance", (testCase) => {
  const { expectedName, filter, text } = testCase;

  it("has the expected non-empty name", () => {
    expect(filter.name).toBe(expectedName);
    expect(filter.name.length).toBeGreaterThan(0);
  });

  it("accepts strings only for every text method", () => {
    const unsafe = filter as unknown as Record<
      "check" | "find" | "censor" | "process",
      (value: unknown) => unknown
    >;

    for (const value of [null, undefined, 1, {}, Symbol("text")]) {
      expect(() => unsafe.check(value)).toThrow(TypeError);
      expect(() => unsafe.find(value)).toThrow(TypeError);
      expect(() => unsafe.censor(value)).toThrow(TypeError);
      expect(() => unsafe.process(value)).toThrow(TypeError);
    }
  });

  it("keeps check, find, process, and censor consistent", () => {
    const matches = filter.find(text);
    const processed = filter.process(text);

    expect(filter.check(text)).toBe(matches.length > 0);
    expect(processed.matches).toEqual(matches);
    expect(processed.censored).toBe(filter.censor(text));
  });

  it("returns ordered UTF-16 source matches", () => {
    const matches = filter.find(text);

    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(Number.isInteger(match.start)).toBe(true);
      expect(Number.isInteger(match.end)).toBe(true);
      expect(match.start).toBeGreaterThanOrEqual(0);
      expect(match.end).toBeGreaterThan(match.start);
      expect(match.end).toBeLessThanOrEqual(text.length);
      expect(match.value).toBe(text.slice(match.start, match.end));
    }
    expect([...matches].sort(compareMatches)).toEqual(matches);
  });

  it("preserves UTF-16 length and nearby astral symbols", () => {
    const censored = filter.censor(text);

    expect(censored.length).toBe(text.length);
    expect(censored.slice(0, 2)).toBe("😀");
    expect(Array.from(censored)[0]).toBe("😀");
  });

  it("applies default and custom masking consistently", () => {
    const censored = filter.censor(text);
    const custom = filter.censor(text, "#");

    expect(filter.censor(censored)).toBe(censored);
    expect(filter.process(text, "#").censored).toBe(custom);
    expect(custom.length).toBe(text.length);
  });

  it("treats empty input as clean identity text", () => {
    expect(filter.check("")).toBe(false);
    expect(filter.find("")).toEqual([]);
    expect(filter.censor("")).toBe("");
    expect(filter.process("")).toEqual({ censored: "", matches: [] });
  });
});

describe("combineFilters conformance", () => {
  it("runs every child against the same original input", () => {
    const seen: string[] = [];
    const makeFilter = (name: string): TextFilter => ({
      name,
      check: (text) => {
        seen.push(text);
        return false;
      },
      find: (text) => {
        seen.push(text);
        return [];
      },
      censor: (text) => text,
      process: (text) => ({ censored: text, matches: [] }),
    });
    const source = "original input";
    const filter = combineFilters(makeFilter("a"), makeFilter("b"));

    expect(filter.check(source)).toBe(false);
    expect(seen).toEqual([source, source]);
    seen.length = 0;
    expect(filter.find(source)).toEqual([]);
    expect(seen).toEqual([source, source]);
  });

  it("stops check at the first positive child", () => {
    const calls: string[] = [];
    const makeFilter = (name: string, result: boolean): TextFilter => ({
      name,
      check: () => {
        calls.push(name);
        return result;
      },
      find: () => [],
      censor: (text) => text,
      process: (text) => ({ censored: text, matches: [] }),
    });

    expect(
      combineFilters(
        makeFilter("first", false),
        makeFilter("second", true),
        makeFilter("third", true),
      ).check("text"),
    ).toBe(true);
    expect(calls).toEqual(["first", "second"]);
  });

  it("keeps overlapping matches and metadata while masking once", () => {
    const source = "abcdef";
    const firstMatch = {
      start: 1,
      end: 4,
      value: "bcd",
      filter: "first",
      data: { source: 1 },
    } as const;
    const secondMatch = {
      start: 3,
      end: 6,
      value: "def",
      filter: "second",
      data: { source: 2 },
    } as const;
    const makeFilter = (match: TextMatch): TextFilter => ({
      name: match.filter,
      check: () => true,
      find: () => [match],
      censor: () => {
        throw new Error("combined masking must not call child censor");
      },
      process: () => {
        throw new Error("combined masking must not call child process");
      },
    });
    const filter = combineFilters(
      makeFilter(secondMatch),
      makeFilter(firstMatch),
    );

    expect(filter.find(source)).toEqual([firstMatch, secondMatch]);
    expect(filter.process(source)).toEqual({
      censored: "a*****",
      matches: [firstMatch, secondMatch],
    });
  });

  it("is an identity filter when no children are provided", () => {
    const filter = combineFilters();

    expect(filter.name).toBe("combined");
    expect(filter.check("text")).toBe(false);
    expect(filter.find("text")).toEqual([]);
    expect(filter.censor("text")).toBe("text");
    expect(filter.process("text")).toEqual({
      censored: "text",
      matches: [],
    });
  });
});

function compareMatches(left: TextMatch, right: TextMatch): number {
  return (
    left.start - right.start ||
    left.end - right.end ||
    left.filter.localeCompare(right.filter)
  );
}
