import {
  censorCodePointRanges,
  type TextCodePointRange,
} from "@textfilters/core";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createProfanityFilter,
  createProfanityScanner,
  PROFANITY_FILTER_NAME,
  type ProfanityScanner,
} from "../src/index.js";
import { WHITESPACE_RE, WORD_CHAR_RE, WORD_RE } from "../src/token-ranges.js";

interface CoreRangeScannerLike {
  readonly name?: string;
  check(input: {
    readonly text: string;
    readonly codePoints: readonly string[];
  }): boolean;
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
    expect(scanner.allocationAware).toBe(true);
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

  it("checks through the filter fast path without collecting scanner output", () => {
    const filter = createProfanityFilter(["alpha"], []);
    const scanner = createProfanityScanner({ filter });
    const text = "ok alpha beta";

    expect(scanner.check({ text, codePoints: Array.from(text) })).toBe(true);
    expect(
      scanner.check({
        text: "clean text",
        codePoints: Array.from("clean text"),
      }),
    ).toBe(false);
  });

  it("streams ranges into a sink and supports early stop", () => {
    const filter = createProfanityFilter(["alpha", "beta"], []);
    const scanner = createProfanityScanner({ filter });
    const text = "alpha beta";
    const seen: TextCodePointRange[] = [];

    const completed = scanner.scan(
      { text, codePoints: Array.from(text) },
      (match) => {
        seen.push(match.range);
        return false;
      },
    );

    expect(completed).toBe(false);
    expect(seen).toEqual([[0, 5]]);
  });

  it("does not precollect analyzer output for package-owned sink scans", () => {
    const filter = createProfanityFilter(["alpha", "beta"], []);
    const analyzeSpy = vi.spyOn(filter, "analyze");
    const scanner = createProfanityScanner({ filter });
    const text = "alpha beta";

    const completed = scanner.scan(
      { text, codePoints: Array.from(text) },
      () => false,
    );

    expect(completed).toBe(false);
    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  it("does not mark external fallback filters as allocation-aware", () => {
    const analyze = vi.fn(() => [
      Object.assign([0, 5] as [number, number], { mode: "strict" as const }),
    ]);
    const scanner = createProfanityScanner({
      filter: {
        name: PROFANITY_FILTER_NAME,
        analyze,
        check: () => true,
        censor: (text) => String(text),
      },
    });
    const seen: TextCodePointRange[] = [];

    expect("allocationAware" in scanner).toBe(false);
    expect(
      scanner.scan(
        { text: "alpha", codePoints: Array.from("alpha") },
        (match) => {
          seen.push(match.range);
          return false;
        },
      ),
    ).toBe(false);
    expect(seen).toEqual([[0, 5]]);
    expect(analyze).toHaveBeenCalledOnce();
  });

  it("keeps package-owned sink scans streaming after the first match", () => {
    const filter = createProfanityFilter(["alpha", "beta", "gamma"], []);
    const analyzeSpy = vi.spyOn(filter, "analyze");
    const scanner = createProfanityScanner({ filter });
    const text = "alpha beta gamma";
    const seen: TextCodePointRange[] = [];

    const completed = scanner.scan(
      { text, codePoints: Array.from(text) },
      (match) => {
        seen.push(match.range);
        return seen.length < 2;
      },
    );

    expect(completed).toBe(false);
    expect(seen).toEqual([
      [0, 5],
      [6, 10],
    ]);
    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  it("preserves same-span loose metadata in streamed scans", () => {
    const filter = createProfanityFilter(
      [],
      [
        { source: "bad", category: "VULGAR", severity: "low" },
        { source: "b-a-d", category: "VULGAR", severity: "low" },
      ],
    );
    const scanner = createProfanityScanner({ filter });
    const text = "b-a-d";
    const streamedMetadata: string[] = [];

    expect(
      scanner.scan({ text, codePoints: Array.from(text) }, ({ match }) => {
        streamedMetadata.push(`${match.category}:${match.severity}`);
      }),
    ).toBe(true);
    expect(streamedMetadata).toEqual(["VULGAR:low", "VULGAR:low"]);
  });

  it("builds code point offsets lazily for early-stop sink scans", () => {
    const filter = createProfanityFilter(["alpha"], []);
    const scanner = createProfanityScanner({ filter });
    const text = `alpha ${"tail ".repeat(100)}`;
    const codePoints = new Proxy(Array.from(text), {
      get(target, property, receiver) {
        if (
          typeof property === "string" &&
          /^\d+$/u.test(property) &&
          Number(property) > 4
        ) {
          throw new Error("unexpected tail code point read");
        }

        return Reflect.get(target, property, receiver);
      },
    });
    const seen: TextCodePointRange[] = [];

    expect(
      scanner.scan({ text, codePoints }, (match) => {
        seen.push(match.range);
        return false;
      }),
    ).toBe(false);
    expect(seen).toEqual([[0, 5]]);
  });

  it("does not materialize normalized text before loose early-stop sink scans", () => {
    const filter = createProfanityFilter([], ["bad"]);
    const scanner = createProfanityScanner({ filter });
    const text = `ｂad ${"tail ".repeat(20)}`;
    const normalizedText = `bad ${"tail ".repeat(20)}`;
    const codePoints = Array.from(text);
    const arrayFromSpy = vi.spyOn(Array, "from");
    const seen: TextCodePointRange[] = [];
    let arrayFromCalls: unknown[][] = [];

    try {
      expect(
        scanner.scan({ text, codePoints }, (match) => {
          seen.push(match.range);
          return false;
        }),
      ).toBe(false);
      arrayFromCalls = [...arrayFromSpy.mock.calls];
    } finally {
      arrayFromSpy.mockRestore();
    }

    expect(seen).toEqual([[0, 3]]);
    expect(arrayFromCalls.some(([value]) => value === normalizedText)).toBe(
      false,
    );
  });

  it("skips empty strict passes before loose early-stop sink scans", () => {
    const filter = createProfanityFilter([], ["bad"]);
    const scanner = createProfanityScanner({ filter });
    const text = `bad ${"tail ".repeat(20)}`;
    const execSpy = vi.spyOn(RegExp.prototype, "exec");
    const seen: TextCodePointRange[] = [];
    let strictWordScanCalls = 0;

    try {
      expect(
        scanner.scan({ text, codePoints: Array.from(text) }, ({ range }) => {
          seen.push(range);
          return false;
        }),
      ).toBe(false);
      strictWordScanCalls = execSpy.mock.contexts.filter(
        (context): context is RegExp =>
          context instanceof RegExp &&
          context.source === WORD_RE.source &&
          context.flags === WORD_RE.flags,
      ).length;
    } finally {
      execSpy.mockRestore();
    }

    expect(seen).toEqual([[0, 3]]);
    expect(strictWordScanCalls).toBe(0);
  });

  it("streams strict symbol-only early stops without scanning the full symbol run", () => {
    const filter = createProfanityFilter(["."], []);
    const scanner = createProfanityScanner({ filter });
    const text = `.${"!".repeat(1000)} tail`;
    const execSpy = vi.spyOn(RegExp.prototype, "exec");
    const testSpy = vi.spyOn(RegExp.prototype, "test");
    const seen: TextCodePointRange[] = [];
    let strictWordScanCalls = 0;
    let symbolBoundaryChecks = 0;

    try {
      expect(
        scanner.scan({ text, codePoints: Array.from(text) }, ({ range }) => {
          seen.push(range);
          return false;
        }),
      ).toBe(false);
      strictWordScanCalls = execSpy.mock.contexts.filter(
        (context): context is RegExp =>
          context instanceof RegExp &&
          context.source === WORD_RE.source &&
          context.flags === WORD_RE.flags,
      ).length;
      symbolBoundaryChecks = testSpy.mock.contexts.filter(
        (context): context is RegExp =>
          context instanceof RegExp &&
          (context.source === WORD_CHAR_RE.source ||
            context.source === WHITESPACE_RE.source),
      ).length;
    } finally {
      execSpy.mockRestore();
      testSpy.mockRestore();
    }

    expect(seen).toEqual([[0, 1]]);
    expect(strictWordScanCalls).toBe(0);
    expect(symbolBoundaryChecks).toBeLessThan(20);
  });

  it("maps out-of-order streamed match offsets", () => {
    const filter = createProfanityFilter(["x"], ["bad"]);
    const scanner = createProfanityScanner({ filter });
    const text = "bad x";
    const seen: TextCodePointRange[] = [];

    expect(
      scanner.scan({ text, codePoints: Array.from(text) }, (match) => {
        seen.push(match.range);
      }),
    ).toBe(true);
    expect(seen).toEqual([
      [4, 5],
      [0, 3],
    ]);
  });

  it("preserves regex cursor across reentrant sink calls", () => {
    const filter = createProfanityFilter([], ["bad"]);
    const scanner = createProfanityScanner({ filter });
    const text = "bad bad";
    const seen: TextCodePointRange[] = [];

    expect(
      scanner.scan({ text, codePoints: Array.from(text) }, (match) => {
        seen.push(match.range);
        filter.analyze(text);
      }),
    ).toBe(true);
    expect(seen).toEqual([
      [0, 3],
      [4, 7],
    ]);
  });

  it("uses a stable matcher snapshot during sink scans", () => {
    const filter = createProfanityFilter(["alpha"], []);
    const scanner = createProfanityScanner({ filter });
    const text = "alpha beta";
    const seen: TextCodePointRange[] = [];

    expect(
      scanner.scan({ text, codePoints: Array.from(text) }, (match) => {
        seen.push(match.range);
        filter.addLoose("beta");
      }),
    ).toBe(true);
    expect(seen).toEqual([[0, 5]]);
    expect(filter.analyze(text).map((match) => [match[0], match[1]])).toEqual([
      [0, 5],
      [6, 10],
    ]);
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
