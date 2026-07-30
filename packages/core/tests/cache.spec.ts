import { describe, expect, it } from "vitest";
import { createCachedTextProcessor, lowerNfkc } from "../src/index.js";

describe("textfilters cached text processor", () => {
  it("reuses cached results for repeated identical text", () => {
    let calls = 0;
    const cached = createCachedTextProcessor((text) => {
      calls++;
      return lowerNfkc(text);
    });

    expect(cached.process("ＨＥＬＬＯ")).toBe("hello");
    expect(cached.process("ＨＥＬＬＯ")).toBe("hello");
    expect(cached.size).toBe(1);
    expect(calls).toBe(1);
  });

  it("treats different normalized public inputs as cache misses", () => {
    let calls = 0;
    const cached = createCachedTextProcessor((text) => {
      calls++;
      return text.length;
    });

    expect(cached.process("one")).toBe(3);
    expect(cached.process("two")).toBe(3);
    expect(cached.process(null)).toBe(0);
    expect(cached.process(undefined)).toBe(0);
    expect(cached.size).toBe(3);
    expect(calls).toBe(3);
  });

  it("evicts the least recently used text when maxEntries is exceeded", () => {
    let calls = 0;
    const cached = createCachedTextProcessor(
      (text) => {
        calls++;
        return text.toUpperCase();
      },
      { maxEntries: 2 },
    );

    expect(cached.process("a")).toBe("A");
    expect(cached.process("b")).toBe("B");
    expect(cached.process("a")).toBe("A");
    expect(cached.process("c")).toBe("C");
    expect(cached.process("b")).toBe("B");
    expect(cached.size).toBe(2);
    expect(calls).toBe(4);
  });

  it("keeps cache configuration isolated per helper", () => {
    let firstCalls = 0;
    let secondCalls = 0;
    const first = createCachedTextProcessor(
      (text) => {
        firstCalls++;
        return `first:${text}`;
      },
      { maxEntries: 1 },
    );
    const second = createCachedTextProcessor((text) => {
      secondCalls++;
      return `second:${text}`;
    });

    expect(first.process("same")).toBe("first:same");
    expect(second.process("same")).toBe("second:same");
    expect(first.process("same")).toBe("first:same");
    expect(second.process("same")).toBe("second:same");
    expect(first.maxEntries).toBe(1);
    expect(second.maxEntries).toBe(256);
    expect(firstCalls).toBe(1);
    expect(secondCalls).toBe(1);
  });

  it("can disable caching with maxEntries zero", () => {
    let calls = 0;
    const cached = createCachedTextProcessor(
      (text) => {
        calls++;
        return text;
      },
      { maxEntries: 0 },
    );

    expect(cached.process("same")).toBe("same");
    expect(cached.process("same")).toBe("same");
    expect(cached.size).toBe(0);
    expect(calls).toBe(2);
  });

  it("clears cached entries without changing configuration", () => {
    let calls = 0;
    const cached = createCachedTextProcessor(
      (text) => {
        calls++;
        return text;
      },
      { maxEntries: 2 },
    );

    cached.process("same");
    cached.clear();

    expect(cached.size).toBe(0);
    expect(cached.maxEntries).toBe(2);
    expect(cached.process("same")).toBe("same");
    expect(calls).toBe(2);
  });
});
