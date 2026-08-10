import { describe, expect, it } from "vitest";

import {
  checkUrlRanges,
  createUrlFilter,
  createUrlScanner,
  scanUrlRangeMatches,
  scanUrlRanges,
  type AmbiguousSpacedDotPolicy,
  type UrlRangeScanner,
  type UrlRangeScanResult,
  type UrlScanHints,
} from "../src/index.js";
import { DOT_CHAR_SET, LOOKALIKE_TO_ASCII } from "../src/chars.js";
import { toSkeleton } from "../src/meta.js";
import { DEFAULT_TLDS } from "../src/tlds.js";
import { mask } from "./helpers.js";

type Range = readonly [number, number];

interface ScannerFixture {
  readonly text: string;
  readonly ranges: readonly Range[];
  readonly allowedDomains?: readonly string[];
  readonly ambiguousSpacedDots?: AmbiguousSpacedDotPolicy;
}

const wholeRange = (text: string): readonly Range[] => [
  [0, Array.from(text).length],
];

const rangesEqual = (
  actual: readonly Range[],
  expected: readonly Range[],
): boolean =>
  actual.length === expected.length &&
  actual.every(
    (range, index) =>
      range[0] === expected[index]?.[0] && range[1] === expected[index]?.[1],
  );

const maskRanges = (text: string, ranges: readonly Range[]): string => {
  const codePoints = Array.from(text);
  for (const [start, end] of ranges) {
    for (let index = start; index < end; index++) {
      codePoints[index] = "*".repeat(codePoints[index]?.length ?? 0);
    }
  }
  return codePoints.join("");
};

const NORMALIZATION_FORMS = ["NFC", "NFD", "NFKC", "NFKD"] as const;

const getNormalizationVariants = (
  value: string,
): ReadonlyMap<string, readonly string[]> => {
  const variants = new Map<string, string[]>();
  for (const form of NORMALIZATION_FORMS) {
    const normalized = value.normalize(form);
    const forms = variants.get(normalized);
    if (forms) forms.push(form);
    else variants.set(normalized, [form]);
  }
  return variants;
};

const toFullwidthAscii = (value: string): string =>
  Array.from(value, (char) =>
    char === "-"
      ? "－"
      : String.fromCodePoint((char.codePointAt(0) ?? 0) + 0xfee0),
  ).join("");

const createFailureRecorder = (): {
  readonly record: (failure: unknown) => void;
  readonly result: () => {
    readonly failures: number;
    readonly samples: unknown[];
  };
} => {
  let failures = 0;
  const samples: unknown[] = [];
  return {
    record(failure) {
      failures++;
      if (samples.length < 12) samples.push(failure);
    },
    result: () => ({ failures, samples }),
  };
};

const expectScannerFixture = ({
  text,
  ranges,
  allowedDomains,
  ambiguousSpacedDots,
}: ScannerFixture): void => {
  const input = { text, codePoints: Array.from(text) };
  const scanner = createUrlScanner({ allowedDomains, ambiguousSpacedDots });
  const seen: Range[] = [];

  if (allowedDomains === undefined && ambiguousSpacedDots === undefined) {
    expect(scanUrlRanges(text)).toEqual(ranges);
    expect(checkUrlRanges(input)).toBe(ranges.length > 0);
  }
  expect(scanner.check(input)).toBe(ranges.length > 0);
  expect(scanner.scan(input)).toEqual({ ranges });
  expect(
    scanner.scan(input, (match) => {
      seen.push(match.range);
    }),
  ).toBe(true);
  expect(seen).toEqual(ranges);
  expect(
    createUrlFilter({ allowedDomains, ambiguousSpacedDots }).censor(text),
  ).toBe(maskRanges(text, ranges));
};

describe("URL scanner", () => {
  it("keeps scanner contracts compatible with shared range shapes", () => {
    const scanner: UrlRangeScanner = createUrlScanner();
    const hints: UrlScanHints = {
      hasNonAscii: false,
      hasDot: true,
      hasSlash: false,
      hasColon: false,
    };
    const text = "visit example.com now";
    const result: UrlRangeScanResult = scanner.scan({
      text,
      codePoints: Array.from(text),
      hints,
    });

    expect(result).toEqual({ ranges: [[6, 17]] });
  });

  it("exposes scanner ranges compatible with code point masking", () => {
    const scanner = createUrlScanner();
    expect(
      scanner.scan({
        text: "visit https://example.com now",
        codePoints: Array.from("visit https://example.com now"),
      }),
    ).toEqual({
      ranges: [[6, 25]],
    });
  });

  it("keeps the public censor wrapper aligned with scanner ranges", () => {
    const text = "go https://example.com/path now";
    const scanner = createUrlScanner();
    const ranges = scanner.scan({
      text,
      codePoints: Array.from(text),
    }).ranges;

    expect(ranges).toEqual([[3, 27]]);
    expect(createUrlFilter({ maskChar: "#" }).censor(text)).toBe(
      `go ${mask("https://example.com/path", "#")} now`,
    );
  });

  it("normalizes every completed default TLD before lookup and adjacency trimming", () => {
    const failures = createFailureRecorder();

    for (const tld of DEFAULT_TLDS) {
      for (const [variant, forms] of getNormalizationVariants(tld)) {
        const domain = `x.${variant}`;
        const domainLength = Array.from(domain).length;
        const adjacent = `${domain} y.org`;
        const expectedAdjacent: readonly Range[] = [
          [0, domainLength],
          [domainLength + 1, domainLength + 6],
        ];
        const directRanges = scanUrlRanges(domain);
        const adjacentRanges = scanUrlRanges(adjacent);

        if (
          !rangesEqual(directRanges, wholeRange(domain)) ||
          !rangesEqual(adjacentRanges, expectedAdjacent)
        ) {
          failures.record({
            tld,
            forms,
            variant,
            directRanges,
            adjacentRanges,
          });
        }
      }
    }

    expect(failures.result()).toEqual({ failures: 0, samples: [] });
  });

  it("applies every mapped Unicode letter and dot lookalike to delegated TLDs", () => {
    const asciiTlds = DEFAULT_TLDS.filter((tld) => /^[a-z]+$/u.test(tld));
    const failures = createFailureRecorder();

    for (const [lookalike, ascii] of LOOKALIKE_TO_ASCII) {
      const tld = asciiTlds.find((candidate) => candidate.includes(ascii));
      if (!tld) {
        failures.record({ lookalike, ascii, reason: "missing target TLD" });
        continue;
      }
      const index = tld.indexOf(ascii);
      const variant = `${tld.slice(0, index)}${lookalike}${tld.slice(index + 1)}`;
      const text = `x.${variant}`;
      const ranges = scanUrlRanges(text);
      if (!rangesEqual(ranges, wholeRange(text))) {
        failures.record({ lookalike, ascii, tld, variant, ranges });
      }
    }

    for (const dot of DOT_CHAR_SET) {
      const text = `x${dot}com`;
      const ranges = scanUrlRanges(text);
      if (!rangesEqual(ranges, wholeRange(text))) {
        failures.record({ dot, ranges });
      }
    }

    expect(failures.result()).toEqual({ failures: 0, samples: [] });
  });

  it("applies the label length limit after whole-label normalization", () => {
    const composed = `${"é".repeat(50)}.com`;
    const decomposed = composed.normalize("NFD");
    const overlong = `${"a".repeat(64)}.com`;
    const overlongDecomposed = `${"é".repeat(64)}.com`.normalize("NFD");

    expect(scanUrlRanges(composed)).toEqual(wholeRange(composed));
    expect(scanUrlRanges(decomposed)).toEqual(wholeRange(decomposed));
    expect(createUrlFilter().censor(decomposed)).toBe(mask(decomposed));
    expect(scanUrlRanges(overlong)).toEqual([]);
    expect(scanUrlRanges(overlongDecomposed)).toEqual([]);
  });

  it("normalizes compatibility expansions from original label code points", () => {
    const compatibilityMappings: Array<readonly [string, string]> = [];
    for (let codePoint = 0; codePoint <= 0x10ffff; codePoint++) {
      if (codePoint >= 0xd800 && codePoint <= 0xdfff) continue;
      const source = String.fromCodePoint(codePoint);
      const normalized = source.normalize("NFKC").toLowerCase();
      if (
        Array.from(normalized).length > 1 &&
        /^[a-z0-9-]+$/u.test(normalized)
      ) {
        compatibilityMappings.push([normalized, source]);
      }
    }

    const failures = createFailureRecorder();
    for (const tld of DEFAULT_TLDS) {
      if (!/^[a-z0-9-]+$/u.test(tld)) continue;
      const variants = new Set<string>();
      for (const [sequence, source] of compatibilityMappings) {
        let start = 0;
        while (start < tld.length) {
          const index = tld.indexOf(sequence, start);
          if (index < 0) break;
          variants.add(
            `${tld.slice(0, index)}${source}${tld.slice(index + sequence.length)}`,
          );
          start = index + 1;
        }
      }

      for (const variant of variants) {
        const domain = `x.${variant}`;
        const domainLength = Array.from(domain).length;
        const adjacent = `${domain} y.org`;
        const expectedAdjacent: readonly Range[] = [
          [0, domainLength],
          [domainLength + 1, domainLength + 6],
        ];
        const directRanges = scanUrlRanges(domain);
        const adjacentRanges = scanUrlRanges(adjacent);
        if (
          !rangesEqual(directRanges, wholeRange(domain)) ||
          !rangesEqual(adjacentRanges, expectedAdjacent)
        ) {
          failures.record({ tld, variant, directRanges, adjacentRanges });
        }
      }
    }

    expect(failures.result()).toEqual({ failures: 0, samples: [] });
  });

  it("normalizes every implicit low-level custom TLD lookup", () => {
    const failures = createFailureRecorder();

    for (const tld of DEFAULT_TLDS) {
      const configuredValues = /^[a-z0-9-]+$/u.test(tld)
        ? [tld.toUpperCase(), toFullwidthAscii(tld.toUpperCase())]
        : [tld.normalize("NFD"), tld.normalize("NFKD"), tld.toUpperCase()];
      for (const configured of new Set(configuredValues)) {
        const text = `x.${tld}`;
        const ranges = scanUrlRanges(text, new Set([configured]));
        if (!rangesEqual(ranges, wholeRange(text))) {
          failures.record({ tld, configured, ranges });
        }
      }
    }

    expect(failures.result()).toEqual({ failures: 0, samples: [] });
  });

  it("keeps normalized low-level lookups directional and API-aligned", () => {
    for (const [text, configured] of [
      ["x.com", "COM"],
      ["x.com", "ＣＯＭ"],
      ["x.한국", "한국".normalize("NFD")],
      ["x.москва", "МОСКВА"],
    ] as const) {
      const tldSet = new Set([configured]);
      const input = { text, codePoints: Array.from(text) };
      const seen: Range[] = [];

      expect(scanUrlRanges(text, tldSet)).toEqual(wholeRange(text));
      expect(checkUrlRanges(input, tldSet)).toBe(true);
      expect(
        scanUrlRangeMatches(
          input,
          (match) => {
            seen.push(match.range);
          },
          tldSet,
        ),
      ).toBe(true);
      expect(seen).toEqual(wholeRange(text));
    }

    const delegated = new Set(DEFAULT_TLDS);
    for (const tld of DEFAULT_TLDS) {
      if (/^[a-z0-9-]+$/u.test(tld)) continue;
      const skeleton = toSkeleton(tld);
      if (!/^[a-z0-9-]+$/u.test(skeleton) || delegated.has(skeleton)) {
        continue;
      }
      expect(scanUrlRanges(`x.${skeleton}`)).toEqual([]);
      expect(scanUrlRanges(`x.${skeleton}`, new Set([tld]))).toEqual([]);
      expect(scanUrlRanges(`x.${tld}`, new Set([tld]))).toEqual(
        wholeRange(`x.${tld}`),
      );
    }
  });

  it("keeps marked Unicode TLDs independent from adjacent domains and allowlists", () => {
    const text = "example.कॉम x.org";
    const first = "example.कॉम";
    const second = "x.org";
    const secondStart = Array.from(first).length + 1;
    const ranges: readonly Range[] = [
      [0, Array.from(first).length],
      [secondStart, secondStart + Array.from(second).length],
    ];

    expectScannerFixture({ text, ranges });
    expect(createUrlFilter({ allowedDomains: [first] }).censor(text)).toBe(
      `${first} ${mask(second)}`,
    );

    const punycode = "x.xn--unknown y.org";
    const punycodeEnd = Array.from("x.xn--unknown").length;
    expect(scanUrlRanges(punycode)).toEqual([
      [0, punycodeEnd],
      [punycodeEnd + 1, Array.from(punycode).length],
    ]);
  });

  it("checks URL candidates without collecting every range", () => {
    const scanner = createUrlScanner();
    const text = "visit https://example.com and https://second.example now";
    const input = { text, codePoints: Array.from(text) };

    expect(scanner.check(input)).toBe(true);
    expect(scanner.check({ text: "plain words only", codePoints: [] })).toBe(
      false,
    );
    expect(checkUrlRanges(input)).toBe(true);
  });

  it("streams scanner ranges into a sink and supports early stop", () => {
    const scanner = createUrlScanner();
    const text = "visit example.com and example.org now";
    const seen: Array<readonly [number, number]> = [];

    const completed = scanner.scan(
      { text, codePoints: Array.from(text) },
      (match) => {
        seen.push(match.range);
        return false;
      },
    );

    expect(completed).toBe(false);
    expect(seen).toEqual([[6, 17]]);
  });

  it("uses shared-style hints to skip clearly clean text", () => {
    expect(
      checkUrlRanges({
        text: "plain words only",
        codePoints: Array.from("plain words only"),
        hints: {
          hasNonAscii: false,
          hasDot: false,
          hasSlash: false,
          hasColon: false,
        },
      }),
    ).toBe(false);
  });

  it("does not let false shared hints hide split-dot URLs", () => {
    const scanner = createUrlScanner();
    const text = "visit example d o t com";
    const input = {
      text,
      codePoints: Array.from(text),
      hints: {
        hasNonAscii: false,
        hasDot: false,
        hasSlash: false,
        hasColon: false,
      },
    };
    const seen: Array<readonly [number, number]> = [];

    expect(scanner.check(input)).toBe(true);
    expect(
      scanner.scan(input, (match) => {
        seen.push(match.range);
        return false;
      }),
    ).toBe(false);
    expect(seen).toEqual([[6, 23]]);
  });

  it("streams prefixed, bare-domain, and punctuation-trimmed ranges", () => {
    const text = "go https://example.com/path, then example.org.";
    const seen: Array<readonly [number, number]> = [];

    expect(
      scanUrlRangeMatches({ text, codePoints: Array.from(text) }, (match) => {
        seen.push(match.range);
      }),
    ).toBe(true);
    expect(seen).toEqual([
      [3, 27],
      [34, 45],
    ]);
  });

  it("keeps sentence prose outside independent domain ranges", () => {
    const text = "природе. shutterstock.com ru.freepik.com symbl.cc";
    const domains = ["shutterstock.com", "ru.freepik.com", "symbl.cc"];
    const expected = domains.map((domain) => {
      const start = Array.from(text.slice(0, text.indexOf(domain))).length;
      return [start, start + Array.from(domain).length] as const;
    });
    const seen: Array<readonly [number, number]> = [];
    const censored = createUrlFilter().censor(text);

    expect(scanUrlRanges(text)).toEqual(expected);
    expect(
      scanUrlRangeMatches({ text, codePoints: Array.from(text) }, (match) => {
        seen.push(match.range);
      }),
    ).toBe(true);
    expect(seen).toEqual(expected);
    expect(censored).toBe(
      `природе. ${domains.map((domain) => mask(domain)).join(" ")}`,
    );
    expect(censored.length).toBe(text.length);
  });

  it("prefers the last sentence boundary before a bare domain", () => {
    const text = "Hello. There. example.com";
    const domain = "example.com";
    const start = Array.from(text.slice(0, text.indexOf(domain))).length;

    expect(scanUrlRanges(text)).toEqual([
      [start, start + Array.from(domain).length],
    ]);
    expect(createUrlFilter().censor(text)).toBe(
      `Hello. There. ${mask(domain)}`,
    );
  });

  it("applies an explicit policy to ambiguous spaced-dot candidates", () => {
    const cases = [
      ["Fine. Be careful.", "Fine. Be"],
      ["这是 示例。 中国 很好", "示例。 中国"],
      ["Step 1. One thing remains.", "Step 1. One"],
      ["State-of-the-art. Design matters.", "State-of-the-art. Design"],
      ["visit evil. com", "evil. com"],
      ["please open phishing. net!", "phishing. net"],
      ["Visit evil. com now", "evil. com"],
      ["Please visit Evil. com now", "Evil. com"],
      ["Hello܁ com next", "Hello܁ com"],
      ["Hello܂ com next", "Hello܂ com"],
      ["Hello꘎ com next", "Hello꘎ com"],
      ["Hello𐩐 com next", "Hello𐩐 com"],
    ] as const;

    for (const [text, candidate] of cases) {
      const start = Array.from(text.slice(0, text.indexOf(candidate))).length;
      const range: Range = [start, start + Array.from(candidate).length];

      expectScannerFixture({ text, ranges: [] });
      expectScannerFixture({
        text,
        ranges: [range],
        ambiguousSpacedDots: "block",
      });
    }

    const strongEvidence = "Visit evil. com/path now";
    const candidate = "evil. com/path";
    const start = Array.from(
      strongEvidence.slice(0, strongEvidence.indexOf(candidate)),
    ).length;
    expectScannerFixture({
      text: strongEvidence,
      ranges: [[start, start + Array.from(candidate).length]],
    });
  });

  it("checks allowlists against the selected sentence suffix", () => {
    const text = "foo.invalid. evil.com";
    const suffix = "evil.com";
    const suffixStart = Array.from(text.slice(0, text.indexOf(suffix))).length;
    const input = { text, codePoints: Array.from(text) };
    const cases = [
      {
        allowedDomains: [] as string[],
        ranges: [[suffixStart, Array.from(text).length]],
        censored: `foo.invalid. ${mask(suffix)}`,
      },
      {
        allowedDomains: ["foo.invalid.evil.com"],
        ranges: [[suffixStart, Array.from(text).length]],
        censored: `foo.invalid. ${mask(suffix)}`,
      },
      {
        allowedDomains: [suffix],
        ranges: [[0, Array.from(text).length]],
        censored: mask(text),
      },
      {
        allowedDomains: ["foo.invalid.evil.com", suffix],
        ranges: [] as Array<readonly [number, number]>,
        censored: text,
      },
    ] as const;

    for (const { allowedDomains, ranges, censored } of cases) {
      const scanner = createUrlScanner({ allowedDomains });
      const seen: Array<readonly [number, number]> = [];

      expect(scanner.scan(input)).toEqual({ ranges });
      expect(scanner.check(input)).toBe(ranges.length > 0);
      expect(
        scanner.scan(input, (match) => {
          seen.push(match.range);
          return false;
        }),
      ).toBe(ranges.length === 0);
      expect(seen).toEqual(ranges.slice(0, 1));
      expect(createUrlFilter({ allowedDomains }).censor(text)).toBe(censored);
    }

    for (const sentenceText of [
      "foo.invalid﹒ evil.com",
      "foo.invalid.” evil.com",
    ]) {
      const sentenceSuffixStart = Array.from(
        sentenceText.slice(0, sentenceText.indexOf(suffix)),
      ).length;
      const scanner = createUrlScanner({
        allowedDomains: ["foo.bar.evil.com"],
      });

      expect(
        scanner.scan({
          text: sentenceText,
          codePoints: Array.from(sentenceText),
        }),
      ).toEqual({
        ranges: [[sentenceSuffixStart, Array.from(sentenceText).length]],
      });
      expect(
        createUrlFilter({ allowedDomains: ["foo.bar.evil.com"] }).censor(
          sentenceText,
        ),
      ).toBe(
        sentenceText.slice(0, sentenceText.indexOf(suffix)) + mask(suffix),
      );
    }

    const spacedSubdomain = "foo. bar.evil.com";
    expect(
      createUrlScanner({ allowedDomains: ["foo.bar.evil.com"] }).scan({
        text: spacedSubdomain,
        codePoints: Array.from(spacedSubdomain),
      }),
    ).toEqual({ ranges: [] });
    expect(
      createUrlFilter({ allowedDomains: ["foo.bar.evil.com"] }).censor(
        spacedSubdomain,
      ),
    ).toBe(spacedSubdomain);
    expect(
      createUrlFilter({ allowedDomains: ["bar.evil.com"] }).censor(
        spacedSubdomain,
      ),
    ).toBe(mask(spacedSubdomain));
  });

  it("recognizes normalized full stops as sentence boundaries", () => {
    for (const fullStop of [
      ".",
      "。",
      "｡",
      "．",
      "﹒",
      "․",
      "‥",
      "…",
      "︙",
      "︰",
    ]) {
      const domain = "example.com";
      const text = `Hello${fullStop} ${domain}`;
      const start = Array.from(text.slice(0, text.indexOf(domain))).length;

      expect(scanUrlRanges(text)).toEqual([
        [start, start + Array.from(domain).length],
      ]);
      expect(createUrlFilter().censor(text)).toBe(
        `Hello${fullStop} ${mask(domain)}`,
      );
    }
  });

  it("keeps sentence closers outside following bare domains", () => {
    for (const closer of ['"', "'", "”", "’", "»", ")", "]", "}", "」", "』"]) {
      const domain = "example.com";
      const prefix = `Hello.${closer} `;
      const text = prefix + domain;

      expect(scanUrlRanges(text)).toEqual([
        [Array.from(prefix).length, Array.from(text).length],
      ]);
      expect(createUrlFilter().censor(text)).toBe(prefix + mask(domain));
    }
  });

  it("keeps obfuscated non-sentence dots inside domain ranges", () => {
    for (const dot of ["·", "•", "⋅", "・"]) {
      const text = `evil${dot} sub.example.com`;

      expect(scanUrlRanges(text)).toEqual([[0, Array.from(text).length]]);
      expect(createUrlFilter().censor(text)).toBe(mask(text));
    }
  });

  it("classifies whitespace-wrapped list bullets by parsed URL context", () => {
    const prose = [
      "She was shooting daggers at me • Me reading chapter 1",
      "me • Me",
      "info • Info follows",
      "me • Me.",
      "me • Me。",
      "me \u200b•\u200b Me",
      "me\u00a0•\u00a0Me",
      "me •\ufe0f Me",
      "me \ufe0f•\ufe0e Me",
      "me \u{e0100}•\u{e0100} Me",
      "foo-bar • Foo-bar follows",
      "भारत • भारत",
      "कॉम • कॉम",
      "বাংলা • বাংলা",
      "info • Info: details",
      "me • Me?",
      "me • Me?.",
      "me • Me?\u200b",
      "me • Me?\ufe0f.",
      "me • Me?#\u200b",
      "me • Me#\u200b",
      "me • Me:4x",
      "gg • GG#",
      "hello. me • me",
      "hello。 me • me",
      "hello.” me • me",
      "hello.\ufe0f me • me",
      "hello.\u{e0100} me • me",
    ];
    const domains = [
      "example•com",
      "example •com",
      "example• com",
      "example • com",
      "example •\ufe0f com",
      "example \ufe0f•\ufe0e com",
      "example\u200b•\u200bcom",
      "example · com",
      "example ⋅ com",
      "example ・ com",
      "m e • me",
      "me • m e",
      "m_e • me",
      "me- • me",
      "me_ • me",
      "me • -me",
      "me • _me",
      "example.com.\ufe0f/path",
      "example.com.\u{e0100}/path",
      "me • me/path",
      "me • me\ufe0f/path",
      "me • me\u{e0100}/path",
      "me • me\u200b?x=1",
      "me •\ufe0f me\\path",
      "gg \ufe0f•\ufe0e gg#frag",
      "info • info?x=1",
      "me • me:443/path",
    ];

    for (const text of prose) expectScannerFixture({ text, ranges: [] });
    for (const text of domains) {
      expectScannerFixture({ text, ranges: wholeRange(text) });
    }
    for (const selector of ["\ufe0f", "\u{e0100}"]) {
      for (const text of [
        `me • me:${selector}443/path`,
        `me • me:4${selector}43/path`,
        `me • me:443${selector}/path`,
      ]) {
        expectScannerFixture({ text, ranges: wholeRange(text) });
      }
    }
    expectScannerFixture({ text: "me • Me. example.com", ranges: [[9, 20]] });
    for (const text of ["info • info-other", "info • info\u200b-other"]) {
      expectScannerFixture({ text, ranges: [[0, 11]] });
    }
    for (const text of [
      "me • me\u200bx",
      "me • me\ufe0fx",
      "me • me\u200b_x",
    ]) {
      expectScannerFixture({ text, ranges: [[0, 7]] });
    }
    expectScannerFixture({
      text: "hello. me • me. example.com",
      ranges: [[16, 27]],
    });
    for (const text of [
      "example.com • net",
      "example.com • next",
      "example.com •\ufe0f next",
    ]) {
      expectScannerFixture({ text, ranges: [[0, 11]] });
    }
    for (const dot of ["·", "⋅", "・"]) {
      expectScannerFixture({ text: `evil.com ${dot} next`, ranges: [[0, 8]] });
    }
    for (const dot of ["•", "·", "⋅", "・"]) {
      expectScannerFixture({ text: `evil.com${dot} next`, ranges: [[0, 8]] });
    }
    for (const text of ["evil.com•\ufe0f next", "evil.com\ufe0f•\ufe0f next"]) {
      expectScannerFixture({ text, ranges: [[0, 8]] });
    }
    for (const dot of ["[.]", "dot", "d o t", "точка"]) {
      expectScannerFixture({ text: `evil.com ${dot} next`, ranges: [[0, 8]] });
    }
    expectScannerFixture({
      text: "example.com • next",
      ranges: [],
      allowedDomains: ["example.com"],
    });
  });

  it("detects biz domains through every scanner path", () => {
    const domain = "freeaccount.biz/path";
    const text = `visit ${domain} now`;
    const start = Array.from("visit ").length;
    const expected = [start, start + Array.from(domain).length] as const;
    const input = { text, codePoints: Array.from(text) };
    expectScannerFixture({ text, ranges: [expected] });
    expect(createUrlScanner({ tlds: ["com"] }).scan(input)).toEqual({
      ranges: [],
    });
    expectScannerFixture({
      text,
      ranges: [],
      allowedDomains: ["freeaccount.biz"],
    });
  });

  it("does not let repeated bullet labels broaden exact-host allowlists", () => {
    const cases = [
      {
        allowedDomain: "trusted.com",
        exactDomain: "trusted.trusted.com",
        candidates: [
          "trusted • trusted.com/path",
          "trusted •\ufe0f trusted.com/path",
          "trusted \ufe0f•\ufe0e trusted[.]com/path",
          "trusted • trusted dot com/path",
        ],
      },
      {
        allowedDomain: "foo-com.com",
        exactDomain: "foo.foo-com.com",
        candidates: [
          "foo • foo-com.com/path",
          "foo •\ufe0f foo-com.com/path",
          "foo \ufe0f•\ufe0e foo-com[.]com/path",
          "foo • foo-com dot com/path",
        ],
      },
      {
        allowedDomain: "trusted.me",
        exactDomain: "trusted.me.me",
        candidates: [
          "trusted.me • me",
          "trusted.me •\ufe0f me",
          "trusted[.]me • me",
          "trusted dot me • me",
          "trusted·me • me",
        ],
      },
    ] as const;

    for (const { allowedDomain, exactDomain, candidates } of cases) {
      for (const text of candidates) {
        expectScannerFixture({
          text,
          ranges: wholeRange(text),
          allowedDomains: [allowedDomain],
        });
      }

      expectScannerFixture({
        text: candidates[0],
        ranges: [],
        allowedDomains: [exactDomain],
      });
    }

    expectScannerFixture({
      text: "evil.com dot net",
      ranges: wholeRange("evil.com dot net"),
      allowedDomains: ["evil.com"],
    });
    expectScannerFixture({
      text: "evil.com dot net",
      ranges: [],
      allowedDomains: ["evil.com.net"],
    });
  });

  it("keeps adjacent URL ranges and allowlists independent", () => {
    const bare = "one.com two.com";
    const explicit = "https://one.com two.com";
    const shortBare = "one.com x.org";
    const shortExplicit = "https://one.com a.net";

    expect(scanUrlRanges(bare)).toEqual([
      [0, 7],
      [8, 15],
    ]);
    expect(scanUrlRanges(explicit)).toEqual([
      [0, 15],
      [16, 23],
    ]);
    expect(scanUrlRanges(shortBare)).toEqual([
      [0, 7],
      [8, 13],
    ]);
    expect(scanUrlRanges(shortExplicit)).toEqual([
      [0, 15],
      [16, 21],
    ]);
    expect(createUrlFilter({ allowedDomains: ["one.com"] }).censor(bare)).toBe(
      `one.com ${mask("two.com")}`,
    );
    expect(createUrlFilter({ allowedDomains: ["two.com"] }).censor(bare)).toBe(
      `${mask("one.com")} two.com`,
    );
    expect(
      createUrlFilter({ allowedDomains: ["one.com"] }).censor(explicit),
    ).toBe(`https://one.com ${mask("two.com")}`);
    expect(
      createUrlFilter({ allowedDomains: ["two.com"] }).censor(explicit),
    ).toBe(`${mask("https://one.com")} two.com`);
    expect(
      createUrlFilter({ allowedDomains: ["one.com"] }).censor(shortBare),
    ).toBe(`one.com ${mask("x.org")}`);
    expect(
      createUrlFilter({ allowedDomains: ["x.org"] }).censor(shortBare),
    ).toBe(`${mask("one.com")} x.org`);
    expect(
      createUrlFilter({ allowedDomains: ["one.com"] }).censor(shortExplicit),
    ).toBe(`https://one.com ${mask("a.net")}`);
    expect(
      createUrlFilter({ allowedDomains: ["a.net"] }).censor(shortExplicit),
    ).toBe(`${mask("https://one.com")} a.net`);

    const splitLabel = "one.com exa mple.com";
    expect(scanUrlRanges(splitLabel)).toEqual([
      [0, 7],
      [8, 20],
    ]);
    expect(
      createUrlFilter({ allowedDomains: ["example.com"] }).censor(splitLabel),
    ).toBe(`${mask("one.com")} exa mple.com`);
    expect(scanUrlRanges("go example.co m now")).toEqual([[3, 15]]);
  });

  it("does not split adjacent domains across non-whitespace separators", () => {
    const filter = createUrlFilter({
      allowedDomains: ["evil.com", "x.org", "s.org"],
    });
    for (const text of [
      "evil.com-x.org",
      "evil.com-x.org/path",
      "evil.com\u200bx.org",
      "evil.com\u200b-x.org",
      "evil.com-\u200bx.org",
      "evil.com\u200b_x.org",
      "evil.com's.org",
    ]) {
      const input = { text, codePoints: Array.from(text) };

      expect(scanUrlRanges(text)).toEqual([[0, Array.from(text).length]]);
      expect(createUrlScanner().check(input)).toBe(true);
      expect(filter.censor(text)).toBe(mask(text));
    }

    for (const text of [
      "evil.com-x.org",
      "evil.com-x.org/path",
      "evil.com\u200bx.org",
      "evil.com\u200b-x.org",
      "evil.com-\u200bx.org",
    ]) {
      const explicit = `https://${text}`;

      expect(scanUrlRanges(explicit)).toEqual([
        [0, Array.from(explicit).length],
      ]);
      expect(filter.censor(explicit)).toBe(mask(explicit));
    }

    const spaced = "evil.com\u200b x.org";
    expect(filter.censor(spaced)).toBe(spaced);
    expect(
      createUrlFilter({ allowedDomains: ["evil.com-x.org"] }).censor(
        "evil.com-x.org/path",
      ),
    ).toBe("evil.com-x.org/path");
    expect(
      createUrlFilter({ allowedDomains: ["evil.com-x.org"] }).censor(
        "evil.com\u200b-x.org",
      ),
    ).toBe("evil.com\u200b-x.org");
    expect(createUrlFilter().censor("evil.com\u200b,next")).toBe(
      `${mask("evil.com")}\u200b,next`,
    );
  });

  it("fails closed for allowlisted domains glued without whitespace", () => {
    const scanner = createUrlScanner({
      allowedDomains: ["evil.com", "x.org"],
    });
    const filter = createUrlFilter({
      allowedDomains: ["evil.com", "x.org"],
    });

    for (const separator of [
      "'",
      '"',
      ")",
      "]",
      "}",
      ",",
      ";",
      "(",
      "[",
      "\u200b,",
    ]) {
      const text = `https://evil.com${separator}x.org`;
      const input = { text, codePoints: Array.from(text) };
      const expectedRange = [0, Array.from(text).length] as const;

      expect(scanner.scan(input)).toEqual({ ranges: [expectedRange] });
      expect(scanner.check(input)).toBe(true);
      expect(filter.censor(text)).toBe(mask(text));
    }

    expect(filter.censor("https://evil.com x.org")).toBe(
      "https://evil.com x.org",
    );

    const glued = "https://evil.com,x.org";
    const suffixStart = Array.from("https://evil.com,").length;
    const firstOnly = createUrlScanner({ allowedDomains: ["evil.com"] });
    expect(
      firstOnly.scan({ text: glued, codePoints: Array.from(glued) }),
    ).toEqual({ ranges: [[suffixStart, Array.from(glued).length]] });
    expect(
      createUrlFilter({ allowedDomains: ["evil.com"] }).censor(glued),
    ).toBe(`https://evil.com,${mask("x.org")}`);
    expect(createUrlFilter({ allowedDomains: ["x.org"] }).censor(glued)).toBe(
      `${mask("https://evil.com")},x.org`,
    );
  });

  it("keeps long one-letter domain chains independent", () => {
    const domains = Array.from(
      { length: 100 },
      (_, index) => `${String.fromCharCode(97 + (index % 26))}.com`,
    );
    const text = domains.join(" ");
    let cursor = 0;
    const expected = domains.map((domain) => {
      const range = [cursor, cursor + domain.length] as const;
      cursor += domain.length + 1;
      return range;
    });

    expect(scanUrlRanges(text)).toEqual(expected);
    expect(createUrlFilter().censor(text)).toBe(
      domains.map((domain) => mask(domain)).join(" "),
    );
  });

  it("supports custom TLD configuration", () => {
    expect(scanUrlRanges("go svc.internal", new Set(["internal"]))).toEqual([
      [3, 15],
    ]);
    expect(scanUrlRanges("go svc.іnternal", new Set(["internal"]))).toEqual([
      [3, 15],
    ]);
    expect(scanUrlRanges("go svc.internal")).toEqual([]);
    expect(scanUrlRanges("go example.com", new Set(["internal"]))).toEqual([]);
  });

  it("keeps allowlist behavior aligned across scanner APIs", () => {
    const scanner = createUrlScanner({ allowedDomains: ["trusted.com"] });
    const allowedText = "visit trusted.com/path now";
    const spacedSubdomainText = "evil. trusted.com/path";
    const mixedText = "visit trusted.com/path and https://blocked.org/path now";
    const blocked = "https://blocked.org/path";
    const blockedStart = Array.from(
      mixedText.slice(0, mixedText.indexOf(blocked)),
    ).length;
    const blockedEnd = blockedStart + Array.from(blocked).length;
    const mixedInput = { text: mixedText, codePoints: Array.from(mixedText) };
    const seen: Array<readonly [number, number]> = [];

    expect(
      scanner.scan({ text: allowedText, codePoints: Array.from(allowedText) }),
    ).toEqual({ ranges: [] });
    expect(
      scanner.check({
        text: allowedText,
        codePoints: Array.from(allowedText),
      }),
    ).toBe(false);
    expect(scanner.scan(mixedInput)).toEqual({
      ranges: [[blockedStart, blockedEnd]],
    });
    expect(scanner.check(mixedInput)).toBe(true);
    expect(
      scanner.scan({
        text: spacedSubdomainText,
        codePoints: Array.from(spacedSubdomainText),
      }),
    ).toEqual({ ranges: [[0, Array.from(spacedSubdomainText).length]] });
    expect(
      createUrlFilter({ allowedDomains: ["trusted.com"] }).censor(
        spacedSubdomainText,
      ),
    ).toBe(mask(spacedSubdomainText));
    const exactSubdomainScanner = createUrlScanner({
      allowedDomains: ["evil.trusted.com"],
    });
    expect(
      exactSubdomainScanner.scan({
        text: spacedSubdomainText,
        codePoints: Array.from(spacedSubdomainText),
      }),
    ).toEqual({ ranges: [] });
    expect(
      createUrlFilter({ allowedDomains: ["evil.trusted.com"] }).censor(
        spacedSubdomainText,
      ),
    ).toBe(spacedSubdomainText);
    expect(
      scanner.scan(mixedInput, (match) => {
        seen.push(match.range);
      }),
    ).toBe(true);
    expect(seen).toEqual([[blockedStart, blockedEnd]]);
  });

  it("returns no ranges for clearly clean text", () => {
    const scanner = createUrlScanner();
    expect(
      scanner.scan({
        text: "plain words only",
        codePoints: Array.from("plain words only"),
      }),
    ).toEqual({ ranges: [] });
  });

  it("keeps obfuscated URL coverage through the scanner path", () => {
    const astralLetter = "\u{10437}";
    const cyrillicO = "\u043e";
    const rawDotWord = ["\u0442", "\u043e", "\u0447", "\u043a", "\u0430"].join(
      " ",
    );

    expect(scanUrlRanges(`${astralLetter}.com`)).toEqual([[0, 5]]);
    expect(scanUrlRanges("visit hxxp[:]//example[.]com")).toEqual([[6, 28]]);
    expect(scanUrlRanges("visit example dot com")).toEqual([[6, 21]]);
    expect(scanUrlRanges("visit example d o t com")).toEqual([[6, 23]]);
    expect(scanUrlRanges("visit example d-o-t com")).toEqual([[6, 23]]);
    expect(scanUrlRanges(`visit example d${cyrillicO}t com`)).toEqual([
      [6, 21],
    ]);
    expect(scanUrlRanges("visit example ( . ) com")).toEqual([[6, 23]]);
    expect(scanUrlRanges("visit example { . } com")).toEqual([[6, 23]]);
    expect(scanUrlRanges(`visit example ${rawDotWord} com`)).toEqual([[6, 27]]);
    expect(scanUrlRanges("example(.)com")).toEqual([[0, 13]]);
    expect(scanUrlRanges("example{.}com")).toEqual([[0, 13]]);
    expect(scanUrlRanges("example。com")).toEqual([[0, 11]]);
  });
});
