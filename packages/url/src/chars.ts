// Shared character classes keep parser modules aligned on what counts as URL
// syntax, prose punctuation, or obfuscation markers.
export const LETTER_OR_DIGIT_RE = /^[\p{L}\p{N}]$/u;
export const HOST_LABEL_CHAR_RE =
  /^(?![\u{fe00}-\u{fe0f}\u{e0100}-\u{e01ef}])[\p{L}\p{M}\p{N}]$/u;
export const UNICODE_MARK_RE = /^\p{M}$/u;
export const WHITESPACE_RE = /\s/u;

// Use the NFKC-normalized raw view so compatibility full stops such as U+FE52
// and U+2024 behave like their ASCII or ideographic sentence punctuation while
// middle-dot characters remain obfuscated domain separators.
export const isSentenceDotSymbol = (value: string): boolean =>
  /^\.+$/u.test(value) || value === "。";

export const PATH_START_CHARS = new Set([":", "/", "?", "#"]);
export const PATH_TRAILING_CHARS = new Set([
  ".",
  ",",
  "!",
  "?",
  ";",
  ":",
  ")",
  "]",
  "}",
  ">",
  '"',
  "'",
  "`",
  "”",
  "’",
]);
export const PATH_GLUED_PROSE_CHARS = new Set([",", "!"]);

export const AUTHORITY_TRAILING_CHARS = new Set([
  ".",
  ",",
  "!",
  "?",
  ";",
  ":",
  ")",
  "]",
  "}",
  ">",
  '"',
  "'",
  "`",
  "”",
  "’",
  "»",
]);
export const AUTHORITY_GLUED_PROSE_CHARS = new Set([
  ".",
  ",",
  "!",
  ";",
  ":",
  ")",
  "}",
  ">",
]);

export const DOT_LITERALS = ["[.]", "(.)", "{.}", "<.>"] as const;
export const DOT_WORDS_SKELETON = ["dot", "d0t"] as const;
export const DOT_WORDS_RAW = ["точка"] as const;

export const HTTP_CHARS = ["h", "t", "t", "p"] as const;
export const HXXP_CHARS = ["h", "x", "x", "p"] as const;
export const HTTPS_SUFFIX_CHARS = ["s"] as const;
export const HTTPS_CHARS = [...HTTP_CHARS, ...HTTPS_SUFFIX_CHARS] as const;
export const HXXPS_CHARS = [...HXXP_CHARS, ...HTTPS_SUFFIX_CHARS] as const;

export const DEFANGED_DELIMITER_PAIRS = new Map([
  ["[", "]"],
  ["(", ")"],
  ["{", "}"],
  ["<", ">"],
]);

export const LOOKALIKE_TO_ASCII: Readonly<Record<string, string>> = {
  а: "a",
  в: "b",
  с: "c",
  е: "e",
  н: "h",
  і: "i",
  ј: "j",
  к: "k",
  м: "m",
  о: "o",
  р: "p",
  т: "t",
  у: "y",
  х: "x",
  ё: "e",
};

export const DOT_CHAR_SET = new Set([
  ".",
  "。",
  "｡",
  "．",
  "·",
  "•",
  "⋅",
  "・",
]);
