import { describe, expect, it } from "vitest";

import {
  createUrlFilter,
  createUrlScanner,
  scanUrlRanges,
} from "../src/index.js";
import { mask } from "./helpers.js";

const exactTlds = new Set(["com", "net", "next", "plans", "travel"]);
const lookalikeTlds = new Set(["com", "net"]);

const wholeRange = (text: string): readonly (readonly [number, number])[] => [
  [0, Array.from(text).length],
];

describe("spaced domain boundaries", () => {
  it("stops at a completed domain before exact-only spaced prose", () => {
    for (const text of [
      "example.com • next",
      "foo.travel . plans",
      "example.com • next • plans",
    ]) {
      const completed = text.slice(0, text.indexOf(" "));
      const completedRange = [[0, Array.from(completed).length]] as const;
      const allowedDomains = new Set([completed]);

      expect(scanUrlRanges(text, exactTlds, lookalikeTlds)).toEqual(
        completedRange,
      );
      expect(
        scanUrlRanges(text, exactTlds, lookalikeTlds, allowedDomains),
      ).toEqual([]);
    }
  });

  it("selects sentence suffixes before trimming spaced prose", () => {
    const text = "Hello. example.com • next";
    const domain = "example.com";
    const start = Array.from(text.slice(0, text.indexOf(domain))).length;
    const range = [[start, start + Array.from(domain).length]] as const;

    expect(scanUrlRanges(text, exactTlds, lookalikeTlds)).toEqual(range);
    expect(
      scanUrlRanges(text, exactTlds, lookalikeTlds, new Set([domain])),
    ).toEqual([]);

    const domainLikePrefix = "HELLO.foo. bar.evil.com";
    expect(
      scanUrlRanges(
        domainLikePrefix,
        exactTlds,
        lookalikeTlds,
        new Set(["bar.evil.com"]),
      ),
    ).toEqual(wholeRange(domainLikePrefix));

    const punctuatedPrefix = "EVIL-123. bar.evil.com";
    expect(
      scanUrlRanges(
        punctuatedPrefix,
        exactTlds,
        lookalikeTlds,
        new Set(["bar.evil.com"]),
      ),
    ).toEqual(wholeRange(punctuatedPrefix));
  });

  it("keeps bounded lookalike and repeated TLD continuations intact", () => {
    for (const text of ["example.com • net", "foo.travel • travel"]) {
      const completed = text.slice(0, text.indexOf(" "));

      expect(
        scanUrlRanges(text, exactTlds, lookalikeTlds, new Set([completed])),
      ).toEqual(wholeRange(text));
    }
  });

  it("keeps defanged and implicit punycode continuations intact", () => {
    for (const text of [
      "example.com [.] xn--h2brj9c",
      "example.com • xn--h2brj9c",
    ]) {
      const scanner = createUrlScanner({ allowedDomains: ["example.com"] });
      const input = { text, codePoints: Array.from(text) };

      expect(scanner.check(input)).toBe(true);
      expect(scanner.scan(input)).toEqual({ ranges: wholeRange(text) });
      expect(
        createUrlFilter({ allowedDomains: ["example.com"] }).censor(text),
      ).toBe(mask(text));
    }
  });

  it("keeps obfuscated exact-only TLD continuations intact", () => {
    for (const text of [
      "example.com • n\u200be\u200bx\u200bt",
      "example.com • n_e_x_t",
      "example.com • n e x t",
      "example.com • _next",
      "example.com • \u200bnext",
      "example.com • _ next",
    ]) {
      expect(
        scanUrlRanges(text, exactTlds, lookalikeTlds, new Set(["example.com"])),
      ).toEqual(wholeRange(text));
    }

    const trailingJoin = "example.com • next_";
    expect(
      scanUrlRanges(
        trailingJoin,
        exactTlds,
        lookalikeTlds,
        new Set(["example.com"]),
      ),
    ).toEqual([[0, Array.from(trailingJoin).length - 1]]);
  });
});
