import { domainToUnicode } from "node:url";

import { describe, expect, it } from "vitest";

import {
  checkUrlRanges,
  createUrlFilter,
  scanUrlRangeMatches,
  scanUrlRanges,
} from "../src/index.js";
import { DOT_CHAR_SET, LOOKALIKE_TO_ASCII } from "../src/chars.js";
import { toSkeleton } from "../src/meta.js";
import { DEFAULT_TLDS } from "../src/tlds.js";
import { mask } from "./helpers.js";

type Range = readonly [number, number];

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

describe("TLD matching", () => {
  it("keeps the embedded root-zone snapshot normalized, unique, and paired", () => {
    const tlds = new Set(DEFAULT_TLDS);
    const asciiTlds = DEFAULT_TLDS.filter((tld) => /^[a-z0-9-]+$/u.test(tld));
    const punycodeTlds = asciiTlds.filter((tld) => tld.startsWith("xn--"));
    const unicodeTlds = DEFAULT_TLDS.filter(
      (tld) => !/^[a-z0-9-]+$/u.test(tld),
    );

    expect(DEFAULT_TLDS).toHaveLength(1_589);
    expect(tlds.size).toBe(DEFAULT_TLDS.length);
    expect(asciiTlds).toHaveLength(1_438);
    expect(punycodeTlds).toHaveLength(151);
    expect(unicodeTlds).toHaveLength(151);
    expect(new Set(DEFAULT_TLDS.map((tld) => tld.normalize("NFKC"))).size).toBe(
      DEFAULT_TLDS.length,
    );
    expect(new Set(punycodeTlds.map(domainToUnicode))).toEqual(
      new Set(unicodeTlds),
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

  it("applies the ambiguous final-suffix policy to every default TLD", () => {
    const failures = createFailureRecorder();

    for (const tld of DEFAULT_TLDS) {
      const candidate = `Use e.g. ${tld}`;
      const text = `${candidate} prose`;
      const expectedBlockedRange = wholeRange(candidate);
      const preservedRanges = scanUrlRanges(text);
      const blockedRanges = scanUrlRanges(
        text,
        undefined,
        undefined,
        undefined,
        "block",
      );
      if (
        preservedRanges.length > 0 ||
        !rangesEqual(blockedRanges, expectedBlockedRange)
      ) {
        failures.record({
          tld,
          preservedRanges,
          blockedRanges,
          expectedBlockedRange,
        });
      }
    }

    expect(failures.result()).toEqual({ failures: 0, samples: [] });
  });

  it("applies the label length limit after whole-label normalization", () => {
    const composed = `${"é".repeat(50)}.com`;
    const decomposed = composed.normalize("NFD");
    const astral = `${"\u{10437}".repeat(63)}.com`;
    const explicitAstral = `https://${"\u{10437}".repeat(63)}.unknown`;
    const explicitMaxAstralHostname = `https://${[
      "\u{10437}".repeat(63),
      "\u{10437}".repeat(63),
      "\u{10437}".repeat(63),
      "\u{10437}".repeat(61),
    ].join(".")}`;
    const explicitOverlongAstralHostname = `https://${[
      "\u{10437}".repeat(63),
      "\u{10437}".repeat(63),
      "\u{10437}".repeat(63),
      "\u{10437}".repeat(62),
    ].join(".")}`;
    const explicitFourMaxAstralLabels = `https://${Array.from(
      { length: 4 },
      () => "\u{10437}".repeat(63),
    ).join(".")}`;
    const overlong = `${"a".repeat(64)}.com`;
    const overlongDecomposed = `${"é".repeat(64)}.com`.normalize("NFD");
    const overlongAstral = `${"\u{10437}".repeat(64)}.com`;
    const explicitOverlongAstral = `https://${"\u{10437}".repeat(64)}.unknown`;

    expect(scanUrlRanges(composed)).toEqual(wholeRange(composed));
    expect(scanUrlRanges(decomposed)).toEqual(wholeRange(decomposed));
    expect(scanUrlRanges(astral)).toEqual(wholeRange(astral));
    expect(scanUrlRanges(explicitAstral)).toEqual(wholeRange(explicitAstral));
    expect(scanUrlRanges(explicitMaxAstralHostname)).toEqual(
      wholeRange(explicitMaxAstralHostname),
    );
    expect(createUrlFilter({ allowedDomains: [astral] }).censor(astral)).toBe(
      astral,
    );
    expect(createUrlFilter().censor(decomposed)).toBe(mask(decomposed));
    expect(scanUrlRanges(overlong)).toEqual([]);
    expect(scanUrlRanges(overlongDecomposed)).toEqual([]);
    expect(scanUrlRanges(overlongAstral)).toEqual([]);
    expect(scanUrlRanges(explicitOverlongAstral)).toEqual([]);
    expect(scanUrlRanges(explicitOverlongAstralHostname)).toEqual([]);
    expect(scanUrlRanges(explicitFourMaxAstralLabels)).toEqual([]);
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
      const listedTlds = new Set([configured]);
      const input = { text, codePoints: Array.from(text) };
      const seen: Range[] = [];

      expect(scanUrlRanges(text, listedTlds)).toEqual(wholeRange(text));
      expect(checkUrlRanges(input, listedTlds)).toBe(true);
      expect(
        scanUrlRangeMatches(
          input,
          (match) => {
            seen.push(match.range);
          },
          listedTlds,
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

  it("derives low-level lookalike targets only from listed TLDs", () => {
    const assertApis = (
      text: string,
      listedTlds: ReadonlySet<string>,
      suppliedTargets: ReadonlySet<string>,
      expected: readonly Range[],
    ): void => {
      const input = { text, codePoints: Array.from(text) };
      const seen: Range[] = [];

      expect(scanUrlRanges(text, listedTlds, suppliedTargets)).toEqual(
        expected,
      );
      expect(checkUrlRanges(input, listedTlds, suppliedTargets)).toBe(
        expected.length > 0,
      );
      expect(
        scanUrlRangeMatches(
          input,
          (match) => {
            seen.push(match.range);
          },
          listedTlds,
          suppliedTargets,
        ),
      ).toBe(true);
      expect(seen).toEqual(expected);
    };

    const lookalike = "x.cοm";
    assertApis(lookalike, new Set(["com"]), new Set(), wholeRange(lookalike));
    assertApis("x.com", new Set(["рус"]), new Set(["com"]), []);
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

    expect(scanUrlRanges(text)).toEqual(ranges);
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
});
