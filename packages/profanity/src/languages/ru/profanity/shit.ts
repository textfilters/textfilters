import {
  cyrillicAdjectiveTailParts,
  cyrillicSuffix,
  joinedPatterns,
  optionalRegexGroup,
  prefixedPatternSequences,
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  separatedPattern,
  separatedPatterns,
  splitPattern,
  splitPatternLiteral,
  transliteratedAdjectiveTailParts,
} from "./authoring.js";

const GOVNO_FAMILY_TAILS = [
  String.raw`ами`,
  String.raw`ам`,
  String.raw`ах`,
  String.raw`ом`,
  String.raw`о`,
  String.raw`а`,
  String.raw`у`,
  String.raw`е`,
  String.raw`ищ${regexGroup(["ами", "ам", "ах", "ем", "е", "а", "у"])}`,
  String.raw`юк${optionalRegexGroup(["ами?", "ах", "ом", "а", "у", "е", "и", "ов"])}`,
  String.raw`я(?:н|шк)${cyrillicSuffix}`,
] as const;

const SRAT_SPLIT_SEPARATOR = String.raw`[-._]+`;
const SRAT_CYRILLIC_SPLIT_BASE = separatedPattern(
  [String.raw`с`, String.raw`р`],
  SRAT_SPLIT_SEPARATOR,
);
const SRAT_LATIN_SPLIT_BASE = separatedPattern(
  [String.raw`s`, String.raw`r`],
  SRAT_SPLIT_SEPARATOR,
);
const SRAT_CYRILLIC_SPLIT_TAIL_PARTS = [
  [String.raw`а`, String.raw`т`, String.raw`ь`],
  [String.raw`а`, String.raw`л`, String.raw`а`],
  [String.raw`а`, String.raw`л`, String.raw`и`],
  [String.raw`а`, String.raw`л`, String.raw`о`],
  [String.raw`[её]`, String.raw`ш`, String.raw`ь`],
  [String.raw`[её]`, String.raw`т`, String.raw`е`],
  [String.raw`и`, String.raw`т`, String.raw`е`],
  [String.raw`а`, String.raw`л`],
  [String.raw`[её]`, String.raw`т`],
  [String.raw`[её]`, String.raw`м`],
  [String.raw`у`, String.raw`т`],
  [String.raw`и`],
  [String.raw`у`],
] as const;
const SRAT_LATIN_SPLIT_TAIL_PARTS = [
  [String.raw`[eе]`, String.raw`s`, String.raw`h`],
  [String.raw`[eе]`, String.raw`[tт]`, String.raw`[eе]`],
  [String.raw`[aа]`, String.raw`[tт]`],
  [String.raw`[aа]`, String.raw`l`, String.raw`[aа]`],
  [String.raw`[aа]`, String.raw`l`, String.raw`i`],
  [String.raw`[aа]`, String.raw`l`, String.raw`[oо]`],
  [String.raw`[aа]`, String.raw`l`],
  [String.raw`[eе]`, String.raw`[tт]`],
  [String.raw`[eе]`, String.raw`[mм]`],
  [String.raw`[uу]`, String.raw`[tт]`],
  [String.raw`i`, String.raw`[tт]`, String.raw`[eе]`],
  [String.raw`i`],
] as const;
const SRAT_LATIN_TRANSLIT_TAILS = joinedPatterns(SRAT_LATIN_SPLIT_TAIL_PARTS);
const SRAT_SPLIT_SOURCE = regexGroup([
  String.raw`${SRAT_CYRILLIC_SPLIT_BASE}${SRAT_SPLIT_SEPARATOR}${regexGroup(
    separatedPatterns(SRAT_CYRILLIC_SPLIT_TAIL_PARTS, SRAT_SPLIT_SEPARATOR),
  )}`,
  String.raw`${SRAT_LATIN_SPLIT_BASE}${SRAT_SPLIT_SEPARATOR}${regexGroup(
    separatedPatterns(SRAT_LATIN_SPLIT_TAIL_PARTS, SRAT_SPLIT_SEPARATOR),
  )}`,
]);
const SRAN_CYRILLIC_SPLIT_BASE = separatedPattern(
  [String.raw`с`, String.raw`р`, String.raw`а`, String.raw`н`],
  SRAT_SPLIT_SEPARATOR,
);
const SRAN_CYRILLIC_SPLIT_TAILS = separatedPatterns(
  [
    ...cyrillicAdjectiveTailParts,
    ...prefixedPatternSequences([String.raw`н`], cyrillicAdjectiveTailParts),
  ],
  SRAT_SPLIT_SEPARATOR,
);
const SRAN_CYRILLIC_SPLIT_SOURCE = String.raw`${SRAN_CYRILLIC_SPLIT_BASE}${SRAT_SPLIT_SEPARATOR}${regexGroup(
  SRAN_CYRILLIC_SPLIT_TAILS,
)}`;

const ZASRANEC_FAMILY_TAILS = [
  String.raw`ец`,
  String.raw`ца`,
  String.raw`цу`,
  String.raw`це`,
  String.raw`цем`,
  String.raw`цы`,
  String.raw`цев`,
  String.raw`цам`,
  String.raw`цами`,
  String.raw`цах`,
  String.raw`н(?:ый|ая|ое|ые|ого|ому|ую|ой|ым|ыми|ых|ом)`,
  String.raw`ок`,
  String.raw`к(?:а|и|е|у|ой|ам|ами|ах)`,
] as const;

const OBOSRAT_AVSH_TAILS = [
  String.raw`ийся`,
  String.raw`аяся`,
  String.raw`ееся`,
  String.raw`иеся`,
  String.raw`егося`,
  String.raw`емуся`,
  String.raw`уюся`,
  String.raw`ейся`,
  String.raw`емся`,
  String.raw`имся`,
  String.raw`имися`,
  String.raw`ихся`,
] as const;

const OBOSRAT_E_TAILS = [
  String.raw`шь(?:ся)?`,
  String.raw`т(?:ся|е(?:сь)?)?`,
  String.raw`м(?:ся)?`,
] as const;

const OBOSRAT_FAMILY_TAILS = [
  String.raw`ал(?:а|и|о)?`,
  String.raw`алось`,
  String.raw`ат(?:ь|ься)`,
  String.raw`ался`,
  String.raw`алась`,
  String.raw`ались`,
  String.raw`авш${regexGroup(OBOSRAT_AVSH_TAILS)}`,
  String.raw`у(?:сь)?`,
  String.raw`[её]${regexGroup(OBOSRAT_E_TAILS)}`,
  String.raw`ут(?:ся)?`,
  String.raw`и(?:сь|те(?:сь)?)?`,
  String.raw`ан${cyrillicSuffix}`,
] as const;

const GOVNO_TRANSLIT_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[mм]`],
  [String.raw`[oо]`],
  [String.raw`[aа]`],
  [String.raw`[uу]`],
  [String.raw`[eе]`],
] as const;

const GOVNO_SPLIT_SEPARATOR = String.raw`[-._]+`;

const GOVNO_ADJECTIVE_TRANSLIT_TAIL_PARTS = transliteratedAdjectiveTailParts;

const GOVNISHCH_TRANSLIT_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[eе]`, String.raw`[mм]`],
  [String.raw`[eе]`],
  [String.raw`[aа]`],
  [String.raw`[uу]`],
] as const;

const GOVNYUK_TRANSLIT_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`v`],
  [String.raw`[oо]`, String.raw`[mм]`],
  [String.raw`[aа]`],
  [String.raw`[uу]`],
  [String.raw`[eе]`],
  [String.raw`i`],
] as const;

const GOVNYASHKA_TRANSLIT_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[aа]`],
  [String.raw`i`],
  [String.raw`[eе]`],
  [String.raw`[uу]`],
] as const;

const GOVNO_TRANSLIT_TAILS = joinedPatterns(GOVNO_TRANSLIT_TAIL_PARTS);
const GOVNO_ADJECTIVE_TRANSLIT_TAILS = joinedPatterns(
  GOVNO_ADJECTIVE_TRANSLIT_TAIL_PARTS,
);
const GOVNISHCH_TRANSLIT_TAILS = joinedPatterns(GOVNISHCH_TRANSLIT_TAIL_PARTS);
const GOVNYUK_TRANSLIT_TAILS = joinedPatterns(GOVNYUK_TRANSLIT_TAIL_PARTS);
const GOVNYASHKA_TRANSLIT_TAILS = joinedPatterns(
  GOVNYASHKA_TRANSLIT_TAIL_PARTS,
);
const GOVNO_TRANSLIT_SOURCE = regexGroup([
  String.raw`g[oо]vn${regexGroup(GOVNO_TRANSLIT_TAILS)}`,
  String.raw`g[oо]v[eе]nn?${regexGroup(GOVNO_ADJECTIVE_TRANSLIT_TAILS)}`,
  String.raw`g[oо]vn(?:is[hн][cс][hн]|is[cс][hн]|is[hн])${regexGroup(
    GOVNISHCH_TRANSLIT_TAILS,
  )}`,
  String.raw`g[oо]vn[yу][uу][kк]${optionalRegexGroup(GOVNYUK_TRANSLIT_TAILS)}`,
  String.raw`g[oо]vn[yу][aа]n${regexGroup(GOVNO_ADJECTIVE_TRANSLIT_TAILS)}`,
  String.raw`g[oо]vn[yу][aа]s[hн][kк]${regexGroup(GOVNYASHKA_TRANSLIT_TAILS)}`,
]);

const GOVEN_CYRILLIC_SPLIT_TAILS = separatedPatterns(
  cyrillicAdjectiveTailParts,
  GOVNO_SPLIT_SEPARATOR,
);
const GOVEN_CYRILLIC_SPLIT_SOURCE = String.raw`${separatedPattern(
  [
    String.raw`г`,
    String.raw`о`,
    String.raw`в`,
    String.raw`[её]`,
    String.raw`н`,
  ],
  GOVNO_SPLIT_SEPARATOR,
)}${GOVNO_SPLIT_SEPARATOR}${regexGroup(GOVEN_CYRILLIC_SPLIT_TAILS)}`;
const GOVNO_SPLIT_TAILS = separatedPatterns(
  GOVNO_TRANSLIT_TAIL_PARTS,
  GOVNO_SPLIT_SEPARATOR,
);
const GOVNO_ADJECTIVE_SPLIT_TAILS = separatedPatterns(
  GOVNO_ADJECTIVE_TRANSLIT_TAIL_PARTS,
  GOVNO_SPLIT_SEPARATOR,
);
const GOVNISHCH_SPLIT_TAILS = separatedPatterns(
  GOVNISHCH_TRANSLIT_TAIL_PARTS,
  GOVNO_SPLIT_SEPARATOR,
);
const GOVNYUK_SPLIT_TAILS = separatedPatterns(
  GOVNYUK_TRANSLIT_TAIL_PARTS,
  GOVNO_SPLIT_SEPARATOR,
);
const GOVNYASHKA_SPLIT_TAILS = separatedPatterns(
  GOVNYASHKA_TRANSLIT_TAIL_PARTS,
  GOVNO_SPLIT_SEPARATOR,
);
const GOVNO_SPLIT_BASE = String.raw`g${GOVNO_SPLIT_SEPARATOR}[oо]${GOVNO_SPLIT_SEPARATOR}v${GOVNO_SPLIT_SEPARATOR}n`;
const GOVEN_SPLIT_SOURCE = regexGroup([
  separatedPattern(
    [
      String.raw`g`,
      String.raw`[oо]`,
      String.raw`v`,
      String.raw`[eе]`,
      String.raw`n`,
    ],
    GOVNO_SPLIT_SEPARATOR,
  ),
  separatedPattern(
    [
      String.raw`g`,
      String.raw`[oо]`,
      String.raw`v`,
      String.raw`[eе]`,
      String.raw`n`,
      String.raw`n`,
    ],
    GOVNO_SPLIT_SEPARATOR,
  ),
]);
const GOVNISHCH_SPLIT_SOURCE = regexGroup([
  separatedPattern(
    [
      String.raw`g`,
      String.raw`[oо]`,
      String.raw`v`,
      String.raw`n`,
      String.raw`i`,
      String.raw`s`,
      String.raw`[hн]`,
      String.raw`[cс]`,
      String.raw`[hн]`,
    ],
    GOVNO_SPLIT_SEPARATOR,
  ),
  separatedPattern(
    [
      String.raw`g`,
      String.raw`[oо]`,
      String.raw`v`,
      String.raw`n`,
      String.raw`i`,
      String.raw`s`,
      String.raw`[cс]`,
      String.raw`[hн]`,
    ],
    GOVNO_SPLIT_SEPARATOR,
  ),
  separatedPattern(
    [
      String.raw`g`,
      String.raw`[oо]`,
      String.raw`v`,
      String.raw`n`,
      String.raw`i`,
      String.raw`s`,
      String.raw`[hн]`,
    ],
    GOVNO_SPLIT_SEPARATOR,
  ),
]);
const GOVNYUK_SPLIT_SOURCE = separatedPattern(
  [
    String.raw`g`,
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`n`,
    String.raw`[yу]`,
    String.raw`[uу]`,
    String.raw`[kк]`,
  ],
  GOVNO_SPLIT_SEPARATOR,
);
const GOVNYAN_SPLIT_SOURCE = separatedPattern(
  [
    String.raw`g`,
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`n`,
    String.raw`[yу]`,
    String.raw`[aа]`,
    String.raw`n`,
  ],
  GOVNO_SPLIT_SEPARATOR,
);
const GOVNYASHKA_SPLIT_SOURCE = separatedPattern(
  [
    String.raw`g`,
    String.raw`[oо]`,
    String.raw`v`,
    String.raw`n`,
    String.raw`[yу]`,
    String.raw`[aа]`,
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`[kк]`,
  ],
  GOVNO_SPLIT_SEPARATOR,
);
const GOVNO_SPLIT_SOURCE = regexGroup([
  String.raw`${GOVEN_SPLIT_SOURCE}${GOVNO_SPLIT_SEPARATOR}${regexGroup(
    GOVNO_ADJECTIVE_SPLIT_TAILS,
  )}`,
  String.raw`${GOVNISHCH_SPLIT_SOURCE}${GOVNO_SPLIT_SEPARATOR}${regexGroup(
    GOVNISHCH_SPLIT_TAILS,
  )}`,
  String.raw`${GOVNYUK_SPLIT_SOURCE}(?:${GOVNO_SPLIT_SEPARATOR}${regexGroup(
    GOVNYUK_SPLIT_TAILS,
  )})?`,
  String.raw`${GOVNYAN_SPLIT_SOURCE}${GOVNO_SPLIT_SEPARATOR}${regexGroup(
    GOVNO_ADJECTIVE_SPLIT_TAILS,
  )}`,
  String.raw`${GOVNYASHKA_SPLIT_SOURCE}${GOVNO_SPLIT_SEPARATOR}${regexGroup(
    GOVNYASHKA_SPLIT_TAILS,
  )}`,
  String.raw`${GOVNO_SPLIT_BASE}${GOVNO_SPLIT_SEPARATOR}${regexGroup(GOVNO_SPLIT_TAILS)}`,
]);

const ZASRANEC_SPLIT_SEPARATOR = String.raw`[-._]+`;
const ZASRANEC_CYRILLIC_SPLIT_BASE = separatedPattern(
  [
    String.raw`з`,
    String.raw`а`,
    String.raw`с`,
    String.raw`р`,
    String.raw`а`,
    String.raw`н`,
  ],
  ZASRANEC_SPLIT_SEPARATOR,
);
const ZASRANEC_CYRILLIC_CASE_TAIL_PARTS = [
  [String.raw`ц`, String.raw`а`, String.raw`м`, String.raw`и`],
  [String.raw`ц`, String.raw`а`, String.raw`м`],
  [String.raw`ц`, String.raw`а`, String.raw`х`],
  [String.raw`ц`, String.raw`е`, String.raw`м`],
  [String.raw`ц`, String.raw`е`, String.raw`в`],
  [String.raw`е`, String.raw`ц`],
  [String.raw`ц`, String.raw`а`],
  [String.raw`ц`, String.raw`у`],
  [String.raw`ц`, String.raw`е`],
  [String.raw`ц`, String.raw`ы`],
] as const;
const ZASRANKA_CYRILLIC_TAIL_PARTS = [
  [String.raw`а`, String.raw`м`, String.raw`и`],
  [String.raw`а`, String.raw`м`],
  [String.raw`а`, String.raw`х`],
  [String.raw`о`, String.raw`й`],
  [String.raw`а`],
  [String.raw`и`],
  [String.raw`е`],
  [String.raw`у`],
] as const;
const ZASRANEC_CYRILLIC_SPLIT_TAILS = separatedPatterns(
  [
    ...ZASRANEC_CYRILLIC_CASE_TAIL_PARTS,
    ...prefixedPatternSequences([String.raw`н`], cyrillicAdjectiveTailParts),
    [String.raw`о`, String.raw`к`],
    ...ZASRANKA_CYRILLIC_TAIL_PARTS.map((tail) => [String.raw`к`, ...tail]),
  ],
  ZASRANEC_SPLIT_SEPARATOR,
);
const ZASRANEC_CYRILLIC_SPLIT_SOURCE =
  String.raw`${ZASRANEC_CYRILLIC_SPLIT_BASE}${ZASRANEC_SPLIT_SEPARATOR}` +
  regexGroup(ZASRANEC_CYRILLIC_SPLIT_TAILS);

const ZASRANEC_TRANSLIT_CASE_MARKERS = [
  String.raw`[cс]`,
  String.raw`[tт]s`,
] as const;
const ZASRANEC_TRANSLIT_CASE_TAILS = [
  String.raw`[aа][mм]i`,
  String.raw`[aа][mм]`,
  String.raw`[aа][hн]`,
  String.raw`[eе][mм]`,
  String.raw`[eе]v`,
  String.raw`[aа]`,
  String.raw`[uу]`,
  String.raw`[eе]`,
  String.raw`[yу]`,
] as const;
const ZASRANNY_TRANSLIT_TAIL_PARTS = [
  [String.raw`[oо]`, String.raw`g`, String.raw`[oо]`],
  [String.raw`[oо]`, String.raw`[mм]`, String.raw`[uу]`],
  [String.raw`[uу]`, String.raw`[yу]`, String.raw`[uу]`],
  [String.raw`[yу]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[yу]`, String.raw`[aа]`],
  [String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[oо]`, String.raw`[mм]`],
  [String.raw`[yу]`, String.raw`[mм]`],
  [String.raw`[yу]`, String.raw`[hн]`],
  [String.raw`[yу]`, String.raw`[yу]`],
  [String.raw`[oо]`, String.raw`[eе]`],
  [String.raw`[yу]`, String.raw`[eе]`],
] as const;
const ZASRANKA_TRANSLIT_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[aа]`],
  [String.raw`i`],
  [String.raw`[eе]`],
  [String.raw`[uу]`],
] as const;
const ZASRANNY_TRANSLIT_TAILS = joinedPatterns(ZASRANNY_TRANSLIT_TAIL_PARTS);
const ZASRANKA_TRANSLIT_TAILS = joinedPatterns(ZASRANKA_TRANSLIT_TAIL_PARTS);
const ZASRANEC_TRANSLIT_SOURCE = String.raw`z[aа]sr[aа]n${regexGroup([
  String.raw`[eе]${regexGroup(ZASRANEC_TRANSLIT_CASE_MARKERS)}`,
  String.raw`${regexGroup(ZASRANEC_TRANSLIT_CASE_MARKERS)}${regexGroup(
    ZASRANEC_TRANSLIT_CASE_TAILS,
  )}`,
  String.raw`n${regexGroup(ZASRANNY_TRANSLIT_TAILS)}`,
  String.raw`[oо][kк]`,
  String.raw`[kк]${regexGroup(ZASRANKA_TRANSLIT_TAILS)}`,
])}`;

const ZASRANEC_TRANSLIT_SPLIT_SEPARATOR = ZASRANEC_SPLIT_SEPARATOR;
const ZASRANEC_TRANSLIT_SPLIT_BASE = separatedPattern(
  [
    String.raw`z`,
    String.raw`[aа]`,
    String.raw`s`,
    String.raw`r`,
    String.raw`[aа]`,
    String.raw`n`,
  ],
  ZASRANEC_TRANSLIT_SPLIT_SEPARATOR,
);
const ZASRANEC_TRANSLIT_SPLIT_CASE_MARKERS = separatedPatterns(
  [[String.raw`[cс]`], [String.raw`[tт]`, String.raw`s`]],
  ZASRANEC_TRANSLIT_SPLIT_SEPARATOR,
);
const ZASRANEC_TRANSLIT_SPLIT_CASE_TAILS = [
  String.raw`[aа]${ZASRANEC_TRANSLIT_SPLIT_SEPARATOR}[mм]${ZASRANEC_TRANSLIT_SPLIT_SEPARATOR}i`,
  String.raw`[aа]${ZASRANEC_TRANSLIT_SPLIT_SEPARATOR}[mм]`,
  String.raw`[aа]${ZASRANEC_TRANSLIT_SPLIT_SEPARATOR}[hн]`,
  String.raw`[eе]${ZASRANEC_TRANSLIT_SPLIT_SEPARATOR}[mм]`,
  String.raw`[eе]${ZASRANEC_TRANSLIT_SPLIT_SEPARATOR}v`,
  String.raw`[aа]`,
  String.raw`[uу]`,
  String.raw`[eе]`,
  String.raw`[yу]`,
] as const;
const ZASRANNY_TRANSLIT_SPLIT_TAILS = separatedPatterns(
  ZASRANNY_TRANSLIT_TAIL_PARTS,
  ZASRANEC_TRANSLIT_SPLIT_SEPARATOR,
);
const ZASRANKA_TRANSLIT_SPLIT_TAILS = separatedPatterns(
  ZASRANKA_TRANSLIT_TAIL_PARTS,
  ZASRANEC_TRANSLIT_SPLIT_SEPARATOR,
);
const ZASRANEC_TRANSLIT_SPLIT_ALTERNATIVES = [
  String.raw`[eе]${ZASRANEC_TRANSLIT_SPLIT_SEPARATOR}${regexGroup(
    ZASRANEC_TRANSLIT_SPLIT_CASE_MARKERS,
  )}`,
  String.raw`${regexGroup(
    ZASRANEC_TRANSLIT_SPLIT_CASE_MARKERS,
  )}${ZASRANEC_TRANSLIT_SPLIT_SEPARATOR}${regexGroup(
    ZASRANEC_TRANSLIT_SPLIT_CASE_TAILS,
  )}`,
  String.raw`n${ZASRANEC_TRANSLIT_SPLIT_SEPARATOR}${regexGroup(
    ZASRANNY_TRANSLIT_SPLIT_TAILS,
  )}`,
  String.raw`[oо]${ZASRANEC_TRANSLIT_SPLIT_SEPARATOR}[kк]`,
  String.raw`[kк]${ZASRANEC_TRANSLIT_SPLIT_SEPARATOR}${regexGroup(
    ZASRANKA_TRANSLIT_SPLIT_TAILS,
  )}`,
] as const;
const ZASRANEC_TRANSLIT_SPLIT_SOURCE =
  String.raw`${ZASRANEC_TRANSLIT_SPLIT_BASE}` +
  String.raw`${ZASRANEC_TRANSLIT_SPLIT_SEPARATOR}` +
  String.raw`${regexGroup(ZASRANEC_TRANSLIT_SPLIT_ALTERNATIVES)}`;

const OBOSRAT_YA = String.raw`[yу][aа]`;
const OBOSRAT_SYA = String.raw`s${OBOSRAT_YA}`;
const OBOSRAL_TRANSLIT_TAILS = [
  OBOSRAT_SYA,
  String.raw`[aа]${OBOSRAT_SYA}`,
  String.raw`i(?:${OBOSRAT_SYA})?`,
  String.raw`[oо]${OBOSRAT_SYA}`,
] as const;
const OBOSRAT_U_TRANSLIT_TAILS = [
  OBOSRAT_SYA,
  String.raw`[tт](?:${OBOSRAT_SYA})?`,
  String.raw`[tт][eе](?:s(?:${OBOSRAT_YA})?)?`,
] as const;
const OBOSRAT_E_TRANSLIT_TAILS = [
  String.raw`s[hн](?:${OBOSRAT_SYA})?`,
  String.raw`[tт](?:${OBOSRAT_SYA})?`,
  String.raw`[mм](?:${OBOSRAT_SYA})?`,
  String.raw`[tт][eе](?:s(?:${OBOSRAT_YA})?)?`,
] as const;
const OBOSRAT_I_TRANSLIT_TAILS = [
  String.raw`s(?:${OBOSRAT_YA})?`,
  String.raw`[tт][eе](?:s(?:${OBOSRAT_YA})?)?`,
] as const;
const OBOSRAT_AVSH_TRANSLIT_TAILS = [
  String.raw`i[yу]s${OBOSRAT_YA}`,
  String.raw`[aа]${OBOSRAT_YA}s${OBOSRAT_YA}`,
  String.raw`[eе][eе]s${OBOSRAT_YA}`,
  String.raw`i[eе]s${OBOSRAT_YA}`,
  String.raw`[eе]g[oо]s${OBOSRAT_YA}`,
  String.raw`[eе][mм][uу]s${OBOSRAT_YA}`,
  String.raw`[uу][yу][uу]s${OBOSRAT_YA}`,
  String.raw`[eе][yу]s${OBOSRAT_YA}`,
  String.raw`[eе][mм]s${OBOSRAT_YA}`,
  String.raw`i[mм]s${OBOSRAT_YA}`,
  String.raw`i[mм]is${OBOSRAT_YA}`,
  String.raw`i[hн]s${OBOSRAT_YA}`,
] as const;
const OBOSRAT_TRANSLIT_SOURCE = String.raw`[oо][bьв][oо]sr${regexGroup([
  String.raw`[aа]l${optionalRegexGroup(OBOSRAL_TRANSLIT_TAILS)}`,
  String.raw`[aа][tт](?:${OBOSRAT_SYA})?`,
  String.raw`[aа]vs[hн]${regexGroup(OBOSRAT_AVSH_TRANSLIT_TAILS)}`,
  String.raw`[aа]nn${regexGroup(GOVNO_ADJECTIVE_TRANSLIT_TAILS)}`,
  String.raw`[uу]${optionalRegexGroup(OBOSRAT_U_TRANSLIT_TAILS)}`,
  String.raw`[eе]${regexGroup(OBOSRAT_E_TRANSLIT_TAILS)}`,
  String.raw`i${optionalRegexGroup(OBOSRAT_I_TRANSLIT_TAILS)}`,
])}`;

const OBOSRAT_SPLIT_SEPARATOR = String.raw`[-._]+`;
const OBOSRAT_CYRILLIC_SPLIT_BASE = separatedPattern(
  [String.raw`о`, String.raw`б`, String.raw`о`, String.raw`с`, String.raw`р`],
  OBOSRAT_SPLIT_SEPARATOR,
);
const OBOSRAT_TRANSLIT_SPLIT_BASE = separatedPattern(
  [
    String.raw`[oо]`,
    String.raw`[bьв]`,
    String.raw`[oо]`,
    String.raw`s`,
    String.raw`r`,
  ],
  OBOSRAT_SPLIT_SEPARATOR,
);
const obosratSplitTail = splitPattern(OBOSRAT_SPLIT_SEPARATOR);
const obosratSplitSuffix = (tail: string): string =>
  String.raw`${OBOSRAT_SPLIT_SEPARATOR}${tail}`;
const obosratSplitLiteral = splitPatternLiteral(OBOSRAT_SPLIT_SEPARATOR);

const OBOSRAT_CYRILLIC_SPLIT_REFLEXIVE = obosratSplitTail([
  String.raw`с`,
  String.raw`я`,
]);
const OBOSRAT_CYRILLIC_SPLIT_SOFT_REFLEXIVE = obosratSplitTail([
  String.raw`с`,
  String.raw`ь`,
]);
const OBOSRAT_CYRILLIC_SPLIT_AVSH_TAILS =
  OBOSRAT_AVSH_TAILS.map(obosratSplitLiteral);
const OBOSRAT_CYRILLIC_SPLIT_ADJECTIVE_TAILS = separatedPatterns(
  cyrillicAdjectiveTailParts,
  OBOSRAT_SPLIT_SEPARATOR,
);
const OBOSRAT_CYRILLIC_SPLIT_TAIL_SOURCE = regexGroup([
  String.raw`${obosratSplitTail([
    String.raw`а`,
    String.raw`л`,
  ])}(?:${OBOSRAT_SPLIT_SEPARATOR}${regexGroup([
    String.raw`а(?:${obosratSplitSuffix(
      OBOSRAT_CYRILLIC_SPLIT_SOFT_REFLEXIVE,
    )})?`,
    String.raw`и(?:${obosratSplitSuffix(
      OBOSRAT_CYRILLIC_SPLIT_SOFT_REFLEXIVE,
    )})?`,
    String.raw`о(?:${obosratSplitSuffix(
      OBOSRAT_CYRILLIC_SPLIT_SOFT_REFLEXIVE,
    )})?`,
    OBOSRAT_CYRILLIC_SPLIT_REFLEXIVE,
  ])})?`,
  String.raw`${obosratSplitTail([
    String.raw`а`,
    String.raw`т`,
    String.raw`ь`,
  ])}(?:${obosratSplitSuffix(OBOSRAT_CYRILLIC_SPLIT_REFLEXIVE)})?`,
  String.raw`${obosratSplitTail([
    String.raw`а`,
    String.raw`в`,
    String.raw`ш`,
  ])}${obosratSplitSuffix(regexGroup(OBOSRAT_CYRILLIC_SPLIT_AVSH_TAILS))}`,
  String.raw`${obosratSplitTail([
    String.raw`а`,
    String.raw`н`,
    String.raw`н`,
  ])}${obosratSplitSuffix(regexGroup(OBOSRAT_CYRILLIC_SPLIT_ADJECTIVE_TAILS))}`,
  String.raw`у(?:${obosratSplitSuffix(
    regexGroup([
      OBOSRAT_CYRILLIC_SPLIT_SOFT_REFLEXIVE,
      String.raw`т(?:${obosratSplitSuffix(
        regexGroup([
          OBOSRAT_CYRILLIC_SPLIT_REFLEXIVE,
          String.raw`е(?:${obosratSplitSuffix(
            OBOSRAT_CYRILLIC_SPLIT_SOFT_REFLEXIVE,
          )})?`,
        ]),
      )})?`,
    ]),
  )})?`,
  String.raw`${obosratSplitTail([
    String.raw`[её]`,
    String.raw`ш`,
    String.raw`ь`,
  ])}(?:${obosratSplitSuffix(OBOSRAT_CYRILLIC_SPLIT_REFLEXIVE)})?`,
  String.raw`${obosratSplitTail([
    String.raw`[её]`,
    String.raw`т`,
  ])}(?:${obosratSplitSuffix(
    regexGroup([
      OBOSRAT_CYRILLIC_SPLIT_REFLEXIVE,
      String.raw`е(?:${obosratSplitSuffix(
        OBOSRAT_CYRILLIC_SPLIT_SOFT_REFLEXIVE,
      )})?`,
    ]),
  )})?`,
  String.raw`${obosratSplitTail([
    String.raw`[её]`,
    String.raw`м`,
  ])}(?:${obosratSplitSuffix(OBOSRAT_CYRILLIC_SPLIT_REFLEXIVE)})?`,
  String.raw`и(?:${obosratSplitSuffix(
    regexGroup([
      OBOSRAT_CYRILLIC_SPLIT_SOFT_REFLEXIVE,
      String.raw`т${obosratSplitSuffix(
        String.raw`е(?:${obosratSplitSuffix(
          OBOSRAT_CYRILLIC_SPLIT_SOFT_REFLEXIVE,
        )})?`,
      )}`,
    ]),
  )})?`,
]);
const OBOSRAT_TRANSLIT_SPLIT_TAIL_PARTS = [
  [
    String.raw`[aа]`,
    String.raw`l`,
    String.raw`[oо]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [
    String.raw`[aа]`,
    String.raw`l`,
    String.raw`[aа]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [
    String.raw`[aа]`,
    String.raw`l`,
    String.raw`i`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  ...[
    [
      String.raw`i`,
      String.raw`[yу]`,
      String.raw`s`,
      String.raw`[yу]`,
      String.raw`[aа]`,
    ],
    [
      String.raw`[aа]`,
      String.raw`[yу]`,
      String.raw`[aа]`,
      String.raw`s`,
      String.raw`[yу]`,
      String.raw`[aа]`,
    ],
    [
      String.raw`[eе]`,
      String.raw`[eе]`,
      String.raw`s`,
      String.raw`[yу]`,
      String.raw`[aа]`,
    ],
    [
      String.raw`i`,
      String.raw`[eе]`,
      String.raw`s`,
      String.raw`[yу]`,
      String.raw`[aа]`,
    ],
    [
      String.raw`[eе]`,
      String.raw`g`,
      String.raw`[oо]`,
      String.raw`s`,
      String.raw`[yу]`,
      String.raw`[aа]`,
    ],
    [
      String.raw`[eе]`,
      String.raw`[mм]`,
      String.raw`[uу]`,
      String.raw`s`,
      String.raw`[yу]`,
      String.raw`[aа]`,
    ],
    [
      String.raw`[uу]`,
      String.raw`[yу]`,
      String.raw`[uу]`,
      String.raw`s`,
      String.raw`[yу]`,
      String.raw`[aа]`,
    ],
    [
      String.raw`[eе]`,
      String.raw`[yу]`,
      String.raw`s`,
      String.raw`[yу]`,
      String.raw`[aа]`,
    ],
    [
      String.raw`[eе]`,
      String.raw`[mм]`,
      String.raw`s`,
      String.raw`[yу]`,
      String.raw`[aа]`,
    ],
    [
      String.raw`i`,
      String.raw`[mм]`,
      String.raw`s`,
      String.raw`[yу]`,
      String.raw`[aа]`,
    ],
    [
      String.raw`i`,
      String.raw`[mм]`,
      String.raw`i`,
      String.raw`s`,
      String.raw`[yу]`,
      String.raw`[aа]`,
    ],
    [
      String.raw`i`,
      String.raw`[hн]`,
      String.raw`s`,
      String.raw`[yу]`,
      String.raw`[aа]`,
    ],
  ].map((tail) => [
    String.raw`[aа]`,
    String.raw`v`,
    String.raw`s`,
    String.raw`[hн]`,
    ...tail,
  ]),
  ...prefixedPatternSequences(
    [String.raw`[aа]`, String.raw`n`, String.raw`n`],
    GOVNO_ADJECTIVE_TRANSLIT_TAIL_PARTS,
  ),
  [
    String.raw`[aа]`,
    String.raw`l`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [String.raw`[aа]`, String.raw`[tт]`],
  [
    String.raw`[eе]`,
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [
    String.raw`[eе]`,
    String.raw`[tт]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [
    String.raw`[uу]`,
    String.raw`[tт]`,
    String.raw`[eе]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [
    String.raw`[eе]`,
    String.raw`[tт]`,
    String.raw`[eе]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [
    String.raw`[eе]`,
    String.raw`[mм]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [String.raw`[uу]`, String.raw`s`, String.raw`[yу]`, String.raw`[aа]`],
  [
    String.raw`[uу]`,
    String.raw`[tт]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [String.raw`i`, String.raw`s`, String.raw`[yу]`, String.raw`[aа]`],
  [
    String.raw`i`,
    String.raw`[tт]`,
    String.raw`[eе]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [String.raw`[aа]`, String.raw`l`, String.raw`[aа]`],
  [String.raw`[aа]`, String.raw`l`, String.raw`i`],
  [String.raw`[aа]`, String.raw`l`, String.raw`[oо]`],
  [String.raw`[aа]`, String.raw`l`],
  [String.raw`[uу]`, String.raw`s`, String.raw`[yу]`, String.raw`[aа]`],
  [String.raw`[uу]`, String.raw`[tт]`],
  [String.raw`[uу]`, String.raw`[tт]`, String.raw`[eе]`],
  [String.raw`[uу]`, String.raw`[tт]`, String.raw`[eе]`, String.raw`s`],
  [String.raw`[eе]`, String.raw`s`, String.raw`[hн]`],
  [String.raw`[eе]`, String.raw`[tт]`],
  [String.raw`[eе]`, String.raw`[tт]`, String.raw`[eе]`],
  [String.raw`[eе]`, String.raw`[tт]`, String.raw`[eе]`, String.raw`s`],
  [String.raw`[eе]`, String.raw`[mм]`],
  [String.raw`i`, String.raw`s`],
  [String.raw`i`, String.raw`[tт]`, String.raw`[eе]`],
  [String.raw`i`, String.raw`[tт]`, String.raw`[eе]`, String.raw`s`],
  [String.raw`[uу]`],
  [String.raw`i`],
] as const;
const OBOSRAT_SPLIT_SOURCE = regexGroup([
  String.raw`${OBOSRAT_CYRILLIC_SPLIT_BASE}${OBOSRAT_SPLIT_SEPARATOR}${OBOSRAT_CYRILLIC_SPLIT_TAIL_SOURCE}`,
  String.raw`${OBOSRAT_TRANSLIT_SPLIT_BASE}${OBOSRAT_SPLIT_SEPARATOR}${regexGroup(
    separatedPatterns(
      OBOSRAT_TRANSLIT_SPLIT_TAIL_PARTS,
      OBOSRAT_SPLIT_SEPARATOR,
    ),
  )}`,
]);

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.govno.family",
    category: "VULGAR",
    severity: "low",
    source: String.raw`(?:говн${regexGroup(GOVNO_FAMILY_TAILS)}|говен)`,
  }),
  russianRule({
    id: "ru.vulgar.govno.adjective",
    category: "VULGAR",
    severity: "low",
    source: String.raw`гов[её]н(?:ый|ая|ое|ые|ого|ому|ую|ой|ом|ым|ыми|ых)`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.govno.adjective.split.loose",
    category: "VULGAR",
    severity: "low",
    source: String.raw`(?<!\p{L})${GOVEN_CYRILLIC_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.vulgar.dermo.family",
    category: "VULGAR",
    severity: "low",
    source: String.raw`дерьм(?:ами|ам|ах|ом|о|а|у|е|ов${cyrillicSuffix})`,
  }),
  russianRule({
    id: "ru.vulgar.srat.family",
    category: "VULGAR",
    severity: "low",
    source: String.raw`(?:вы|по|за)?ср(?:ать|ал(?:а|и|о)?|али)`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.srat.split.loose",
    category: "VULGAR",
    severity: "low",
    source: String.raw`(?<!\p{L})${SRAT_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.vulgar.srat.short",
    category: "VULGAR",
    severity: "low",
    source: String.raw`ср(?:[её](?:шь|т|м|те)|и(?:те)?)`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.sru.family",
    category: "VULGAR",
    severity: "low",
    source: String.raw`(?:вы|по|за)?ср(?:у|ут)`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.sran.family",
    category: "VULGAR",
    severity: "low",
    source: String.raw`сран${cyrillicSuffix}`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.sran.split.loose",
    category: "VULGAR",
    severity: "low",
    source: String.raw`(?<!\p{L})${SRAN_CYRILLIC_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.zasranec.family",
    category: "STRONG_INSULT",
    severity: "medium",
    source: String.raw`засран${regexGroup(ZASRANEC_FAMILY_TAILS)}`,
    match: "strict",
  }),
  russianRule({
    id: "ru.insult.zasranec.split.loose",
    category: "STRONG_INSULT",
    severity: "medium",
    source: String.raw`(?<!\p{L})${ZASRANEC_CYRILLIC_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.zasranec.translit",
    category: "STRONG_INSULT",
    severity: "medium",
    source: String.raw`(?<!\p{L})${ZASRANEC_TRANSLIT_SOURCE}(?!\p{L})`,
    match: "strict",
  }),
  russianRule({
    id: "ru.insult.zasranec.translit.split.loose",
    category: "STRONG_INSULT",
    severity: "medium",
    source: String.raw`(?<!\p{L})${ZASRANEC_TRANSLIT_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.vulgar.obosrat.family",
    category: "VULGAR",
    severity: "low",
    source: String.raw`обоср${regexGroup(OBOSRAT_FAMILY_TAILS)}`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.obosrat.split.loose",
    category: "VULGAR",
    severity: "low",
    source: String.raw`(?<!\p{L})${OBOSRAT_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.vulgar.srat.translit.bare",
    category: "VULGAR",
    severity: "low",
    source: String.raw`(?<!\p{L})sr${regexGroup(SRAT_LATIN_TRANSLIT_TAILS)}(?!\p{L})`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.govno.translit.bare",
    category: "VULGAR",
    severity: "low",
    source: String.raw`(?<!\p{L})${GOVNO_TRANSLIT_SOURCE}(?!\p{L})`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.govno.translit.split.loose",
    category: "VULGAR",
    severity: "low",
    source: String.raw`(?<!\p{L})${GOVNO_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.vulgar.shit.translit",
    category: "VULGAR",
    severity: "low",
    source: String.raw`(?<!\p{L})${OBOSRAT_TRANSLIT_SOURCE}(?!\p{L})`,
    match: "strict",
  }),
]);
