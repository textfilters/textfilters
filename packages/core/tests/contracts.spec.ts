import { describe, expect, it } from "vitest";
import type {
  ScanHints,
  ScanInput,
  ScanResult,
  TextCensor,
  TextGuard,
  TextGuardResult,
  TextRange,
} from "../src/index.js";

describe("textfilters core contracts", () => {
  it("allows censors and guards to share stable shapes", () => {
    const censor: TextCensor = {
      name: "test-censor",
      censor: (value) => value.replace("secret", "******"),
    };
    const result: TextGuardResult = {
      allowed: false,
      reason: "blocked",
    };
    const guard: TextGuard = {
      name: "test-guard",
      check: () => result,
    };

    expect(censor.censor("secret")).toBe("******");
    expect(guard.check({ text: "value" })).toEqual(result);
  });

  it("exposes short scanner contract aliases for shared scanner work", () => {
    const range: TextRange = [1, 3];
    const hints: ScanHints = {
      textLength: 3,
      codePointLength: 3,
      isEmpty: false,
      hasAsciiOnly: true,
      hasNonAscii: false,
      hasDigit: false,
      digitCount: 0,
      hasAsciiLetter: true,
      hasWhitespace: false,
      hasPunctuation: false,
      punctuationCount: 0,
      hasAtSign: false,
      hasDot: false,
      hasSlash: false,
      hasColon: false,
      hasPlus: false,
    };
    const input: ScanInput = {
      text: "abc",
      codePoints: ["a", "b", "c"],
      hints,
    };
    const result: ScanResult = {
      text: input.text,
      codePoints: input.codePoints,
      ranges: [range],
      scanResults: [{ ranges: [range] }],
    };

    expect(result).toEqual({
      text: "abc",
      codePoints: ["a", "b", "c"],
      ranges: [[1, 3]],
      scanResults: [{ ranges: [[1, 3]] }],
    });
  });
});
