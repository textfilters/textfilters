import { describe, expect, it } from "vitest";
import {
  censorCodePointRanges,
  maskCodePointRanges,
  maskCodePointRangesPreservingLength,
  maskRange,
  maskRanges,
} from "../src/index.js";

describe("textfilters core code point helpers", () => {
  it("masks ranges without splitting surrogate pairs", () => {
    expect(maskRange("a😀z", [1, 2])).toBe("a*z");
  });

  it("masks code point index ranges", () => {
    expect(maskCodePointRanges(Array.from("a😀z"), [[1, 2]])).toBe("a*z");
    expect(maskCodePointRanges(Array.from("abc"), [[0.5, 2.5]])).toBe("**c");
    expect(maskCodePointRanges(Array.from("abc"), [[0, 2]], "")).toBe("**c");
    expect(maskCodePointRanges(Array.from("abc"), [[0, 2]], "##")).toBe("##c");
  });

  it("keeps existing code point masking behavior stable for astral input", () => {
    const source = "a😀z";
    const masked = maskCodePointRanges(Array.from(source), [[1, 2]]);

    expect(masked).toBe("a*z");
    expect(masked.length).toBe(3);
  });

  it("masks code point ranges while preserving UTF-16 length", () => {
    const source = "a😀z";
    const masked = maskCodePointRangesPreservingLength(Array.from(source), [
      [1, 2],
    ]);

    expect(masked).toBe("a**z");
    expect(masked.length).toBe(source.length);
  });

  it("censors code point ranges while preserving UTF-16 length", () => {
    const source = "a😀z";
    const censored = censorCodePointRanges(Array.from(source), [[1, 2]]);

    expect(censored).toBe("a**z");
    expect(censored.length).toBe(source.length);
  });

  it("keeps source text unchanged when censoring empty code point ranges", () => {
    expect(censorCodePointRanges(Array.from("clean"), [])).toBe("clean");
  });

  it("supports custom masks for code point range censoring", () => {
    expect(censorCodePointRanges(Array.from("a😀z"), [[1, 2]], "#")).toBe(
      "a##z",
    );
    expect(censorCodePointRanges(Array.from("abc"), [[0, 2]], "😀")).toBe(
      "**c",
    );
  });

  it("supports BMP custom masks for length-preserving code point masking", () => {
    expect(
      maskCodePointRangesPreservingLength(Array.from("a😀z"), [[1, 2]], "#"),
    ).toBe("a##z");
    expect(
      maskCodePointRangesPreservingLength(Array.from("abc"), [[0, 2]], "#"),
    ).toBe("##c");
  });

  it("keeps length-preserving masking stable for empty and astral mask chars", () => {
    const codePoints = Array.from("a😀z");

    expect(maskCodePointRangesPreservingLength(codePoints, [[1, 2]], "")).toBe(
      "a**z",
    );
    expect(
      maskCodePointRangesPreservingLength(codePoints, [[0, 2]], "😀"),
    ).toBe("***z");
  });

  it("handles empty, invalid, clamped, and overlapping length-preserving ranges", () => {
    expect(maskCodePointRangesPreservingLength(Array.from("value"), [])).toBe(
      "value",
    );
    expect(
      maskCodePointRangesPreservingLength(Array.from("abcdef"), [
        [4, 6],
        [1, 3],
        [2, 5],
        [5, 5],
        [9, 1],
      ]),
    ).toBe("a*****");
    expect(
      maskCodePointRangesPreservingLength(Array.from("a😀z"), [
        [-10, 2],
        [10, 12],
      ]),
    ).toBe("***z");
  });
});

describe("textfilters core UTF-16 masking helpers", () => {
  it("masks merged ranges in one pass", () => {
    expect(
      maskRanges("call me now", [
        [0, 4],
        [5, 7],
      ]),
    ).toBe("**** ** now");
  });

  it("masks ranges while preserving surrounding text", () => {
    expect(maskRanges("hello world", [[6, 11]])).toBe("hello *****");
    expect(maskRanges("a😀b", [[1, 2]], "#")).toBe("a#b");
    expect(maskRanges("a😀b", [[3, 4]], "#")).toBe("a😀#");
    expect(maskRanges("a😀b", [[2, 3]], "#")).toBe("a#b");
  });

  it("clamps ranges to text boundaries", () => {
    expect(maskRanges("abc", [[-10, 2]])).toBe("**c");
    expect(maskRanges("abc", [[1, 10]])).toBe("a**");
  });

  it("keeps text unchanged for empty inputs, empty masks, and empty ranges", () => {
    expect(maskRanges("", [[0, 1]])).toBe("");
    expect(maskRanges("value", [])).toBe("value");
  });

  it("normalizes empty mask char to the default mask", () => {
    expect(maskRanges("value", [[0, 2]], "")).toBe("**lue");
    expect(maskRanges("value", [])).toBe("value");
  });
});
