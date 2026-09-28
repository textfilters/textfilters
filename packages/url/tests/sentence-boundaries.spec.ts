import { describe, expect, it } from "vitest";

import { createUrlFilter } from "../src/index.js";
import { createUrlScanner } from "../src/scanner.js";
import { mask, scanRanges } from "./helpers.js";

const asciiClosers = [")", "]", "}", ">", '"', "'", "`"];
const unicodeClosers = ["”", "’", "»", "」", "』", "〉", "】", "）", "＞"];
const sentenceEndings = (closer: string): string[] => [
  `${closer}. `,
  `${closer} . `,
  ` ${closer}. `,
  ` ${closer} . `,
  `.${closer} `,
  `. ${closer} `,
  ` .${closer} `,
  ` . ${closer} `,
];
const asciiEndings = asciiClosers.flatMap(sentenceEndings);
const endings = [
  ...asciiEndings,
  ...unicodeClosers.flatMap(sentenceEndings),
  ") . ” ",
  ")). ",
  ")。 ",
  " ) ． ",
  "\u200b)\ufe0f.\u200b ",
  ")\u00a0.\ufe0f\u00a0",
  "\t.\u200b>\n",
  " .\u{e0100}”\u00a0",
];

type ExpectedMatch = {
  start: number;
  end: number;
  value: string;
  filter: "url";
};

function verify(
  text: string,
  values: readonly string[],
  allowedDomains: readonly string[] = [],
): void {
  const filter = createUrlFilter({ allowedDomains });
  const matches: ExpectedMatch[] = values.map((value) => {
    const start = text.indexOf(value);
    expect(start).toBeGreaterThanOrEqual(0);
    return { start, end: start + value.length, value, filter: "url" };
  });
  let censored = text;
  for (const { start, end, value } of [...matches].reverse()) {
    censored = censored.slice(0, start) + mask(value) + censored.slice(end);
  }
  expect(filter.check(text)).toBe(matches.length > 0);
  expect(filter.find(text)).toEqual(matches);
  expect(filter.process(text)).toEqual({ censored, matches });
  expect(filter.censor(text)).toBe(censored);
  expect(filter.censor(censored)).toBe(censored);
  expect(censored.length).toBe(text.length);

  const scanner = createUrlScanner({ allowedDomains });
  const ranges = matches.map(({ start, end }) => [
    Array.from(text.slice(0, start)).length,
    Array.from(text.slice(0, end)).length,
  ]);
  expect(scanner.check({ text })).toBe(matches.length > 0);
  expect(scanRanges(scanner, { text })).toEqual({ ranges });
  const first: (readonly [number, number])[] = [];
  expect(
    scanner.scan({ text }, ({ range }) => {
      first.push(range);
      return false;
    }),
  ).toBe(matches.length === 0);
  expect(first).toEqual(ranges.slice(0, 1));
}

describe("closed sentence boundaries", () => {
  it("preserves the reported emoji message", () => {
    verify(
      "🙂‍↕️😌 тоже. Пиксельный должен быть 🙂‍↕️, а вот 😌 ( название: расслабленное лицо). Вот ты мастер путател",
      [],
    );
  });

  it.each(endings)("ends a host at %j before allowlist selection", (ending) => {
    const prefix = `😌 docs${ending}`;
    verify(prefix + "Bot", []);
    for (const suffix of ["example.com", "example.com/path?x=1#part"]) {
      const text = prefix + suffix;
      verify(text, [suffix]);
      verify(text, [suffix], ["docs.example.com"]);
      verify(text, [], ["example.com"]);
      verify(text, [], ["docs.example.com", "example.com"]);
    }
  });

  it.each(endings)(
    "keeps domains on both sides of %j independent",
    (ending) => {
      const text = `😌 one.com${ending}evil.org`;
      verify(text, ["one.com", "evil.org"]);
      verify(text, ["evil.org"], ["one.com"]);
      verify(text, ["one.com"], ["evil.org"]);
      verify(text, [], ["one.com", "evil.org"]);
      verify(text, ["one.com", "evil.org"], ["one.com.evil.org"]);
    },
  );

  it.each([
    "example . com",
    "example).com",
    "example).com/path",
    "example[.]com",
    "example [.] com",
    "example (.) com",
    "example <.> com",
    "example dot com",
    "example точка com",
    "example· com",
    "example.вот",
    "https://example. com/path",
    "https://example [.] com/path",
    "hxxp://example[.]com/path",
  ])("preserves URL syntax without a closed sentence: %s", (text) => {
    verify(text, [text]);
  });

  it.each([
    "example). com/path",
    "example .) com/path",
    "<word>. Bot",
    "word .) Bot",
    "word .” Bot",
  ])(
    "does not let following path-like prose undo a sentence boundary: %s",
    (text) => verify(text, []),
  );

  it("preserves the existing plain spaced-dot allowlist policy", () => {
    const text = "foo. bar.example.com";
    verify(text, [], ["foo.bar.example.com"]);
    verify(text, [text], ["bar.example.com"]);
  });

  it.each(["b-", "b_", "b--_", "b+", "b~", "b%", "b=", "e\u0301-", "e\u0301_"])(
    "recognizes punctuation independently of the continued label %s",
    (label) => {
      for (const dots of [
        ".",
        "..",
        "...",
        "‥",
        "…",
        ".．.",
        ".\u200b.\ufe0f.",
        ". .",
      ]) {
        for (const ending of [
          `)${dots} `,
          ` ${dots}) `,
          `> ${dots} `,
          `${dots} ” `,
        ]) {
          const prefix = `😌 http://a ${label}${ending}`;
          verify(prefix + "Bot", ["http://a"]);
          verify(prefix + "evil.org/path", ["http://a", "evil.org/path"]);
          verify(prefix + "evil.org/path", ["http://a"], ["evil.org"]);
          verify(
            prefix + "evil.org/path",
            ["http://a", "evil.org/path"],
            ["ab.evil.org"],
          );
        }
      }
    },
  );

  it.each([
    "[.]",
    "(.)",
    "{.}",
    "<.>",
    "( . )",
    "[ . ]",
    "{ . }",
    "< . >",
    "［．］",
    "（．）",
    "｛．｝",
    "＜．＞",
  ])("keeps the neighboring dot marker %s atomic", (marker) => {
    const text = `http://a b${marker}. com`;
    verify(text, [text]);
    const url = `example ${marker} com`;
    verify(`${url})... evil.org`, [url, "evil.org"]);
  });

  it("preserves whitespace between sentence dots", () => {
    verify("http://a b). .evil.org", ["http://a", "evil.org"]);
    verify("http://a. .) evil.org", ["http://a", "evil.org"]);
  });

  it.each(["http://a b...evil.org", "http://a b-).evil.org"])(
    "preserves continuation without sentence spacing: %s",
    (text) => verify(text, [text]),
  );

  it.each([
    "é",
    "e\u0301",
    "ḗ",
    "e\u0304\u0301",
    "ế",
    "e\u0302\u0301",
    "ש\u05b8",
    "e\u{1d185}",
  ])("keeps attached marks inside a continued host label: %s", (label) => {
    for (const separator of [".", "[.]", ")."]) {
      const text = `http://a ${label}${separator}com/path`;
      verify(text, [text]);
    }
    for (const ending of asciiEndings) {
      for (const url of ["http://a", "hxxp://a"]) {
        const prefix = `😌 ${url} ${label}${ending}`;
        verify(prefix + "Bot", [url]);
        const text = prefix + "evil.org/path";
        verify(text, [url, "evil.org/path"]);
        verify(text, [url], ["evil.org"]);
        verify(
          text,
          [url, "evil.org/path"],
          [`a${label.normalize("NFC")}.evil.org`],
        );
      }
    }
  });

  it.each(["http://abc", "https://example.com", "hxxp://example[.]com"])(
    "keeps a following domain separate from explicit URL %s",
    (url) => {
      const host = url === "http://abc" ? "abc" : "example.com";
      // Explicit authorities retain their existing Unicode punctuation rules.
      // Exercise the shared joining boundary with ASCII authority delimiters.
      for (const ending of asciiEndings) {
        for (const suffix of ["evil.org/path", "evil.org:8080?x=1#part"]) {
          const text = `${url}${ending}${suffix}`;
          verify(text, [url, suffix]);
          verify(text, [url, suffix], [`${host}.evil.org`]);
          verify(text, [url], ["evil.org"]);
          // Single-label explicit hosts are not eligible for domain allowlists.
          if (host !== "abc") {
            verify(text, [suffix], [host]);
            verify(text, [], [host, "evil.org"]);
          }
        }
      }
    },
  );
});
