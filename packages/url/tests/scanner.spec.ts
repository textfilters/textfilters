import { describe, expect, it } from "vitest";

import {
  checkUrlRanges,
  createUrlFilter,
  createUrlScanner,
  scanUrlRangeMatches,
  scanUrlRanges,
  type UrlRangeScanner,
  type UrlRangeScanResult,
  type UrlScanHints,
} from "../src/index.js";
import { mask } from "./helpers.js";

type Range = readonly [number, number];

interface ScannerFixture {
  readonly text: string;
  readonly ranges: readonly Range[];
  readonly allowedDomains?: readonly string[];
}

const wholeRange = (text: string): readonly Range[] => [
  [0, Array.from(text).length],
];

const maskRanges = (text: string, ranges: readonly Range[]): string => {
  const codePoints = Array.from(text);
  for (const [start, end] of ranges) {
    for (let index = start; index < end; index++) {
      codePoints[index] = "*".repeat(codePoints[index]?.length ?? 0);
    }
  }
  return codePoints.join("");
};

const expectScannerFixture = ({
  text,
  ranges,
  allowedDomains,
}: ScannerFixture): void => {
  const input = { text, codePoints: Array.from(text) };
  const scanner = createUrlScanner({ allowedDomains });
  const seen: Range[] = [];

  if (allowedDomains === undefined) {
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
  expect(createUrlFilter({ allowedDomains }).censor(text)).toBe(
    maskRanges(text, ranges),
  );
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

  it("does not let false shared hints hide source-only TLD glyphs", () => {
    const text = "x.ͺ";
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
    const scanner = createUrlScanner({ tlds: ["i"] });

    expect(scanner.check(input)).toBe(true);
    expect(scanner.scan(input)).toEqual({ ranges: wholeRange(text) });
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

  it("rejects delegated words after sentence-ending dots", () => {
    for (const sentenceStart of [
      "It",
      "In",
      "To",
      "Be",
      "Do",
      "Is",
      "At",
      "Travel",
      "Online",
      "Art",
      "Life",
      "Today",
    ]) {
      const text = `This is good. ${sentenceStart} is fine.`;
      expect(scanUrlRanges(text)).toEqual([]);
      expect(createUrlFilter().censor(text)).toBe(text);
    }

    for (const closer of ['"', "”", ")", "]"]) {
      const text = `This is good.${closer} It is fine.`;
      expect(scanUrlRanges(text)).toEqual([]);
      expect(createUrlFilter().censor(text)).toBe(text);

      const completedHostText = `Visit example.com.${closer} Today is fine.`;
      const hostStart = Array.from("Visit ").length;
      expectScannerFixture({
        text: completedHostText,
        ranges: [[hostStart, hostStart + Array.from("example.com").length]],
      });
    }

    for (const punctuation of [",", ";", ":", "!", "?", "…", "–", "—"]) {
      const text = `This is good. Today${punctuation} we leave.`;
      expect(scanUrlRanges(text), punctuation).toEqual([]);
      expect(createUrlFilter().censor(text), punctuation).toBe(text);
    }

    for (const text of [
      "This is good. Today. We leave.",
      "This is good. Today... we leave.",
      "This is good. Today. In another chapter.",
      "This is good. Today... in another chapter.",
      "This is good. Today.",
      "This is good. Travel!",
      "This is good. Today",
      "This is good. It's fine.",
      "This is good. Today’s plan works.",
      "This is good. It'll work.",
      "This is good. You’re fine.",
      "This is good. I'm ready.",
      "This is good. I’d agree.",
      "This is good. Can't wait.",
      "This is good. (Today is fine.)",
      "This is good. [Today is fine.]",
      "This is good. “Today is fine.”",
      "This is good. «Today is fine.»",
      "This is good. (“It'll work.”)",
      "This is good. — Today is fine.",
      "This is good. – Today is fine.",
      "This is good. ‐ Today is fine.",
      "This is good. - Today is fine.",
      "This is good. * Today is fine.",
      "This is good. **Today** is fine.",
      "This is good. > Today is fine.",
      "This is good. # Today is fine.",
      "This is good. • Today is fine.",
      "This is good. IT works.",
      "This is good. US teams agree.",
      "This is good. IN comes next.",
      "This is good. IT’LL work.",
      "This is good. YouTube works.",
      "This is good. GoDaddy works.",
      "This is good. PlayStation works.",
      "This is good. Today-based plans work.",
      "This is good. Art-based plans work.",
      "This is good. YouTube-based plans work.",
      "This is good. IT-based plans work.",
      "This is good. Today's-based plan works.",
      "الكلام جيد. مصر جميلة.",
      "内容很好. 中国 可以使用.",
      "ข้อความดี. ไทย ใช้งานได้.",
      "내용이 좋다. 한국 사용 가능.",
    ]) {
      expect(scanUrlRanges(text)).toEqual([]);
      expect(createUrlFilter().censor(text)).toBe(text);
    }

    const decomposedTitle = "Vermögensberater".normalize("NFD");
    const decomposedSentence = `Das ist gut. ${decomposedTitle} helfen.`;
    expect(scanUrlRanges(decomposedSentence)).toEqual([]);
    expect(createUrlFilter().censor(decomposedSentence)).toBe(
      decomposedSentence,
    );

    for (const domain of [
      "youtu. be",
      "example. Be/path",
      "example. com",
      "example. Travel/path",
      "example. travel",
      "example.COM",
      "example.TRAVEL",
      "example. مصر/path",
      "example. 中国/path",
    ]) {
      expect(createUrlFilter().censor(domain)).toBe(mask(domain));
    }

    const hyphenatedDomain = "Today-based.com";
    expect(
      createUrlFilter().censor(`This is good. ${hyphenatedDomain} works.`),
    ).toBe(`This is good. ${mask(hyphenatedDomain)} works.`);
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
        allowedDomains: ["foo.invalid.evil.com"],
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

  it("keeps multi-dot compatibility expansions as domain separators", () => {
    for (const dot of ["‥", "︰"]) {
      const text = `example${dot}com/path`;
      expectScannerFixture({ text, ranges: wholeRange(text) });
      expectScannerFixture({
        text,
        ranges: [],
        allowedDomains: [`example${dot}com`],
      });
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
      "example.com • net",
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
    for (const text of ["example.com • next", "example.com •\ufe0f next"]) {
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
      const text = `evil.com ${dot} next`;
      expectScannerFixture({ text, ranges: wholeRange(text) });
    }
    expectScannerFixture({
      text: "example.com • next",
      ranges: wholeRange("example.com • next"),
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

  it("detects delegated TLDs through every scanner path", () => {
    for (const domain of [
      "youtu.be/watch",
      "example.bar/path",
      "example.travel/path",
      "example.भारत/path",
      "example.বাংলা/path",
      "example.சிங்கப்பூர்/path",
    ]) {
      const text = `visit ${domain} now`;
      const start = Array.from("visit ").length;
      const expected = [start, start + Array.from(domain).length] as const;
      expectScannerFixture({ text, ranges: [expected] });
    }
  });

  it("does not broaden a delegated-domain allowlist through defanged continuations", () => {
    for (const separator of [
      "dot",
      "d o t",
      "точка",
      "[.]",
      "•",
      "·",
      "⋅",
      "・",
      ".",
    ]) {
      const text = `foo.travel ${separator} travel`;
      expectScannerFixture({
        text,
        ranges: wholeRange(text),
        allowedDomains: ["foo.travel"],
      });
      expectScannerFixture({
        text,
        ranges: [],
        allowedDomains: ["foo.travel.travel"],
      });
    }
  });

  it("normalizes canonically equivalent decoded IDN suffixes", () => {
    for (const suffix of ["한국", "онлайн", "vermögensberater"]) {
      const domain = `example.${suffix.normalize("NFD")}/path`;
      expectScannerFixture({ text: domain, ranges: wholeRange(domain) });
    }

    const allowed = `example.${"vermögensberater".normalize("NFD")}/path`;
    expectScannerFixture({
      text: allowed,
      ranges: [],
      allowedDomains: ["example.vermögensberater"],
    });
  });

  it("preserves compatibility expansions in delegated suffixes", () => {
    for (const suffix of ["coﬀee", "oﬃce", "ﬂowers"]) {
      const text = `example.${suffix}/path`;
      expectScannerFixture({ text, ranges: wholeRange(text) });
    }

    expectScannerFixture({
      text: "example.coﬀee/path",
      ranges: [],
      allowedDomains: ["example.coffee"],
    });
    expectScannerFixture({ text: "x.oﬃce", ranges: wholeRange("x.oﬃce") });
  });

  it("skips orphan combining marks at delegated-label starts", () => {
    for (const text of ["example.\u0301com", "example[.]\u0301com"]) {
      expectScannerFixture({ text, ranges: wholeRange(text) });
      expectScannerFixture({
        text,
        ranges: [],
        allowedDomains: ["example.com"],
      });
    }
  });

  it("keeps standalone leading marks outside bare-domain boundaries", () => {
    for (const prefix of ["\u0301", "text \u0301", "\ufe0f"]) {
      const domain = "example.com";
      const text = prefix + domain;
      const start = Array.from(prefix).length;
      expectScannerFixture({
        text,
        ranges: [[start, start + Array.from(domain).length]],
      });
    }

    const attached = "x\u0301example.com";
    expectScannerFixture({ text: attached, ranges: wholeRange(attached) });
    expectScannerFixture({
      text: `text ${attached}`,
      ranges: [
        [Array.from("text ").length, Array.from(`text ${attached}`).length],
      ],
    });
  });

  it("keeps variation selectors inside recoverable bare labels", () => {
    for (const text of ["e\ufe0fxample.com", "ex\ufe0fample[.]com"]) {
      expectScannerFixture({ text, ranges: wholeRange(text) });
      expectScannerFixture({
        text,
        ranges: [],
        allowedDomains: ["example.com"],
      });
    }

    const configured = "e\ufe0fxample.com";
    expectScannerFixture({
      text: configured,
      ranges: [],
      allowedDomains: [configured],
    });
  });

  it("keeps decoded IDN skeleton matching asymmetric", () => {
    for (const text of ["module.pyc", "service.kom"]) {
      expectScannerFixture({ text, ranges: [] });
    }

    for (const text of ["module.pус/path", "service.kом/path"]) {
      expectScannerFixture({ text, ranges: wholeRange(text) });
    }
  });

  it("preserves valid TLD prefixes before unsupported combining marks", () => {
    const domain = "example.com";
    for (const suffix of ["\u0301", "\u0301/path"]) {
      const text = domain + suffix;
      expectScannerFixture({
        text,
        ranges: [[0, Array.from(domain).length]],
      });
      expectScannerFixture({
        text,
        ranges: [[0, Array.from(domain).length]],
        allowedDomains: [domain],
      });
      expect(createUrlFilter().censor(text)).toBe(mask(domain) + suffix);
    }

    for (const formatting of ["\u200b", "\u200b\u2060", "\ufe0f\u200b"]) {
      const text = `${domain}${formatting}\u0301/path`;
      expectScannerFixture({
        text,
        ranges: [[0, Array.from(domain).length]],
        allowedDomains: [domain],
      });
    }
  });

  it("detects Unicode-confusable TLDs through every scanner path", () => {
    for (const domain of [
      "freeaccount.b\u0131z/path",
      "example.r\u03c5/path",
      "example.r\u0443/path",
      "example.onℐine/path",
      "example.inſo/path",
      "example.ſℐsh/path",
      "example.\u037anfo/path",
    ]) {
      const text = `visit ${domain} now`;
      const start = Array.from("visit ").length;
      const expected = [start, start + Array.from(domain).length] as const;
      expectScannerFixture({ text, ranges: [expected] });
    }

    expectScannerFixture({
      text: "youtu.b\u0435/watch",
      ranges: [[0, Array.from("youtu.b\u0435/watch").length]],
      allowedDomains: ["youtu.be"],
    });

    expectScannerFixture({ text: "example.ey/path", ranges: [] });
    expectScannerFixture({
      text: "example.\uff45\uff59/path",
      ranges: [],
    });
    expectScannerFixture({ text: "example.onIine/path", ranges: [] });
    expectScannerFixture({ text: "example.inso/path", ranges: [] });
  });

  it("does not broaden allowlists before confusable TLD continuations", () => {
    for (const { text, exactAllowedDomain } of [
      {
        text: "foo.com • c\u03bfm",
        exactAllowedDomain: "foo.com.c\u03bfm",
      },
      { text: "foo.com • inſo", exactAllowedDomain: "foo.com.inso" },
    ]) {
      expectScannerFixture({
        text,
        ranges: wholeRange(text),
        allowedDomains: ["foo.com"],
      });
      expectScannerFixture({
        text,
        ranges: [],
        allowedDomains: [exactAllowedDomain],
      });
    }
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
  });

  it("recovers a repeated bullet host before a delegated continuation", () => {
    for (const separator of ["[.]", "•", "·", "⋅", "・", "."]) {
      const text = `foo • foo ${separator} travel`;
      expectScannerFixture({ text, ranges: wholeRange(text) });
    }
  });

  it("recovers one-character delegated continuations during ordinary scans", () => {
    for (const separator of ["•", "·", "⋅", "・", "."]) {
      const text = `foo.travel ${separator} travel`;
      expectScannerFixture({ text, ranges: wholeRange(text) });
    }
  });

  it("recovers canonically equivalent repeated delegated continuations", () => {
    const composed = "vermögensberater";
    const decomposed = composed.normalize("NFD");
    for (const [first, second] of [
      [composed, decomposed],
      [decomposed, composed],
    ] as const) {
      for (const separator of ["•", "·", "⋅", "・", "."]) {
        const text = `foo.${first} ${separator} ${second}`;
        expectScannerFixture({ text, ranges: wholeRange(text) });
      }
    }
  });

  it("recovers confusable repeated delegated continuations", () => {
    for (const [first, second] of [
      ["ru", "rυ"],
      ["rυ", "ru"],
    ] as const) {
      for (const separator of ["•", "·", "⋅", "・", "."]) {
        const text = `foo.${first} ${separator} ${second}`;
        expectScannerFixture({ text, ranges: wholeRange(text) });
      }
    }
  });

  it("keeps a real sentence dot outside an exact allowlist continuation", () => {
    expectScannerFixture({
      text: "example.com. next",
      ranges: [],
      allowedDomains: ["example.com"],
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
    expect(scanUrlRanges("go svc.internal")).toEqual([]);
    expect(scanUrlRanges("go example.com", new Set(["internal"]))).toEqual([]);

    for (const tlds of [[], [""], [" "], ["", "\t"]]) {
      expect(createUrlFilter({ tlds }).censor("example.com")).toBe(
        mask("example.com"),
      );
    }

    const continuation = "foo.internal dot corp";
    const scanner = createUrlScanner({ tlds: ["internal", "corp"] });
    expect(
      scanner.scan({
        text: continuation,
        codePoints: Array.from(continuation),
      }),
    ).toEqual({ ranges: wholeRange(continuation) });
    expect(
      createUrlFilter({ tlds: ["internal", "corp"] }).censor(continuation),
    ).toBe(mask(continuation));

    const mutableTlds = new Set(["internal"]);
    expect(scanUrlRanges("svc.internal", mutableTlds)).toEqual([[0, 12]]);
    mutableTlds.delete("internal");
    mutableTlds.add("corp");
    expect(scanUrlRanges("svc.internal", mutableTlds)).toEqual([]);
    expect(scanUrlRanges("svc.corp", mutableTlds)).toEqual([[0, 8]]);
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
