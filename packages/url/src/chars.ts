// Shared character classes keep parser modules aligned on what counts as URL
// syntax, prose punctuation, or obfuscation markers.
export const LETTER_OR_DIGIT_RE = /[\p{L}\p{N}]/u;
export const COMBINING_MARK_RE = /\p{M}/u;
export const WHITESPACE_RE = /\s/u;

// Use the NFKC-normalized raw view so compatibility full stops such as U+FE52
// and U+2024 behave like their ASCII or ideographic sentence punctuation while
// middle-dot characters remain obfuscated domain separators.
const SENTENCE_DOT_SYMBOLS = new Set([".", "。", "܁", "܂", "꘎", "𐩐"]);

export const isSentenceDotSymbol = (value: string): boolean =>
  SENTENCE_DOT_SYMBOLS.has(value);

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

// Unicode 17.0.0 UTS #39 confusables snapshot dated 2025-07-22. The groups
// contain single-code-point letters after lowercase NFKC normalization and
// intentionally target ASCII letters only. Ambiguous case-folded entries keep
// the package's established mapping direction; `ё` preserves legacy behavior.
// Source: https://www.unicode.org/Public/security/latest/confusables.txt
const LOOKALIKE_GROUPS = [
  ["a", "ɑαаꭺᗅꓮ𖽀𐊠"],
  ["b", "ƅьꮟᑲᖯ𖻑ꞵβⲃвᏼᗷꓐ𐊂𐊡𐌁"],
  ["c", "ᴄςⲥсငၚꮯ𐐽ꓚ𐊢𐌂𐔜"],
  ["d", "ԁꮷᑯꓒꭰᗞᗪꓓ"],
  ["e", "ꬲеҽεⴹꭼꓰ𑣆𑣎𐊆ё"],
  ["f", "ꬵꞙƒẝքϝᖴꓝ𑣂𐊇𐊥𐔥"],
  ["g", "ɡᶃƍցԍꮐᏻꓖ"],
  ["h", "һհꮒηⲏнꮋᕼꓧ𐋏"],
  ["i", "ıɪɩιⲓіꙇւꭵ𑣃"],
  ["j", "ϳјʝꭻᒍꓙ"],
  ["k", "κⲕкꮶᛕꓗ𐔘"],
  ["l", "ǀӏוןاߊⵏᛁꓲ𖼨𐊊𐌉𑷚𖻅ⳑꮮᒪꓡ𖼖𑣒𐑃𐔦"],
  ["m", "μϻⲙмꮇᗰᛖꓟ𐊰𐌑"],
  ["n", "ոռⲛꓠ𐔓"],
  ["o", "σᴏᴑꬽοⲟϭоჿօסهھہەഠဝ𐓪𑣈𑣗𐐬ⵔዐଠꓳ𑣕𐊒𐊫𐔖"],
  ["p", "þƿρϸⲣⳏрꮲᑭꓑ𐊕"],
  ["q", "ԛգզⵕ"],
  ["r", "ꭇꭈᴦⲅгꮁʀꭱꮢ𐓜ᖇꓣ𖼵"],
  ["s", "ꜱƽѕടꮪ𑣁𐑈տꮥꓢ𖼺𐊖"],
  ["t", "τⲧтꭲꓔ𖼊𑣜𐊗𐊱𐌕"],
  ["u", "ꞟᴜꭎꭒʋυս𐓶𑣘ሀᑌꓴ𖽂"],
  ["v", "νᴠѵט𑜆ꮩ𑣀ⴸᐯꛟꓦ𖼈𐔝"],
  ["w", "ɯᴡⲽѡшԝա𑜊𑜎𑜏ꮃꮤꓪ"],
  ["x", "хᕁᕽꭓχⲭⵝᚷꓫ𐊐𐊴𐌗𐔧"],
  ["y", "ɣᶌʏỿꭚγⲩуүყꭹꮍꓬ𖽃𑣄𐊲"],
  ["z", "ᴢꮓζꓜ𑣉"],
] as const;

const createLookalikeMap = (): ReadonlyMap<string, string> => {
  const lookalikes = new Map<string, string>();
  for (const [ascii, source] of LOOKALIKE_GROUPS) {
    for (const char of source) lookalikes.set(char, ascii);
  }
  return lookalikes;
};

export const LOOKALIKE_TO_ASCII = createLookalikeMap();

export const DOT_CHAR_SET = new Set([
  ".",
  "。",
  "｡",
  "．",
  "·",
  "•",
  "⋅",
  "・",
  "܁",
  "܂",
  "꘎",
  "𐩐",
]);
