import { describe, expect, it, vi } from "vitest";

import { combineFilters, type TextFilter } from "../src/index.js";

const createFilter = (
  name: string,
  find: TextFilter["find"],
  check: TextFilter["check"] = (text) => find(text).length > 0,
): TextFilter => ({
  name,
  check,
  find,
  censor: () => {
    throw new Error("child censor must not run");
  },
  process: () => {
    throw new Error("child process must not run");
  },
});

describe("combineFilters", () => {
  it("is an identity filter for an empty child list", () => {
    const combined = combineFilters();

    expect(combined.name).toBe("combined");
    expect(combined.check("value")).toBe(false);
    expect(combined.find("value")).toEqual([]);
    expect(combined.censor("value")).toBe("value");
    expect(combined.process("value")).toEqual({
      censored: "value",
      matches: [],
    });
  });

  it("runs children against one original input and keeps overlapping matches", () => {
    const seen: string[] = [];
    const first = createFilter("first", (text) => {
      seen.push(text);
      return [{ start: 0, end: 4, value: text.slice(0, 4), filter: "first" }];
    });
    const second = createFilter("second", (text) => {
      seen.push(text);
      return [
        {
          start: 2,
          end: 6,
          value: text.slice(2, 6),
          filter: "second",
          data: { source: "child" },
        },
      ];
    });

    const result = combineFilters(second, first).process("abcdef");

    expect(seen).toEqual(["abcdef", "abcdef"]);
    expect(result.censored).toBe("******");
    expect(result.matches).toEqual([
      { start: 0, end: 4, value: "abcd", filter: "first" },
      {
        start: 2,
        end: 6,
        value: "cdef",
        filter: "second",
        data: { source: "child" },
      },
    ]);
  });

  it("orders matches by start, end, and filter", () => {
    const combined = combineFilters(
      createFilter("z", () => [{ start: 1, end: 3, value: "bc", filter: "z" }]),
      createFilter("a", () => [
        { start: 1, end: 3, value: "bc", filter: "a" },
        { start: 1, end: 2, value: "b", filter: "a" },
        { start: 0, end: 1, value: "a", filter: "a" },
      ]),
    );

    expect(
      combined
        .find("abc")
        .map(({ filter, start, end }) => [filter, start, end]),
    ).toEqual([
      ["a", 0, 1],
      ["a", 1, 2],
      ["a", 1, 3],
      ["z", 1, 3],
    ]);
  });

  it("short-circuits check and scans each child once during process", () => {
    const firstCheck = vi.fn(() => true);
    const laterCheck = vi.fn(() => false);
    const firstFind = vi.fn(() => []);
    const laterFind = vi.fn(() => []);
    const combined = combineFilters(
      createFilter("first", firstFind, firstCheck),
      createFilter("later", laterFind, laterCheck),
    );

    expect(combined.check("value")).toBe(true);
    expect(laterCheck).not.toHaveBeenCalled();

    combined.process("value");
    expect(firstFind).toHaveBeenCalledTimes(1);
    expect(laterFind).toHaveBeenCalledTimes(1);
  });

  it("supports custom masks and rejects non-string input", () => {
    const combined = combineFilters(
      createFilter("child", (text) => [
        { start: 0, end: text.length, value: text, filter: "child" },
      ]),
    );
    const unsafe = combined as unknown as Record<
      "check" | "find" | "censor" | "process",
      (value: unknown) => unknown
    >;

    expect(combined.censor("value", "#")).toBe("#####");
    for (const method of ["check", "find", "censor", "process"] as const) {
      expect(() => unsafe[method](null)).toThrow("text must be a string");
    }
  });
});
