// Shared character classes keep parser modules aligned on what counts as URL
// syntax, prose punctuation, or obfuscation markers.
export const LETTER_OR_DIGIT_RE = /[\p{L}\p{N}]/u;
export const COMBINING_MARK_RE = /\p{M}/u;
export const WHITESPACE_RE = /\s/u;

// Use the NFKC-normalized raw view so compatibility full stops such as U+FE52
// and U+2024 behave like their ASCII or ideographic sentence punctuation while
// middle-dot characters remain obfuscated domain separators.
export const isSentenceDotSymbol = (value: string): boolean =>
  value === "." || value === "。";

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

export const LOOKALIKE_TO_ASCII: ReadonlyMap<string, string> = new Map([
  ["ı", "i"],
  ["α", "a"],
  ["β", "b"],
  ["ϲ", "c"],
  ["ε", "e"],
  ["ι", "i"],
  ["κ", "k"],
  ["μ", "m"],
  ["ν", "v"],
  ["ο", "o"],
  ["ρ", "p"],
  ["τ", "t"],
  ["υ", "u"],
  ["χ", "x"],
  ["а", "a"],
  ["в", "b"],
  ["с", "c"],
  ["ԁ", "d"],
  ["е", "e"],
  ["н", "h"],
  ["і", "i"],
  ["ј", "j"],
  ["к", "k"],
  ["м", "m"],
  ["о", "o"],
  ["р", "p"],
  ["ѕ", "s"],
  ["т", "t"],
  ["у", "y"],
  ["х", "x"],
  ["ԛ", "q"],
  ["ԝ", "w"],
  ["ё", "e"],
]);

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
