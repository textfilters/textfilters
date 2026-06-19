import {
  cyrillicSuffix,
  joinedPatterns,
  optionalRegexGroup,
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  separatedPattern,
  separatedPatterns,
} from "./authoring.js";

const SHLYUHA_LAUGH_SEPARATORS = [
  String.raw`\s+`,
  String.raw`[^\p{L}\p{N}\s]+\s+`,
  String.raw`\s+[^\p{L}\p{N}\s]+\s+`,
] as const;

const SHLYUHA_CASE_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[aа]`],
  [String.raw`i`],
  [String.raw`[eе]`],
  [String.raw`[uу]`],
] as const;

const SHALAVA_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[aа]`],
  [String.raw`[yу]`],
  [String.raw`[eе]`],
  [String.raw`[uу]`],
] as const;

const SHLYUHA_OVAT_TAIL_PARTS = [
  [
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`[yу]`,
    String.raw`[yу]`,
  ],
  [
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`[aа]`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`[oо]`,
    String.raw`[eе]`,
  ],
  [
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`[yу]`,
    String.raw`[eе]`,
  ],
  [
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`[oо]`,
    String.raw`g`,
    String.raw`[oо]`,
  ],
  [
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`[oо]`,
    String.raw`[mм]`,
    String.raw`[uу]`,
  ],
  [
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`[uу]`,
    String.raw`[yу]`,
    String.raw`[uу]`,
  ],
  [
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`[yу]`,
    String.raw`[mм]`,
    String.raw`i`,
  ],
  [
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`[oо]`,
    String.raw`[yу]`,
  ],
  [
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`[oо]`,
    String.raw`[mм]`,
  ],
  [
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`[yу]`,
    String.raw`[mм]`,
  ],
  [
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`[yу]`,
    String.raw`[hн]`,
  ],
] as const;

const SHLYUHA_CASE_TAILS = joinedPatterns(SHLYUHA_CASE_TAIL_PARTS);
const SHLYUHA_OVAT_TAILS = joinedPatterns(SHLYUHA_OVAT_TAIL_PARTS);
const SHLYUHA_TRANSLIT_TAILS = [...SHLYUHA_CASE_TAILS, ...SHLYUHA_OVAT_TAILS];
const SHLYUSHKA_TRANSLIT_TAILS = SHLYUHA_CASE_TAILS;
const SHALAVA_TRANSLIT_TAILS = joinedPatterns(SHALAVA_TAIL_PARTS);
const SHLYUHA_FAMILY_TAILS = [
  String.raw`ами?`,
  String.raw`ах`,
  String.raw`ой`,
  String.raw`а`,
  String.raw`и`,
  String.raw`е`,
  String.raw`у`,
  String.raw`оват${cyrillicSuffix}`,
] as const;

const SHLYUHA_LAUGH_CONTEXT = String.raw`шлю${regexGroup(
  SHLYUHA_LAUGH_SEPARATORS,
)}ха(?:\s+ха)?(?:$|[^\p{L}])`;
const SHLYUHA_FAMILY_SOURCE = String.raw`(?!${SHLYUHA_LAUGH_CONTEXT})шлюх${regexGroup(
  SHLYUHA_FAMILY_TAILS,
)}`;

const SHLYUHA_TRANSLIT_SOURCE = regexGroup([
  String.raw`s[hн]l[yу]u${regexGroup([
    String.raw`[hн]${optionalRegexGroup(SHLYUHA_TRANSLIT_TAILS)}`,
    String.raw`[kк][hн]${regexGroup(SHLYUHA_CASE_TAILS)}`,
    String.raw`[xх]${regexGroup(SHLYUHA_CASE_TAILS)}`,
    String.raw`s[hн][kк]${regexGroup(SHLYUSHKA_TRANSLIT_TAILS)}`,
    String.raw`s[hн][eе][kк]`,
  ])}`,
  String.raw`s[hн][aа]l[aа]v${optionalRegexGroup(SHALAVA_TRANSLIT_TAILS)}`,
]);

const SHLYUHA_SPLIT_SEP = String.raw`[-._]+`;
const shlyuhaSplit = (sources: readonly string[]): string =>
  separatedPattern(sources, SHLYUHA_SPLIT_SEP);
const shlyuhaSplitWithTails = (
  baseParts: readonly string[],
  tails: readonly string[],
): string =>
  String.raw`${shlyuhaSplit(baseParts)}${SHLYUHA_SPLIT_SEP}${regexGroup(
    tails,
  )}`;
const shlyuhaSplitWithOptionalTails = (
  baseParts: readonly string[],
  tails: readonly string[],
): string =>
  String.raw`${shlyuhaSplit(baseParts)}(?:${SHLYUHA_SPLIT_SEP}${regexGroup(
    tails,
  )})?`;

const SHLYUHA_SPLIT_CASE_TAILS = separatedPatterns(
  SHLYUHA_CASE_TAIL_PARTS,
  SHLYUHA_SPLIT_SEP,
);
const SHLYUHA_SPLIT_OVAT_TAILS = separatedPatterns(
  SHLYUHA_OVAT_TAIL_PARTS,
  SHLYUHA_SPLIT_SEP,
);
const SHLYUHA_SPLIT_TAILS = [
  ...SHLYUHA_SPLIT_CASE_TAILS,
  ...SHLYUHA_SPLIT_OVAT_TAILS,
];
const SHLYUSHKA_SPLIT_TAILS = SHLYUHA_SPLIT_CASE_TAILS;
const SHALAVA_SPLIT_TAILS = separatedPatterns(
  SHALAVA_TAIL_PARTS,
  SHLYUHA_SPLIT_SEP,
);

const SHLYUHA_SPLIT_SOURCE = regexGroup([
  String.raw`${shlyuhaSplit([
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`l`,
    String.raw`[yу]`,
    String.raw`u`,
    String.raw`[hн]`,
  ])}(?:${SHLYUHA_SPLIT_SEP}${regexGroup(SHLYUHA_SPLIT_TAILS)})?`,
  shlyuhaSplitWithTails(
    [
      String.raw`s`,
      String.raw`[hн]`,
      String.raw`l`,
      String.raw`[yу]`,
      String.raw`u`,
      String.raw`[kк]`,
      String.raw`[hн]`,
    ],
    SHLYUHA_SPLIT_CASE_TAILS,
  ),
  shlyuhaSplitWithTails(
    [
      String.raw`s`,
      String.raw`[hн]`,
      String.raw`l`,
      String.raw`[yу]`,
      String.raw`u`,
      String.raw`[xх]`,
    ],
    SHLYUHA_SPLIT_CASE_TAILS,
  ),
  shlyuhaSplitWithTails(
    [
      String.raw`s`,
      String.raw`[hн]`,
      String.raw`l`,
      String.raw`[yу]`,
      String.raw`u`,
      String.raw`s`,
      String.raw`[hн]`,
      String.raw`[kк]`,
    ],
    SHLYUSHKA_SPLIT_TAILS,
  ),
  shlyuhaSplit([
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`l`,
    String.raw`[yу]`,
    String.raw`u`,
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`[eе]`,
    String.raw`[kк]`,
  ]),
  shlyuhaSplitWithOptionalTails(
    [
      String.raw`s`,
      String.raw`[hн]`,
      String.raw`[aа]`,
      String.raw`l`,
      String.raw`[aа]`,
      String.raw`v`,
    ],
    SHALAVA_SPLIT_TAILS,
  ),
]);

const SHALAVA_CYRILLIC_TAIL_PARTS = [
  [String.raw`а`, String.raw`м`, String.raw`и`],
  [String.raw`а`, String.raw`м`],
  [String.raw`а`, String.raw`х`],
  [String.raw`о`, String.raw`й`],
  [String.raw`а`],
  [String.raw`ы`],
  [String.raw`е`],
  [String.raw`у`],
] as const;
const SHALAVA_CYRILLIC_SPLIT_TAILS = separatedPatterns(
  SHALAVA_CYRILLIC_TAIL_PARTS,
  SHLYUHA_SPLIT_SEP,
);
const SHALAVA_CYRILLIC_SPLIT_SOURCE = shlyuhaSplitWithOptionalTails(
  [String.raw`ш`, String.raw`а`, String.raw`л`, String.raw`а`, String.raw`в`],
  SHALAVA_CYRILLIC_SPLIT_TAILS,
);

export default russianFamilyDictionary([
  russianRule({
    id: "ru.insult.shlyuha.family",
    category: "STRONG_INSULT",
    severity: "high",
    source: SHLYUHA_FAMILY_SOURCE,
  }),
  russianRule({
    id: "ru.insult.shlyuha.bare",
    category: "STRONG_INSULT",
    severity: "high",
    source: String.raw`шлюх`,
    match: "strict",
  }),
  russianRule({
    id: "ru.insult.shlyuha.bare.split.loose",
    category: "STRONG_INSULT",
    severity: "high",
    source: String.raw`(?<!\p{L})ш[-._]+л[-._]+ю[-._]+х(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.shlyushka.family",
    category: "STRONG_INSULT",
    severity: "high",
    source: String.raw`(?:шлюшк(?:ами?|ах|ой|а|и|е|у)|шлюшек)`,
  }),
  russianRule({
    id: "ru.insult.shalava.family",
    category: "STRONG_INSULT",
    severity: "high",
    source: String.raw`шалав(?:а|ы|е|у|ой|ами?|ах)?`,
    match: "strict",
  }),
  russianRule({
    id: "ru.insult.shalava.split.loose",
    category: "STRONG_INSULT",
    severity: "high",
    source: String.raw`(?<!\p{L})${SHALAVA_CYRILLIC_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.shlyuha.translit",
    category: "STRONG_INSULT",
    severity: "high",
    source: String.raw`(?<!\p{L})${SHLYUHA_TRANSLIT_SOURCE}(?!\p{L})`,
    match: "strict",
  }),
  russianRule({
    id: "ru.insult.shlyuha.translit.split.loose",
    category: "STRONG_INSULT",
    severity: "high",
    source: String.raw`(?<!\p{L})${SHLYUHA_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
]);
