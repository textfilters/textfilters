import { describe, expect, it } from "vitest";
import {
  lowerNfkc,
  normalizeLengthPreservingMaskChar,
  normalizeMaskChar,
  normalizeTextInput,
  normalizeVisibleMaskChar,
  stripZeroWidth,
  toCodePoints,
} from "../src/index.js";

describe("textfilters core normalization helpers", () => {
  it("normalizes public text input from unknown values", () => {
    expect(normalizeTextInput("")).toBe("");
    expect(normalizeTextInput("value")).toBe("value");
    expect(normalizeTextInput(null)).toBe("");
    expect(normalizeTextInput(undefined)).toBe("");
    expect(normalizeTextInput(123)).toBe("123");
    expect(normalizeTextInput(false)).toBe("false");
    expect(normalizeTextInput({ toString: () => "object-text" })).toBe(
      "object-text",
    );
  });

  it("converts unknown values to code points", () => {
    expect(toCodePoints("a😀b")).toEqual(["a", "😀", "b"]);
    expect(toCodePoints(null)).toEqual([]);
    expect(toCodePoints(undefined)).toEqual([]);
  });

  it("normalizes with lower-case NFKC", () => {
    expect(lowerNfkc("ＨＥＬＬＯ")).toBe("hello");
  });

  it("strips zero-width characters", () => {
    expect(stripZeroWidth("he\u200bllo\ufeff")).toBe("hello");
    expect(stripZeroWidth("bad\u2060word")).toBe("badword");
  });

  it("normalizes mask char to one code point", () => {
    expect(normalizeMaskChar()).toBe("*");
    expect(normalizeMaskChar("##")).toBe("#");
    expect(normalizeMaskChar("😀x")).toBe("😀");
  });

  it("normalizes visible mask chars separately from length-preserving masks", () => {
    expect(normalizeVisibleMaskChar()).toBe("*");
    expect(normalizeVisibleMaskChar("")).toBe("*");
    expect(normalizeVisibleMaskChar("ab")).toBe("a");
    expect(normalizeVisibleMaskChar("😀x")).toBe("😀");
    expect(normalizeMaskChar("😀x")).toBe("😀");

    expect(normalizeLengthPreservingMaskChar()).toBe("*");
    expect(normalizeLengthPreservingMaskChar("")).toBe("*");
    expect(normalizeLengthPreservingMaskChar("ab")).toBe("a");
    expect(normalizeLengthPreservingMaskChar("😀x")).toBe("*");
  });
});
