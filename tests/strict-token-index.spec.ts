import { describe, expect, it, vi } from "vitest";

import { createProfanityFilter, createProfanityScanner } from "../src/index.js";
import {
  buildTokenPatternIndex,
  type StrictPatternSet,
} from "../src/matchers/build.js";
import type { CompiledPattern } from "../src/matchers/compile.js";
import { hasStrictRange, iterateStrictRanges } from "../src/ranges/strict.js";

const compiledPattern = (
  source: string,
  ruleId: string,
  scanFirstChars?: readonly string[],
): CompiledPattern => ({
  re: new RegExp(`^(?:${source})$`, "iu"),
  scanFirstChars,
  ruleId,
  category: ruleId === "fallback" ? "OBSCENE_MAT" : "VULGAR",
  severity: ruleId === "fallback" ? "high" : "low",
});

const strictPatternSet = (
  token: readonly CompiledPattern[],
): StrictPatternSet => {
  const orderedToken = [...token];
  return {
    token: orderedToken,
    tokenIndex: buildTokenPatternIndex(orderedToken),
    symbolToken: [],
    symbolLengths: [],
    phrase: [],
  };
};

describe("strict token index", () => {
  it("preserves fallback and indexed pattern precedence with metadata", () => {
    const fallback = compiledPattern("bad", "fallback");
    const indexed = compiledPattern("bad", "indexed", ["b", "B"]);

    const fallbackMatch = [
      ...iterateStrictRanges("bad", strictPatternSet([fallback, indexed])),
    ][0];
    const indexedMatch = [
      ...iterateStrictRanges("bad", strictPatternSet([indexed, fallback])),
    ][0];

    expect(fallbackMatch).toMatchObject({
      ruleId: "fallback",
      category: "OBSCENE_MAT",
      severity: "high",
    });
    expect(indexedMatch).toMatchObject({
      ruleId: "indexed",
      category: "VULGAR",
      severity: "low",
    });
  });

  it("de-duplicates case-variant buckets for split-token lookup characters", () => {
    const indexed = compiledPattern(String.raw`[^\p{L}\p{N}]*bad`, "indexed", [
      "b",
      "B",
    ]);
    const testSpy = vi.spyOn(indexed.re, "test");
    const patterns = strictPatternSet([indexed]);

    expect(hasStrictRange("-BAD", patterns, () => true)).toBe(true);
    expect(testSpy).toHaveBeenCalledOnce();
  });

  it("keeps scratch state local to interleaved strict iterators", () => {
    const patterns = strictPatternSet([
      compiledPattern("alpha", "alpha", ["a", "A"]),
      compiledPattern("beta", "beta", ["b", "B"]),
    ]);
    const left = iterateStrictRanges("alpha beta", patterns);
    const right = iterateStrictRanges("beta alpha", patterns);

    expect(left.next().value).toMatchObject({ ruleId: "alpha" });
    expect(right.next().value).toMatchObject({ ruleId: "beta" });
    expect(left.next().value).toMatchObject({ ruleId: "beta" });
    expect(right.next().value).toMatchObject({ ruleId: "alpha" });
    expect(left.next().done).toBe(true);
    expect(right.next().done).toBe(true);
  });

  it("evaluates repeated positive and negative tokens once per invocation", () => {
    const positive = compiledPattern("bad", "positive", ["b", "B"]);
    const negative = compiledPattern("ordinarypattern", "negative", ["o", "O"]);
    const positiveSpy = vi.spyOn(positive.re, "test");
    const negativeSpy = vi.spyOn(negative.re, "test");
    const patterns = strictPatternSet([positive, negative]);

    expect([...iterateStrictRanges("bad bad bad", patterns)]).toHaveLength(3);
    expect(positiveSpy).toHaveBeenCalledOnce();

    expect(
      hasStrictRange("ordinary ordinary ordinary", patterns, () => true),
    ).toBe(false);
    expect(negativeSpy).toHaveBeenCalledOnce();
  });

  it("promotes three distinct tokens without repeating indexed evaluation", () => {
    const alpha = compiledPattern("alpha", "alpha", ["a", "A"]);
    const beta = compiledPattern("beta", "beta", ["b", "B"]);
    const gamma = compiledPattern("gamma", "gamma", ["g", "G"]);
    const spies = [alpha, beta, gamma].map((pattern) =>
      vi.spyOn(pattern.re, "test"),
    );
    const ranges = [
      ...iterateStrictRanges(
        "alpha beta gamma alpha beta gamma",
        strictPatternSet([alpha, beta, gamma]),
      ),
    ];

    expect(ranges).toHaveLength(6);
    for (const spy of spies) {
      expect(spy).toHaveBeenCalledOnce();
    }
  });

  it("reuses token lookup while checking every occurrence boundary", () => {
    const indexed = compiledPattern("bad", "indexed", ["b", "B"]);
    const testSpy = vi.spyOn(indexed.re, "test");
    const ranges = [
      ...iterateStrictRanges("\u0301bad bad", strictPatternSet([indexed])),
    ];

    expect(ranges.map((range) => [range[0], range[1]])).toEqual([[5, 8]]);
    expect(testSpy).toHaveBeenCalledOnce();
  });

  it("rebuilds independent indexes after runtime dictionary mutation", () => {
    const left = createProfanityFilter(["alpha"], []);
    const right = createProfanityFilter(["beta"], []);

    expect(left.check("gamma gamma")).toBe(false);
    left.setStrict(["gamma"]);
    left.addStrict("delta");

    expect(left.check("alpha")).toBe(false);
    expect(left.check("gamma gamma delta")).toBe(true);
    expect(left.censor("gamma gamma delta")).toBe("***** ***** *****");
    expect(right.check("beta")).toBe(true);
    expect(right.check("gamma gamma delta")).toBe(false);
  });

  it("keeps public UTF-16 ranges and scanner early-stop behavior compatible", () => {
    const filter = createProfanityFilter(
      [
        {
          source: "bad",
          category: "OBSCENE_MAT",
          severity: "high",
        },
      ],
      [],
    );
    const scanner = createProfanityScanner({ filter });
    const text = "😀 bad bad";
    const matches = filter.analyze(text);
    const seen: (readonly [number, number])[] = [];

    expect(filter.check(text)).toBe(true);
    expect(filter.censor(text)).toBe("😀 *** ***");
    expect(matches.map((match) => [match[0], match[1]])).toEqual([
      [3, 6],
      [7, 10],
    ]);
    for (const match of matches) {
      expect(match).toMatchObject({
        category: "OBSCENE_MAT",
        severity: "high",
      });
    }
    expect(filter.analyze(text, { categories: ["VULGAR"] })).toEqual([]);
    expect(filter.analyze(text, { minSeverity: "high" })).toHaveLength(2);

    const completed = scanner.scan(
      { text, codePoints: Array.from(text) },
      (match) => {
        seen.push(match.range);
        return false;
      },
    );

    expect(completed).toBe(false);
    expect(seen).toEqual([[2, 5]]);
  });
});
