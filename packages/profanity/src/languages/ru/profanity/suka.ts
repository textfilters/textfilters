import {
  cyrillicSuffix,
  globalMatchSource,
  neutralContextGuardedSource,
  optionalRegexGroup,
  patternTailViews,
  regexAlternatives,
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  separatedPattern,
  splitPattern,
  splitPatternWithOptionalTails,
  splitPatternWithTails,
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

const SUKA_TRANSLIT_SPLIT_SEPARATOR = String.raw`[^\p{L}\p{N}\s]+`;
const SUKA_CASE_TAILS = patternTailViews(
  SUKA_CASE_TAIL_PARTS,
  SUKA_TRANSLIT_SPLIT_SEPARATOR,
);
const SUKAR_TRANSLIT_TAILS = patternTailViews(
  SUKAR_TRANSLIT_TAIL_PARTS,
  SUKA_TRANSLIT_SPLIT_SEPARATOR,
);
const SUKACHKA_TRANSLIT_TAILS = patternTailViews(
  SUKACHKA_TRANSLIT_TAIL_PARTS,
  SUKA_TRANSLIT_SPLIT_SEPARATOR,
);
const SUKIN_TRANSLIT_TAILS = patternTailViews(
  SUKIN_TRANSLIT_TAIL_PARTS,
  SUKA_TRANSLIT_SPLIT_SEPARATOR,
);
const SUCHKA_TRANSLIT_TAILS = SUKACHKA_TRANSLIT_TAILS;
const SUCHIY_TRANSLIT_TAILS = patternTailViews(
  SUCHIY_TRANSLIT_TAIL_PARTS,
  SUKA_TRANSLIT_SPLIT_SEPARATOR,
);

const SUKA_SPLIT_NEUTRAL_SEPARATOR = String.raw`[^\p{L}\p{N}]*`;
const SUKA_SPLIT_NEUTRAL_BASE = separatedPattern(
  [String.raw`s`, String.raw`[uу]`, String.raw`[kк]`],
  SUKA_SPLIT_NEUTRAL_SEPARATOR,
);

const SUKA_NEUTRAL_TAIL = regexAlternatives(SUKA_NEUTRAL_TAILS);
const SUKA_TRANSLIT_SOURCE = String.raw`s[uу]${regexGroup([
  String.raw`[kк]${regexGroup(SUKA_CASE_TAILS.joined)}`,
  String.raw`[kк][aа]r${optionalRegexGroup(SUKAR_TRANSLIT_TAILS.joined)}`,
  String.raw`[kк][aа][cс][hн][kк]${regexGroup(SUKACHKA_TRANSLIT_TAILS.joined)}`,
  String.raw`[kк]in${optionalRegexGroup(SUKIN_TRANSLIT_TAILS.joined)}`,
  String.raw`[cс][hн][aа]r${optionalRegexGroup(SUKAR_TRANSLIT_TAILS.joined)}`,
  String.raw`[cс][hн][eе][kк]`,
  String.raw`[cс][hн][kк]${regexGroup(SUCHKA_TRANSLIT_TAILS.joined)}`,
  String.raw`[cс][hн]${regexGroup(SUCHIY_TRANSLIT_TAILS.joined)}`,
])}`;
const SUKA_SPLIT_NEUTRAL_SOURCE = String.raw`${SUKA_SPLIT_NEUTRAL_BASE}${regexGroup(
  [
    String.raw`${SUKA_SPLIT_NEUTRAL_SEPARATOR}[aа]`,
    String.raw`${SUKA_SPLIT_NEUTRAL_SEPARATOR}i${SUKA_SPLIT_NEUTRAL_SEPARATOR}n`,
  ],
)}`;

const sukaTranslitSplit = splitPattern(SUKA_TRANSLIT_SPLIT_SEPARATOR);
const sukaTranslitSplitWithTails = splitPatternWithTails(
  SUKA_TRANSLIT_SPLIT_SEPARATOR,
);
const sukaTranslitSplitWithOptionalTails = splitPatternWithOptionalTails(
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
    SUKAR_TRANSLIT_TAILS.separated,
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
    SUKACHKA_TRANSLIT_TAILS.separated,
  ),
  sukaTranslitSplitWithOptionalTails(
    [
      String.raw`s`,
      String.raw`[uу]`,
      String.raw`[kк]`,
      String.raw`i`,
      String.raw`n`,
    ],
    SUKIN_TRANSLIT_TAILS.separated,
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
    SUKAR_TRANSLIT_TAILS.separated,
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
    SUKA_CASE_TAILS.separated,
  ),
  sukaTranslitSplitWithTails(
    [
      String.raw`s`,
      String.raw`[uу]`,
      String.raw`[cс]`,
      String.raw`[hн]`,
      String.raw`[kк]`,
    ],
    SUCHKA_TRANSLIT_TAILS.separated,
  ),
  sukaTranslitSplitWithTails(
    [String.raw`s`, String.raw`[uу]`, String.raw`[cс]`, String.raw`[hн]`],
    SUCHIY_TRANSLIT_TAILS.separated,
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
const SUKA_TRANSLIT_CONTEXT_NEUTRAL_SOURCE = regexGroup([
  String.raw`s[uу][kк][aа]\s+[kк][oо][pр]i(?!\p{L})`,
  String.raw`s[uу][kк]in\s+[aа]us[tт]r[aа]li[aа](?!\p{L})`,
  String.raw`s[uу][kк]u\s+[pр][eе][oо][pр]l[eе](?!\p{L})`,
]);
const SUKIN_NAME_SOURCE = String.raw`s[uу][kк]in(?!\p{L})`;
const SUCHAR_NAME_SOURCE = String.raw`s[uу][cс][hн][aа]r(?!\p{L})`;
// Keep the context guard in the global pass without letting loose rewriting
// insert whitespace inside initial-style text such as "S. Uka".
const SUKA_TRANSLIT_CONTEXT_GUARDED_SOURCE = globalMatchSource(
  String.raw`(?!(?<=[aа]l[eе][xх]\s+)${SUKIN_NAME_SOURCE})` +
    String.raw`(?!(?<=j[aа]n\s+)${SUCHAR_NAME_SOURCE})` +
    String.raw`(?!${SUKA_TRANSLIT_CONTEXT_NEUTRAL_SOURCE})` +
    SUKA_TRANSLIT_GUARDED_SOURCE,
);
const SUKA_CYRILLIC_SEPARATOR = String.raw`[^\p{L}\p{N}]*`;
const SUKA_CYRILLIC_IN_TOKEN_SEPARATOR = String.raw`[^\p{L}\p{N}\s]*`;
const SUKA_CYRILLIC_BASE = String.raw`с${SUKA_CYRILLIC_SEPARATOR}у${SUKA_CYRILLIC_SEPARATOR}к`;
const SUKA_CYRILLIC_TAIL = regexGroup([
  String.raw`а${SUKA_CYRILLIC_SEPARATOR}ч${SUKA_CYRILLIC_SEPARATOR}к${SUKA_CYRILLIC_SEPARATOR}а`,
  String.raw`и${SUKA_CYRILLIC_SEPARATOR}н(?:${SUKA_CYRILLIC_IN_TOKEN_SEPARATOR}[а-яё])*`,
  String.raw`а${SUKA_CYRILLIC_SEPARATOR}р(?:${SUKA_CYRILLIC_IN_TOKEN_SEPARATOR}[а-яё])*`,
  String.raw`а(?:${SUKA_CYRILLIC_SEPARATOR}м(?:${SUKA_CYRILLIC_SEPARATOR}и)?|${SUKA_CYRILLIC_SEPARATOR}х)?`,
  String.raw`о${SUKA_CYRILLIC_SEPARATOR}й`,
  String.raw`[иеу]`,
]);
const SUKA_CYRILLIC_SOURCE = globalMatchSource(
  String.raw`(?<!\p{L})(?<!щенная\s+)(?!${SUKA_CYRILLIC_BASE}${SUKA_CYRILLIC_SEPARATOR}а\s+породы)` +
    String.raw`${SUKA_CYRILLIC_BASE}${SUKA_CYRILLIC_SEPARATOR}${SUKA_CYRILLIC_TAIL}(?!\p{L})`,
);
const SUCHKA_CYRILLIC_BASE = String.raw`с${SUKA_CYRILLIC_SEPARATOR}у${SUKA_CYRILLIC_SEPARATOR}ч`;
const SUCHKI_CYRILLIC_SOURCE = String.raw`${SUCHKA_CYRILLIC_BASE}${SUKA_CYRILLIC_SEPARATOR}к${SUKA_CYRILLIC_SEPARATOR}и`;
const SUCHKA_CYRILLIC_TAIL = regexGroup([
  String.raw`к${SUKA_CYRILLIC_SEPARATOR}(?:а${SUKA_CYRILLIC_SEPARATOR}м${SUKA_CYRILLIC_SEPARATOR}и|а${SUKA_CYRILLIC_SEPARATOR}м|а${SUKA_CYRILLIC_SEPARATOR}х|о${SUKA_CYRILLIC_SEPARATOR}й|[аиеу])`,
  String.raw`е${SUKA_CYRILLIC_SEPARATOR}к`,
  String.raw`и${SUKA_CYRILLIC_SEPARATOR}й`,
  String.raw`ь${SUKA_CYRILLIC_SEPARATOR}${regexGroup([
    String.raw`е${SUKA_CYRILLIC_SEPARATOR}г${SUKA_CYRILLIC_SEPARATOR}о`,
    String.raw`е${SUKA_CYRILLIC_SEPARATOR}м${SUKA_CYRILLIC_SEPARATOR}у`,
    String.raw`и${SUKA_CYRILLIC_SEPARATOR}м${SUKA_CYRILLIC_SEPARATOR}и`,
    String.raw`е${SUKA_CYRILLIC_SEPARATOR}й`,
    String.raw`е${SUKA_CYRILLIC_SEPARATOR}м`,
    String.raw`и${SUKA_CYRILLIC_SEPARATOR}м`,
    String.raw`и${SUKA_CYRILLIC_SEPARATOR}х`,
    String.raw`[яиюеё]`,
  ])}`,
  String.raw`ар(?:ой|а|ы|е|у)?${cyrillicSuffix}`,
]);
const SUCHKA_CONTEXT_GUARDED_SOURCE = globalMatchSource(
  String.raw`(?<!\p{L})(?<!без\s+)(?!${SUCHKI_CYRILLIC_SOURCE}\s+на\s+доске(?!\p{L}))${SUCHKA_CYRILLIC_BASE}${SUKA_CYRILLIC_SEPARATOR}${SUCHKA_CYRILLIC_TAIL}(?!\p{L})`,
);
const SUKA_TOKEN_SOURCE = globalMatchSource(
  String.raw`(?<!\p{L})с(?:у|y)к(?:ара|ачка|учка)(?!\p{L})`,
);

export default russianFamilyDictionary([
  russianRule({
    id: "ru.insult.suka.family",
    category: "STRONG_INSULT",
    severity: "medium",
    source: SUKA_CYRILLIC_SOURCE,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.suchka.family",
    category: "STRONG_INSULT",
    severity: "medium",
    source: SUCHKA_CONTEXT_GUARDED_SOURCE,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.suka.translit",
    category: "STRONG_INSULT",
    severity: "medium",
    source: SUKA_TRANSLIT_CONTEXT_GUARDED_SOURCE,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.suka.token.loose",
    category: "STRONG_INSULT",
    severity: "medium",
    source: SUKA_TOKEN_SOURCE,
    match: "loose",
  }),
]);
