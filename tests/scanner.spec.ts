import {
  censorCodePointRanges,
  type TextCodePointRange,
} from "@textfilters/core";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createProfanityFilter,
  createProfanityScanner,
  PROFANITY_FILTER_NAME,
  type ProfanityScanner,
} from "../src/index.js";

interface CoreRangeScannerLike {
  readonly name?: string;
  scan(input: {
    readonly text: string;
    readonly codePoints: readonly string[];
  }):
    | readonly TextCodePointRange[]
    | {
        readonly ranges: readonly TextCodePointRange[];
        readonly metadata?: Readonly<Record<string, unknown>>;
      };
}

describe("profanity scanner adapter", () => {
  it("exposes a scanner object compatible with the shared range contract shape", () => {
    const scanner = createProfanityScanner();

    expectTypeOf(scanner).toEqualTypeOf<ProfanityScanner>();
    expectTypeOf(scanner).toMatchTypeOf<CoreRangeScannerLike>();
    expect(scanner.name).toBe(PROFANITY_FILTER_NAME);
  });

  it("returns ranges and analyzer metadata from the public analyzer", () => {
    const filter = createProfanityFilter(
      [{ source: "alpha", category: "OBSCENE_MAT", severity: "high" }],
      [],
    );
    const scanner = createProfanityScanner({ filter });
    const text = "ok alpha beta";
    const result = scanner.scan({ text, codePoints: Array.from(text) });
    const [match] = result.metadata.matches;

    expect(result.ranges).toEqual([[3, 8]]);
    expect(match === undefined ? [] : [match[0], match[1]]).toEqual([3, 8]);
    expect(match).toMatchObject({
      mode: "strict",
      category: "OBSCENE_MAT",
      severity: "high",
    });
  });

  it("applies severity filters before returning ranges", () => {
    const filter = createProfanityFilter(
      [
        { source: "alpha", category: "OBSCENE_MAT", severity: "high" },
        { source: "beta", category: "VULGAR", severity: "low" },
      ],
      [],
    );
    const scanner = createProfanityScanner({
      filter,
      matchOptions: { minSeverity: "high" },
    });
    const text = "alpha beta";
    const result = scanner.scan({ text, codePoints: Array.from(text) });

    expect(result.ranges).toEqual([[0, 5]]);
    expect(result.metadata.matches.map((match) => match.severity)).toEqual([
      "high",
    ]);
  });

  it("returns ranges that can be masked through shared core range helpers", () => {
    const filter = createProfanityFilter(["alpha"], []);
    const scanner = createProfanityScanner({ filter });
    const text = "😀 alpha beta";
    const codePoints = Array.from(text);
    const result = scanner.scan({ text, codePoints });

    expect(result.ranges).toEqual([[2, 7]]);
    expect(censorCodePointRanges(codePoints, result.ranges, "#")).toBe(
      "😀 ##### beta",
    );
  });

  it("converts repeated UTF-16 match offsets to code point ranges", () => {
    const filter = createProfanityFilter(["x"], []);
    const scanner = createProfanityScanner({ filter });
    const text = "😀 x x x";
    const codePoints = Array.from(text);
    const result = scanner.scan({ text, codePoints });

    expect(result.ranges).toEqual([
      [2, 3],
      [4, 5],
      [6, 7],
    ]);
    expect(censorCodePointRanges(codePoints, result.ranges, "#")).toBe(
      "😀 # # #",
    );
  });
});
