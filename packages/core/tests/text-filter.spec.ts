import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  combineFilters,
  createTextFilterFromScanner,
  type AllocationAwareRangeScanner,
  type TextFilter,
  type TextRangeScanner,
} from "../src/index.js";

function scannerFor(
  range: readonly [number, number],
): AllocationAwareRangeScanner {
  return {
    allocationAware: true,
    check: () => true,
    scan: (_input, sink) => sink({ range }),
  };
}

function regularScannerFor(range: readonly [number, number]): TextRangeScanner {
  return () => [range];
}

describe("shared text filter contract", () => {
  it("preserves an already normalized literal filter name", () => {
    const filter = createTextFilterFromScanner("url", scannerFor([0, 1]));

    expectTypeOf(filter.name).toEqualTypeOf<"url">();
    expect(filter.name).toBe("url");
  });

  it("rejects a filter name with surrounding whitespace", () => {
    expect(() =>
      createTextFilterFromScanner(" url ", scannerFor([0, 1])),
    ).toThrow("filter name must not have leading or trailing whitespace");
  });

  it("rejects an empty filter name", () => {
    expect(() => createTextFilterFromScanner("", scannerFor([0, 1]))).toThrow(
      "filter name must not be empty",
    );
  });

  it("adapts code-point scanners to UTF-16 matches", () => {
    const filter = createTextFilterFromScanner("example", scannerFor([1, 2]));

    expect(filter.find("a😀z")).toEqual([
      {
        start: 1,
        end: 3,
        value: "😀",
        filter: "example",
      },
    ]);
    expect(filter.check("a😀z")).toBe(true);
    expect(filter.censor("a😀z")).toBe("a**z");
    expect(filter.process("a😀z", "#")).toEqual({
      censored: "a##z",
      matches: filter.find("a😀z"),
    });
  });

  for (const [label, createScanner] of [
    ["allocation-aware", scannerFor],
    ["regular", regularScannerFor],
  ] as const) {
    it(`keeps all methods aligned for ${label} scanner ranges`, () => {
      const text = "abc";

      for (const range of [
        [-1, 1],
        [4, 5],
      ] as const) {
        const filter = createTextFilterFromScanner(
          "example",
          createScanner(range),
        );

        expect(filter.check(text)).toBe(false);
        expect(filter.find(text)).toEqual([]);
        expect(filter.censor(text)).toBe(text);
        expect(filter.process(text)).toEqual({ censored: text, matches: [] });
      }

      const filter = createTextFilterFromScanner(
        "example",
        createScanner([1, 2]),
      );
      const matches = filter.find(text);

      expect(filter.check(text)).toBe(true);
      expect(matches).toEqual([
        { start: 1, end: 2, value: "b", filter: "example" },
      ]);
      expect(filter.censor(text)).toBe("a*c");
      expect(filter.process(text)).toEqual({ censored: "a*c", matches });
    });
  }

  it("stops allocation-aware check after the first valid range", () => {
    const afterValid = vi.fn();
    const scanner: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: () => true,
      scan: (_input, sink) => {
        if (sink({ range: [-1, 1] }) === false) return false;
        if (sink({ range: [1, 2] }) === false) return false;
        afterValid();
      },
    };

    expect(createTextFilterFromScanner("example", scanner).check("abc")).toBe(
      true,
    );
    expect(afterValid).not.toHaveBeenCalled();
  });

  it("combines child matches against one original input and masks once", () => {
    const first = createTextFilterFromScanner("first", scannerFor([0, 4]));
    const second = createTextFilterFromScanner("second", scannerFor([2, 6]));
    const combined = combineFilters(first, second);

    expect(combined.find("abcdef").map(({ value }) => value)).toEqual([
      "abcd",
      "cdef",
    ]);
    expect(combined.censor("abcdef")).toBe("******");
    expect(combined.process("abcdef").censored).toBe("******");
  });

  it("does not call child censor methods from the combined filter", () => {
    const censor = vi.fn(() => {
      throw new Error("child censor must not run");
    });
    const child: TextFilter = {
      name: "child",
      check: () => true,
      find: (text) => [
        { start: 0, end: text.length, value: text, filter: "child" },
      ],
      censor,
      process: () => ({ censored: "", matches: [] }),
    };

    expect(combineFilters(child).censor("value")).toBe("*****");
    expect(censor).not.toHaveBeenCalled();
  });

  it("rejects non-string input at the shared TextFilter boundary", () => {
    const child = createTextFilterFromScanner("child", scannerFor([0, 1]));
    const combined = combineFilters(child);
    const unsafeChild = child as unknown as { check(value: unknown): boolean };
    const unsafeCombined = combined as unknown as {
      process(value: unknown): unknown;
    };

    expect(() => unsafeChild.check(null)).toThrow("text must be a string");
    expect(() => unsafeCombined.process(42)).toThrow("text must be a string");
  });
});
