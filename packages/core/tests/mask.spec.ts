import { describe, expect, it } from "vitest";

import { maskTextRanges } from "../src/index.js";

describe("maskTextRanges", () => {
  it("merges, clamps, and masks UTF-16 ranges once", () => {
    expect(
      maskTextRanges("abcdef", [
        [4, 20],
        [1, 3],
        [2, 5],
        [5, 5],
        [9, 1],
      ]),
    ).toBe("a*****");
  });

  it("preserves UTF-16 length and surrogate-pair boundaries", () => {
    const source = "a😀z";

    expect(maskTextRanges(source, [[1, 3]])).toBe("a**z");
    expect(maskTextRanges(source, [[2, 3]], "#")).toBe("a##z");
    expect(maskTextRanges(source, [[1, 2]], "#")).toBe("a##z");
    expect(maskTextRanges(source, [[1, 3]]).length).toBe(source.length);
  });

  it("uses one BMP code unit and safely ignores unusable ranges", () => {
    expect(maskTextRanges("value", [[0, 2]], "#")).toBe("##lue");
    expect(maskTextRanges("value", [[0, 2]], "")).toBe("**lue");
    expect(maskTextRanges("value", [[0, 2]], "😀")).toBe("**lue");
    expect(maskTextRanges("value", [[Number.NaN, 2]])).toBe("value");
    expect(maskTextRanges("value", [])).toBe("value");
  });

  it("rejects non-string text", () => {
    const unsafe = maskTextRanges as unknown as (
      value: unknown,
      ranges: readonly (readonly [number, number])[],
    ) => string;

    expect(() => unsafe(null, [])).toThrow("text must be a string");
  });
});
