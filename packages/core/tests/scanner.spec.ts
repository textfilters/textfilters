import { describe, expect, it } from "vitest";
import {
  checkTextRanges,
  createPreparedText,
  createTextHints,
  createTextRangePipeline,
  createTextRangeScanResult,
  createTextScanInput,
  runTextRangeScanner,
  scanPreparedTextRanges,
  scanTextRanges,
  type AllocationAwareRangeScanner,
  type TextRangeScanner,
  type TextScanInput,
} from "../src/index.js";

describe("textfilters scanner contracts", () => {
  it("creates scan input with source text and code points", () => {
    expect(createTextScanInput("a😀b")).toEqual({
      text: "a😀b",
      codePoints: ["a", "😀", "b"],
    });
    expect(createTextScanInput(null)).toEqual({
      text: "",
      codePoints: [],
    });
    expect("hints" in createTextScanInput("plain")).toBe(false);
  });

  it("creates prepared text with reusable generic hints", () => {
    expect(createPreparedText("A+9@example.com/path:tail.")).toEqual({
      text: "A+9@example.com/path:tail.",
      codePoints: Array.from("A+9@example.com/path:tail."),
      hints: {
        textLength: 26,
        codePointLength: 26,
        isEmpty: false,
        hasAsciiOnly: true,
        hasNonAscii: false,
        hasDigit: true,
        digitCount: 1,
        hasAsciiLetter: true,
        hasWhitespace: false,
        hasPunctuation: true,
        punctuationCount: 6,
        hasAtSign: true,
        hasDot: true,
        hasSlash: true,
        hasColon: true,
        hasPlus: true,
      },
    });

    expect(createTextHints("a😀")).toMatchObject({
      textLength: 3,
      codePointLength: 2,
      hasAsciiOnly: false,
      hasNonAscii: true,
    });

    expect(createTextHints("a\u00a0b")).toMatchObject({
      hasAsciiOnly: false,
      hasNonAscii: true,
      hasWhitespace: true,
    });

    expect(createTextHints("a\u2014b")).toMatchObject({
      hasAsciiOnly: false,
      hasNonAscii: true,
      hasPunctuation: true,
      punctuationCount: 1,
    });

    expect(createTextHints("a１٣")).toMatchObject({
      hasAsciiOnly: false,
      hasNonAscii: true,
      hasDigit: true,
      digitCount: 2,
    });

    expect(createTextHints("＠．：／＋")).toMatchObject({
      hasAsciiOnly: false,
      hasNonAscii: true,
      hasPunctuation: true,
      punctuationCount: 4,
      hasAtSign: true,
      hasDot: true,
      hasColon: true,
      hasSlash: true,
      hasPlus: true,
    });
  });

  it("normalizes scanner results and preserves metadata", () => {
    expect(
      createTextRangeScanResult(
        [
          [4, 6],
          [1, 3],
          [2, 5],
        ],
        { kind: "test" },
      ),
    ).toEqual({
      ranges: [[1, 6]],
      metadata: { kind: "test" },
    });
  });

  it("runs scanner functions and scanner objects", () => {
    const input = createTextScanInput("abc");
    const functionScanner = () => [[0, 1]] as const;
    const objectScanner: TextRangeScanner = {
      name: "object-scanner",
      scan: () => ({ ranges: [[2, 3]], metadata: { source: "object" } }),
    };

    expect(runTextRangeScanner(functionScanner, input)).toEqual({
      ranges: [[0, 1]],
    });
    expect(runTextRangeScanner(objectScanner, input)).toEqual({
      ranges: [[2, 3]],
      metadata: { source: "object" },
    });
  });

  it("does not compute hints for legacy scanners", () => {
    const codePoints = new Proxy(["a", "b", "c"], {
      get(target, property, receiver) {
        if (property === Symbol.iterator) {
          throw new Error("unexpected hint walk");
        }

        return Reflect.get(target, property, receiver);
      },
    });
    const scanner: TextRangeScanner = {
      scan: () => ({ ranges: [[0, 1]] }),
    };

    expect(runTextRangeScanner(scanner, { text: "abc", codePoints })).toEqual({
      ranges: [[0, 1]],
    });
  });

  it("runs allocation-aware scanner objects through a sink", () => {
    const input = createPreparedText("abc hit");
    const scanner: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: (prepared) => prepared.hints.hasWhitespace,
      scan: (_prepared, sink) => {
        sink({ range: [4, 7], metadata: { kind: "word" } });
      },
    };

    expect(runTextRangeScanner(scanner, input)).toEqual({
      ranges: [[4, 7]],
      metadata: { matches: [{ kind: "word" }] },
    });
  });

  it("copies streamed ranges before storing allocation-aware matches", () => {
    const input = createPreparedText("abcd");
    const range = [0, 1] as [number, number];
    const scanner: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: () => true,
      scan: (_prepared, sink) => {
        sink({ range });
        range[0] = 2;
        range[1] = 3;
        sink({ range });
      },
    };

    expect(runTextRangeScanner(scanner, input).ranges).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("copies streamed match metadata before storing allocation-aware matches", () => {
    const input = createPreparedText("abcd");
    const metadata = { token: "first" };
    const scanner: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: () => true,
      scan: (_prepared, sink) => {
        sink({ range: [0, 1], metadata });
        metadata.token = "second";
        sink({ range: [2, 3], metadata });
        metadata.token = "third";
      },
    };

    expect(runTextRangeScanner(scanner, input).metadata).toEqual({
      matches: [{ token: "first" }, { token: "second" }],
    });
  });

  it("drops streamed metadata when allocation-aware ranges are rejected", () => {
    const input = createPreparedText("abc");
    const scanner: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: () => true,
      scan: (_prepared, sink) => {
        sink({ range: [2, 2], metadata: { token: "invalid" } });
        sink({ range: [0, 1], metadata: { token: "valid" } });
      },
    };

    expect(runTextRangeScanner(scanner, input)).toEqual({
      ranges: [[0, 1]],
      metadata: { matches: [{ token: "valid" }] },
    });
  });

  it("recomputes stale or missing hints on plain scan input", () => {
    const scanner: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: (prepared) => prepared.hints.hasAtSign,
      scan: (_prepared, sink) => {
        sink({ range: [0, 4] });
      },
    };
    const input = {
      text: "user@example.com",
      codePoints: Array.from("user@example.com"),
      hints: createTextHints("plain"),
    };
    const inputWithMissingHints = {
      text: "user@example.com",
      codePoints: Array.from("user@example.com"),
      hints: undefined,
    };

    expect(runTextRangeScanner(scanner, input).ranges).toEqual([[0, 4]]);
    expect(runTextRangeScanner(scanner, inputWithMissingHints).ranges).toEqual([
      [0, 4],
    ]);
  });

  it("preserves legacy object scanners that also expose check helpers", () => {
    const input = createPreparedText("abc");
    const scanner = {
      check: () => true,
      scan: (_input: TextScanInput, _legacyOptions?: unknown) => ({
        ranges: [[0, 3]] as const,
      }),
    };

    expect(runTextRangeScanner(scanner, input)).toEqual({
      ranges: [[0, 3]],
    });
    expect(checkTextRanges("abc", [scanner])).toBe(true);
  });

  it("stops allocation-aware scanning when the sink returns false", () => {
    const input = createPreparedText("one two");
    const seen: string[] = [];
    const scanner: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: () => true,
      scan: (_prepared, sink) => {
        seen.push("first");
        if (sink({ range: [0, 3] }) === false) return false;
        seen.push("second");
        sink({ range: [4, 7] });
      },
    };

    const completed = scanPreparedTextRanges(scanner, input, () => false);

    expect(completed).toBe(false);
    expect(seen).toEqual(["first"]);
  });

  it("latches allocation-aware sink cancellation after false", () => {
    const input = createPreparedText("one two");
    const seen: string[] = [];
    const scanner: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: () => true,
      scan: (_prepared, sink) => {
        seen.push("first");
        sink({ range: [0, 3] });
        seen.push("second");
        sink({ range: [4, 7] });
      },
    };

    const completed = scanPreparedTextRanges(scanner, input, (match) => {
      seen.push(`${match.range[0]}:${match.range[1]}`);
      return false;
    });

    expect(completed).toBe(false);
    expect(seen).toEqual(["first", "0:3", "second"]);
  });
});

describe("textfilters range scanner pipeline", () => {
  it("combines ranges from scanners in registration order and masks once", () => {
    const seen: string[] = [];
    const first: TextRangeScanner = {
      name: "first",
      scan: (input) => {
        seen.push(`first:${input.text}`);
        return [
          [1, 3],
          [5, 6],
        ];
      },
    };
    const second: TextRangeScanner = {
      name: "second",
      scan: (input) => {
        seen.push(`second:${input.codePoints.length}`);
        return [[2, 5]];
      },
    };

    const pipeline = createTextRangePipeline().use(first).use(second);

    expect(pipeline.censor("abcdef", "#")).toBe("a#####");
    expect(seen).toEqual(["first:abcdef", "second:6"]);
    expect(pipeline.scan("abcdef").ranges).toEqual([[1, 6]]);
  });

  it("returns scan results and censored text from process", () => {
    const pipeline = createTextRangePipeline()
      .use(() => [[0, 1]])
      .use(() => ({ ranges: [[3, 4]], metadata: { token: "tail" } }));

    expect(pipeline.process("abcd", "#")).toEqual({
      text: "#bc#",
      ranges: [
        [0, 1],
        [3, 4],
      ],
      scanResults: [
        { ranges: [[0, 1]] },
        { ranges: [[3, 4]], metadata: { token: "tail" } },
      ],
    });
  });

  it("keeps clean text unchanged when scanners return no ranges", () => {
    const pipeline = createTextRangePipeline().use(() => []);

    expect(pipeline.check("clean")).toBe(false);
    expect(pipeline.censor("clean")).toBe("clean");
    expect(pipeline.scan("clean")).toMatchObject({
      text: "clean",
      codePoints: ["c", "l", "e", "a", "n"],
      ranges: [],
      scanResults: [{ ranges: [] }],
    });
  });

  it("checks allocation-aware scanners without collecting matches", () => {
    const events: string[] = [];
    const scanner: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: (input) => {
        events.push(`check:${input.hints.hasDot}`);
        return input.hints.hasDot;
      },
      scan: (_input, _sink) => {
        events.push("scan");
      },
    };

    const pipeline = createTextRangePipeline().use(scanner);

    expect(pipeline.check("plain")).toBe(false);
    expect(pipeline.check("has.dot")).toBe(false);
    expect(events).toEqual(["check:false", "check:true", "scan"]);
  });

  it("checks allocation-aware scanners by stopping after the first emitted range", () => {
    const seen: string[] = [];
    const scanner: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: () => true,
      scan: (_input, sink) => {
        seen.push("first");
        if (sink({ range: [0, 3] }) === false) return false;
        seen.push("second");
        sink({ range: [4, 7] });
      },
    };

    const pipeline = createTextRangePipeline().use(scanner);

    expect(pipeline.check("has hit")).toBe(true);
    expect(seen).toEqual(["first"]);
  });

  it("defers prepared check input until an allocation-aware scanner is reached", () => {
    const events: string[] = [];
    const legacy: TextRangeScanner = {
      scan: (input) => {
        events.push(`legacy:${"hints" in input}`);
        return [[0, 1]];
      },
    };
    const allocationAware: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: () => {
        events.push("allocation-aware-check");
        return true;
      },
      scan: (_input, sink) => {
        events.push("allocation-aware-scan");
        sink({ range: [2, 3] });
      },
    };

    const pipeline = createTextRangePipeline().use(legacy).use(allocationAware);

    expect(pipeline.check("a.b")).toBe(true);
    expect(events).toEqual(["legacy:false"]);
  });

  it("ignores invalid allocation-aware ranges while checking", () => {
    const invalidOnly = createTextRangePipeline().use({
      allocationAware: true,
      check: () => true,
      scan: (_input, sink) => {
        sink({ range: [2, 2] });
      },
    });
    const invalidThenValid = createTextRangePipeline().use({
      allocationAware: true,
      check: () => true,
      scan: (_input, sink) => {
        sink({ range: [2, 2] });
        sink({ range: [0, 1] });
      },
    });

    expect(invalidOnly.check("abc")).toBe(false);
    expect(invalidThenValid.check("abc")).toBe(true);
  });

  it("reuses prepared text hints across registered scanners", () => {
    const seenHints: unknown[] = [];
    const first: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: (input) => input.hints.hasDot,
      scan: (input, sink) => {
        seenHints.push(input.hints);
        sink({ range: [0, 1] });
      },
    };
    const second: AllocationAwareRangeScanner = {
      allocationAware: true,
      check: (input) => input.hints.hasDot,
      scan: (input, sink) => {
        seenHints.push(input.hints);
        sink({ range: [2, 3] });
      },
    };

    expect(scanTextRanges("a.b", [first, second]).ranges).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(seenHints[0]).toBe(seenHints[1]);
  });

  it("collects ranges from scanner functions without constructing a pipeline", () => {
    const scanner = (input: TextScanInput) =>
      input.text.includes("hit") ? [[0, 3] as const] : [];

    expect(scanTextRanges("hit", [scanner])).toMatchObject({
      text: "hit",
      codePoints: ["h", "i", "t"],
      ranges: [[0, 3]],
      scanResults: [{ ranges: [[0, 3]] }],
    });
  });

  it("uses plain scan input for legacy-only pipeline scans", () => {
    const seenHints: boolean[] = [];
    const scanner: TextRangeScanner = {
      scan: (input) => {
        seenHints.push("hints" in input);
        return [[0, 1]];
      },
    };

    expect(scanTextRanges("abc", [scanner]).ranges).toEqual([[0, 1]]);
    expect(checkTextRanges("abc", [scanner])).toBe(true);
    expect(seenHints).toEqual([false, false]);
  });

  it("rejects invalid scanner registrations", () => {
    expect(() => createTextRangePipeline().use({} as TextRangeScanner)).toThrow(
      "scanner must be a function or scanner object",
    );
  });
});
