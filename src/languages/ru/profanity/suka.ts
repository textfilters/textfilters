import {
  cyrillicSuffix,
  joinedPatterns,
  neutralContextGuardedSource,
  optionalRegexGroup,
  regexAlternatives,
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  separatedPattern,
  separatedPatterns,
  token,
} from "./authoring.js";

const SUKA_NEUTRAL_TAILS = [
  String.raw`f[aа][mм]il[yу]`,
  String.raw`surn[aа][mм][eе]`,
  String.raw`vill[aа]g[eе]`,
  String.raw`[mм]uni[cс]i[pр][aа]li[tт][yу]`,
  String.raw`dis[tт]ri[cс][tт]`,
  String.raw`univ[eе]rsi[tт][yу]`,
  String.raw`s[tт]udi[oо]`,
  String.raw`s[kк]in[cс][aа]r[eе]`,
  String.raw`[pр]r[oо]du[cс][tт]s`,
  String.raw`r[eе][cс][oо]rds`,
  String.raw`[cс]r[eе][aа][tт]iv[eе]`,
  String.raw`d[eе]sign`,
  String.raw`w[aа][tт][eе]r[hн][oо]us[eе]`,
] as const;

const SUKA_CASE_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[uу]`],
  [String.raw`[aа]`],
] as const;

const SUKAR_TRANSLIT_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[aа]`],
  [String.raw`[yу]`],
  [String.raw`[eе]`],
  [String.raw`[uу]`],
] as const;

const SUKACHKA_TRANSLIT_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[aа]`],
  [String.raw`i`],
  [String.raw`[eе]`],
  [String.raw`[uу]`],
] as const;

const SUKIN_TRANSLIT_TAIL_PARTS = [
  [String.raw`[oо]`, String.raw`g`, String.raw`[oо]`],
  [String.raw`[oо]`, String.raw`[mм]`, String.raw`[uу]`],
  [String.raw`[uу]`, String.raw`[yу]`, String.raw`[uу]`],
  [String.raw`[yу]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[yу]`, String.raw`[aа]`],
  [String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[oо]`, String.raw`[mм]`],
  [String.raw`[yу]`, String.raw`[mм]`],
  [String.raw`[yу]`, String.raw`[hн]`],
  [String.raw`[yу]`],
  [String.raw`[oо]`],
  [String.raw`[aа]`],
  [String.raw`[eе]`],
  [String.raw`[uу]`],
] as const;

const SUCHIY_TRANSLIT_TAIL_PARTS = [
  [String.raw`[yу]`, String.raw`[eе]`, String.raw`g`, String.raw`[oо]`],
  [String.raw`[yу]`, String.raw`[eе]`, String.raw`[mм]`, String.raw`[uу]`],
  [String.raw`[yу]`, String.raw`i`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[yу]`, String.raw`[eе]`, String.raw`[yу]`],
  [String.raw`[yу]`, String.raw`[eе]`, String.raw`[mм]`],
  [String.raw`[yу]`, String.raw`i`, String.raw`[mм]`],
  [String.raw`[yу]`, String.raw`i`, String.raw`[hн]`],
  [String.raw`i`, String.raw`[yу]`],
  [String.raw`[yу]`, String.raw`[aа]`],
  [String.raw`[yу]`, String.raw`[uу]`],
  [String.raw`[yу]`, String.raw`[eе]`],
  [String.raw`[yу]`, String.raw`i`],
] as const;

const SUKA_CASE_TAILS = joinedPatterns(SUKA_CASE_TAIL_PARTS);
const SUKAR_TRANSLIT_TAILS = joinedPatterns(SUKAR_TRANSLIT_TAIL_PARTS);
const SUKACHKA_TRANSLIT_TAILS = joinedPatterns(SUKACHKA_TRANSLIT_TAIL_PARTS);
const SUKIN_TRANSLIT_TAILS = joinedPatterns(SUKIN_TRANSLIT_TAIL_PARTS);
const SUCHKA_TRANSLIT_TAILS = SUKACHKA_TRANSLIT_TAILS;
const SUCHIY_TRANSLIT_TAILS = joinedPatterns(SUCHIY_TRANSLIT_TAIL_PARTS);

const SUKA_SPLIT_NEUTRAL_SEPARATOR = String.raw`[^\p{L}\p{N}]*`;
const SUKA_SPLIT_NEUTRAL_BASE = separatedPattern(
  [String.raw`s`, String.raw`[uу]`, String.raw`[kк]`],
  SUKA_SPLIT_NEUTRAL_SEPARATOR,
);

const SUKA_NEUTRAL_TAIL = regexAlternatives(SUKA_NEUTRAL_TAILS);
const SUKA_TRANSLIT_SOURCE = String.raw`s[uу]${regexGroup([
  String.raw`[kк]${regexGroup(SUKA_CASE_TAILS)}`,
  String.raw`[kк][aа]r${optionalRegexGroup(SUKAR_TRANSLIT_TAILS)}`,
  String.raw`[kк][aа][cс][hн][kк]${regexGroup(SUKACHKA_TRANSLIT_TAILS)}`,
  String.raw`[kк]in${optionalRegexGroup(SUKIN_TRANSLIT_TAILS)}`,
  String.raw`[cс][hн][aа]r${optionalRegexGroup(SUKAR_TRANSLIT_TAILS)}`,
  String.raw`[cс][hн][eе][kк]`,
  String.raw`[cс][hн][kк]${regexGroup(SUCHKA_TRANSLIT_TAILS)}`,
  String.raw`[cс][hн]${regexGroup(SUCHIY_TRANSLIT_TAILS)}`,
])}`;
const SUKA_SPLIT_NEUTRAL_SOURCE = String.raw`${SUKA_SPLIT_NEUTRAL_BASE}${regexGroup(
  [
    String.raw`${SUKA_SPLIT_NEUTRAL_SEPARATOR}[aа]`,
    String.raw`${SUKA_SPLIT_NEUTRAL_SEPARATOR}i${SUKA_SPLIT_NEUTRAL_SEPARATOR}n`,
  ],
)}`;

const SUKA_TRANSLIT_SPLIT_SEPARATOR = String.raw`[^\p{L}\p{N}\s]+`;
const sukaTranslitSplit = (sources: readonly string[]): string =>
  separatedPattern(sources, SUKA_TRANSLIT_SPLIT_SEPARATOR);
const sukaTranslitSplitWithTails = (
  baseParts: readonly string[],
  tails: readonly string[],
): string =>
  String.raw`${sukaTranslitSplit(baseParts)}${SUKA_TRANSLIT_SPLIT_SEPARATOR}` +
  regexGroup(tails);
const sukaTranslitSplitWithOptionalTails = (
  baseParts: readonly string[],
  tails: readonly string[],
): string =>
  String.raw`${sukaTranslitSplit(baseParts)}(?:${SUKA_TRANSLIT_SPLIT_SEPARATOR}` +
  String.raw`${regexGroup(tails)})?`;

const SUKA_SPLIT_CASE_TAILS = separatedPatterns(
  SUKA_CASE_TAIL_PARTS,
  SUKA_TRANSLIT_SPLIT_SEPARATOR,
);
const SUKAR_SPLIT_TAILS = separatedPatterns(
  SUKAR_TRANSLIT_TAIL_PARTS,
  SUKA_TRANSLIT_SPLIT_SEPARATOR,
);
const SUKACHKA_SPLIT_TAILS = separatedPatterns(
  SUKACHKA_TRANSLIT_TAIL_PARTS,
  SUKA_TRANSLIT_SPLIT_SEPARATOR,
);
const SUKIN_SPLIT_TAILS = separatedPatterns(
  SUKIN_TRANSLIT_TAIL_PARTS,
  SUKA_TRANSLIT_SPLIT_SEPARATOR,
);
const SUCHKA_SPLIT_TAILS = SUKACHKA_SPLIT_TAILS;
const SUCHIY_SPLIT_TAILS = separatedPatterns(
  SUCHIY_TRANSLIT_TAIL_PARTS,
  SUKA_TRANSLIT_SPLIT_SEPARATOR,
);

const SUKA_TRANSLIT_SPLIT_SOURCE = regexGroup([
  sukaTranslitSplitWithOptionalTails(
    [
      String.raw`s`,
      String.raw`[uу]`,
      String.raw`[kк]`,
      String.raw`[aа]`,
      String.raw`r`,
    ],
    SUKAR_SPLIT_TAILS,
  ),
  sukaTranslitSplitWithTails(
    [
      String.raw`s`,
      String.raw`[uу]`,
      String.raw`[kк]`,
      String.raw`[aа]`,
      String.raw`[cс]`,
      String.raw`[hн]`,
      String.raw`[kк]`,
    ],
    SUKACHKA_SPLIT_TAILS,
  ),
  sukaTranslitSplitWithOptionalTails(
    [
      String.raw`s`,
      String.raw`[uу]`,
      String.raw`[kк]`,
      String.raw`i`,
      String.raw`n`,
    ],
    SUKIN_SPLIT_TAILS,
  ),
  sukaTranslitSplitWithOptionalTails(
    [
      String.raw`s`,
      String.raw`[uу]`,
      String.raw`[cс]`,
      String.raw`[hн]`,
      String.raw`[aа]`,
      String.raw`r`,
    ],
    SUKAR_SPLIT_TAILS,
  ),
  sukaTranslitSplit([
    String.raw`s`,
    String.raw`[uу]`,
    String.raw`[cс]`,
    String.raw`[hн]`,
    String.raw`[eе]`,
    String.raw`[kк]`,
  ]),
  sukaTranslitSplitWithTails(
    [String.raw`s`, String.raw`[uу]`, String.raw`[kк]`],
    SUKA_SPLIT_CASE_TAILS,
  ),
  sukaTranslitSplitWithTails(
    [
      String.raw`s`,
      String.raw`[uу]`,
      String.raw`[cс]`,
      String.raw`[hн]`,
      String.raw`[kк]`,
    ],
    SUCHKA_SPLIT_TAILS,
  ),
  sukaTranslitSplitWithTails(
    [String.raw`s`, String.raw`[uу]`, String.raw`[cс]`, String.raw`[hн]`],
    SUCHIY_SPLIT_TAILS,
  ),
]);

const SUCHKA_SOFT_TAILS = [
  String.raw`его`,
  String.raw`ему`,
  String.raw`ей`,
  String.raw`ем`,
  String.raw`ими`,
  String.raw`им`,
  String.raw`их`,
  String.raw`я`,
  String.raw`и`,
  String.raw`ю`,
  String.raw`[её]`,
] as const;

const SUCHKA_FAMILY_SOURCE = String.raw`суч${regexGroup([
  String.raw`к(?:ами?|ах|ой|а|и|е|у)`,
  String.raw`ек`,
  String.raw`ий`,
  String.raw`ь${regexGroup(SUCHKA_SOFT_TAILS)}`,
  String.raw`ар(?:ой|а|ы|е|у)?${cyrillicSuffix}`,
])}`;

const SUKA_TRANSLIT_GUARDED_SOURCE = neutralContextGuardedSource(
  regexGroup([SUKA_TRANSLIT_SOURCE, SUKA_TRANSLIT_SPLIT_SOURCE]),
  SUKA_SPLIT_NEUTRAL_SOURCE,
  SUKA_NEUTRAL_TAIL,
);
// Keep the context guard in the global pass without letting loose rewriting
// insert whitespace inside initial-style text such as "S. Uka".
const SUKA_TRANSLIT_GLOBAL_SOURCE = String.raw`(?=(${SUKA_TRANSLIT_GUARDED_SOURCE}))\1`;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.insult.suka.family",
    category: "STRONG_INSULT",
    severity: "high",
    source: String.raw`сук(?:ар(?:ами?|ой|а|ы|е|у)?|ин${cyrillicSuffix}|ами?|ах|ой|а|и|е|у)`,
  }),
  russianRule({
    id: "ru.insult.suchka.family",
    category: "STRONG_INSULT",
    severity: "high",
    source: SUCHKA_FAMILY_SOURCE,
  }),
  russianRule({
    id: "ru.insult.suka.translit",
    category: "STRONG_INSULT",
    severity: "high",
    source: SUKA_TRANSLIT_GLOBAL_SOURCE,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.suka.token.loose",
    category: "STRONG_INSULT",
    severity: "high",
    source: token(String.raw`с(?:у|y)к(?:ара|ачка|учка|ин|ой|а|и|у)`),
    match: "loose",
  }),
]);
