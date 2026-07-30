// Shared character classes keep parser modules aligned on what counts as URL
// syntax, prose punctuation, or obfuscation markers.
export const LETTER_OR_DIGIT_RE = /[\p{L}\p{N}]/u;
export const WHITESPACE_RE = /\s/u;

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
