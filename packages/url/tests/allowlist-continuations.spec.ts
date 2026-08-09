import { describe, expect, it } from "vitest";

import { createUrlFilter, createUrlScanner } from "../src/index.js";
import { mask } from "./helpers.js";

const tlds = ["travel"] as const;

const wholeRange = (text: string): readonly (readonly [number, number])[] => [
  [0, Array.from(text).length],
];

describe("allowlisted domain continuations", () => {
  it("does not exempt obfuscated continuations after an allowed host", () => {
    const candidates = [
      "foo.travel. travel",
      "foo.travel . travel",
      "foo.travel dot travel",
      "foo.travel [.] travel",
      "foo.travel • travel",
    ];

    for (const text of candidates) {
      const scanner = createUrlScanner({
        tlds,
        allowedDomains: ["foo.travel"],
      });
      const input = { text, codePoints: Array.from(text) };

      expect(scanner.check(input)).toBe(true);
      expect(scanner.scan(input)).toEqual({ ranges: wholeRange(text) });
      expect(
        createUrlFilter({
          tlds,
          allowedDomains: ["foo.travel"],
        }).censor(text),
      ).toBe(mask(text));
    }
  });

  it("keeps independent sentence hosts and prose boundaries separate", () => {
    const text = "foo.travel. bar.travel";
    const suffix = "bar.travel";
    const suffixStart = Array.from(text.slice(0, text.indexOf(suffix))).length;

    expect(
      createUrlScanner({
        tlds,
        allowedDomains: ["foo.travel"],
      }).scan({ text, codePoints: Array.from(text) }),
    ).toEqual({ ranges: [[suffixStart, Array.from(text).length]] });
    expect(
      createUrlFilter({
        tlds,
        allowedDomains: ["foo.travel", "bar.travel"],
      }).censor(text),
    ).toBe(text);

    const prose = "foo.travel. Travel is useful.";
    expect(
      createUrlFilter({
        tlds,
        allowedDomains: ["foo.travel"],
      }).censor(prose),
    ).toBe(prose);

    const continuedSuffix = "foo.travel. bar.travel. travel";
    const continuedSuffixStart = Array.from(
      continuedSuffix.slice(0, continuedSuffix.indexOf("bar.travel")),
    ).length;
    expect(
      createUrlScanner({
        tlds,
        allowedDomains: ["foo.travel"],
      }).scan({
        text: continuedSuffix,
        codePoints: Array.from(continuedSuffix),
      }),
    ).toEqual({
      ranges: [
        [
          continuedSuffixStart,
          continuedSuffixStart + Array.from("bar.travel").length,
        ],
      ],
    });
  });

  it("does not expand repeated TLD prose without an allowlist hit", () => {
    const prefix = "Visit ";
    const domain = "foo.travel";
    const text = `${prefix}${domain}. travel safely`;

    expect(
      createUrlScanner({ tlds }).scan({
        text,
        codePoints: Array.from(text),
      }),
    ).toEqual({
      ranges: [[Array.from(prefix).length, Array.from(prefix + domain).length]],
    });
  });

  it("validates continuations from the effective sentence suffix", () => {
    const prefix = "Hello. ";
    const continuation = "foo.travel. travel";
    const text = prefix + continuation;
    const start = Array.from(prefix).length;
    const scanner = createUrlScanner({
      tlds,
      allowedDomains: ["foo.travel"],
    });

    expect(scanner.scan({ text, codePoints: Array.from(text) })).toEqual({
      ranges: [[start, Array.from(text).length]],
    });
    expect(
      createUrlFilter({
        tlds,
        allowedDomains: ["foo.travel"],
      }).censor(text),
    ).toBe(prefix + mask(continuation));
  });

  it("short-circuits repeated independent allowed sentence hosts", () => {
    const text = "foo.travel. ".repeat(512);
    const scanner = createUrlScanner({
      tlds,
      allowedDomains: ["foo.travel"],
    });

    expect(scanner.scan({ text, codePoints: Array.from(text) })).toEqual({
      ranges: [],
    });
  });
});
