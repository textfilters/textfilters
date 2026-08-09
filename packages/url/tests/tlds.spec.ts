import { describe, expect, it } from "vitest";

import { createUrlFilter, createUrlScanner } from "../src/index.js";
import {
  IANA_ASCII_TLDS,
  IANA_TLD_SNAPSHOT_VERSION,
  IANA_TLDS,
  IANA_UNICODE_TLDS,
} from "../src/tld-data.js";
import { mask } from "./helpers.js";

const wholeRange = (text: string): Array<readonly [number, number]> => [
  [0, Array.from(text).length],
];

describe("IANA TLD snapshot", () => {
  it("keeps a versioned, unique, sorted registry snapshot", () => {
    expect(IANA_TLD_SNAPSHOT_VERSION).toBe("2026080801");
    expect(IANA_ASCII_TLDS).toHaveLength(1_438);
    expect(IANA_UNICODE_TLDS).toHaveLength(151);
    expect(new Set(IANA_TLDS).size).toBe(IANA_TLDS.length);
    expect(IANA_ASCII_TLDS).toEqual([...IANA_ASCII_TLDS].sort());
    expect(IANA_UNICODE_TLDS).toEqual([...IANA_UNICODE_TLDS].sort());
    expect(IANA_ASCII_TLDS).toEqual(
      expect.arrayContaining(["be", "travel", "xn--h2brj9c"]),
    );
    expect(IANA_UNICODE_TLDS).toEqual(
      expect.arrayContaining(["भारत", "বাংলা", "한국"]),
    );
    expect(IANA_TLDS).toEqual([...IANA_ASCII_TLDS, ...IANA_UNICODE_TLDS]);
    expect(IANA_ASCII_TLDS.every((tld) => /^[a-z0-9-]+$/u.test(tld))).toBe(
      true,
    );
    expect(
      IANA_UNICODE_TLDS.every(
        (tld) => tld.normalize("NFC") === tld && /[^\x00-\x7f]/u.test(tld),
      ),
    ).toBe(true);
  });

  it("matches delegated ASCII, A-label, and Unicode TLDs by default", () => {
    const domains = [
      "youtu.be",
      "example.travel",
      "example.today",
      "example.art",
      "good.it/path",
      "good.be/path",
      "example.xn--h2brj9c",
      "example.भारत",
      "example.বাংলা",
      `example.${"한국".normalize("NFD")}`,
    ];

    for (const text of domains) {
      const input = { text, codePoints: Array.from(text) };
      const scanner = createUrlScanner();
      expect(scanner.check(input)).toBe(true);
      expect(scanner.scan(input)).toEqual({ ranges: wholeRange(text) });
      expect(createUrlFilter().censor(text)).toBe(mask(text));
    }
  });

  it("does not treat sentence prose or unknown suffixes as bare domains", () => {
    const fixtures = [
      "This is good. It is fine.",
      "This is good. it is fine.",
      "This is good. In this case, continue.",
      "This is good. in this case, continue.",
      "This is good. at least this works.",
      "This is good. be careful now.",
      "This is good. to continue, proceed.",
      "This is good. Travel is fun.",
      "This is good. travel is fun.",
      "This is good. Today-based plans work.",
      "This is good. YouTube works.",
      "الكلام جيد. مصر جميلة.",
      "module.pyc",
      "service.kom",
      "example.ey",
      "example.invalidtld",
    ];

    for (const text of fixtures) {
      expect(createUrlFilter().censor(text)).toBe(text);
    }
  });

  it("keeps exact allowlists narrow for delegated TLDs", () => {
    const allowed = createUrlFilter({ allowedDomains: ["foo.travel"] });
    for (const text of [
      "foo.travel dot travel",
      "foo.travel [.] travel",
      "foo.travel • travel",
      "foo.travel . travel",
      "foo • foo [.] travel",
    ]) {
      expect(allowed.censor(text)).toBe(mask(text));
    }

    expect(
      createUrlFilter({ allowedDomains: ["youtu.be"] }).censor(
        "youtu.be example.travel",
      ),
    ).toBe(`youtu.be ${mask("example.travel")}`);
  });
});
