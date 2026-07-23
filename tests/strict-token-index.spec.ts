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

  it("rebuilds independent indexes after runtime dictionary mutation", () => {
    const left = createProfanityFilter(["alpha"], []);
    const right = createProfanityFilter(["beta"], []);

    left.setStrict(["gamma"]);
    left.addStrict("delta");

    expect(left.check("alpha")).toBe(false);
    expect(left.check("gamma delta")).toBe(true);
    expect(left.censor("gamma delta")).toBe("***** *****");
    expect(right.check("beta")).toBe(true);
    expect(right.check("gamma delta")).toBe(false);
  });

  it("keeps public UTF-16 ranges and scanner early-stop behavior compatible", () => {
    const filter = createProfanityFilter(
      [
        {
          source: "bad",
          category: "OBSCENE_MAT",
          severity: "high",
        },
        "evil",
      ],
      [],
    );
    const scanner = createProfanityScanner({ filter });
    const text = "😀 bad evil";
    const matches = filter.analyze(text);
    const seen: (readonly [number, number])[] = [];

    expect(filter.check(text)).toBe(true);
    expect(filter.censor(text)).toBe("😀 *** ****");
    expect(matches.map((match) => [match[0], match[1]])).toEqual([
      [3, 6],
      [7, 11],
    ]);
    expect(matches[0]).toMatchObject({
      category: "OBSCENE_MAT",
      severity: "high",
    });

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
