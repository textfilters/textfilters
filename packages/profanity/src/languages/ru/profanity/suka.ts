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
const SUKA_CONTEXT_SOURCE = String.raw`${SUKA_SPLIT_NEUTRAL_BASE}${SUKA_SPLIT_NEUTRAL_SEPARATOR}[aа]`;
const SUKIN_CONTEXT_SOURCE = String.raw`${SUKA_SPLIT_NEUTRAL_BASE}${SUKA_SPLIT_NEUTRAL_SEPARATOR}i${SUKA_SPLIT_NEUTRAL_SEPARATOR}n`;
const SUKU_CONTEXT_SOURCE = String.raw`${SUKA_SPLIT_NEUTRAL_BASE}${SUKA_SPLIT_NEUTRAL_SEPARATOR}[uу]`;
const SUCHAR_CONTEXT_SOURCE = separatedPattern(
  [
    String.raw`s`,
    String.raw`[uу]`,
    String.raw`[cс]`,
    String.raw`[hн]`,
    String.raw`[aа]`,
    String.raw`r`,
  ],
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

const CYRILLIC_LOOSE_SEPARATOR = String.raw`[^\p{L}\p{N}]*`;
const separatedCyrillicLiteral = (source: string): string =>
  Array.from(source).join(CYRILLIC_LOOSE_SEPARATOR);
const SUKA_LOOSE_SOURCE = separatedCyrillicLiteral("сука");
const SUCHKA_LOOSE_SOURCE = separatedCyrillicLiteral("сучка");
const SUCHKI_LOOSE_SOURCE = separatedCyrillicLiteral("сучки");
const SUKA_CONTEXT_GUARD =
  String.raw`(?!(?<=(?<!\p{L})щенная\s+)${SUKA_LOOSE_SOURCE}(?!\p{L}))` +
  String.raw`(?!${SUKA_LOOSE_SOURCE}\s+породы\s+лабрадор(?!\p{L}))`;
const SUCHKA_CONTEXT_GUARD =
  String.raw`(?!(?<=(?<!\p{L})без\s+)${SUCHKA_LOOSE_SOURCE}\s+и\s+задоринки(?!\p{L}))` +
  String.raw`(?!${SUCHKI_LOOSE_SOURCE}\s+на\s+доске(?!\p{L}))`;

const SUKA_TRANSLIT_GUARDED_SOURCE = neutralContextGuardedSource(
  regexGroup([SUKA_TRANSLIT_SOURCE, SUKA_TRANSLIT_SPLIT_SOURCE]),
  SUKA_SPLIT_NEUTRAL_SOURCE,
  SUKA_NEUTRAL_TAIL,
);
const SUKA_TRANSLIT_EXACT_CONTEXT_GUARD =
  String.raw`(?!(?<=(?<!\p{L})s[aа][yу][aа]\s+)${SUKA_CONTEXT_SOURCE}\s+[kк][oо][pр]i(?!\p{L}))` +
  String.raw`(?!(?<=(?<!\p{L})[aа]l[eе][xх]\s+)${SUKIN_CONTEXT_SOURCE}(?!\p{L}))` +
  String.raw`(?!${SUKIN_CONTEXT_SOURCE}\s+[aа]us[tт]r[aа]li[aа](?!\p{L}))` +
  String.raw`(?!(?<=(?<!\p{L})j[aа]n\s+)${SUCHAR_CONTEXT_SOURCE}(?!\p{L}))` +
  String.raw`(?!${SUKU_CONTEXT_SOURCE}\s+[pр][eе][oо][pр]l[eе](?!\p{L}))`;
// Keep the context guard in the global pass without letting loose rewriting
// insert whitespace inside initial-style text such as "S. Uka".
const SUKA_TRANSLIT_GLOBAL_SOURCE = globalMatchSource(
  String.raw`${SUKA_TRANSLIT_EXACT_CONTEXT_GUARD}${SUKA_TRANSLIT_GUARDED_SOURCE}`,
);

const SUCHON_FORMS = regexGroup([
  String.raw`суч[оеё]н(?:ок|к(?:а|у|ом|е|и|ов|ам|ами|ах)|ыш${cyrillicSuffix})`,
]);

export default russianFamilyDictionary([
  russianRule({
    id: "ru.insult.suka.family",
    category: "STRONG_INSULT",
    severity: "medium",
    source: String.raw`${SUKA_CONTEXT_GUARD}сук(?:ар(?:ами?|ой|а|ы|е|у)?|ин${cyrillicSuffix}|ами?|ах|ой|а|и|е|у)`,
    match: "loose",
    loose: { stretch: true },
  }),
  russianRule({
    id: "ru.insult.suchka.family",
    category: "STRONG_INSULT",
    severity: "medium",
    source: String.raw`${SUCHKA_CONTEXT_GUARD}${SUCHKA_FAMILY_SOURCE}`,
    match: "loose",
    loose: { stretch: true },
  }),
  russianRule({
    id: "ru.insult.suka.translit",
    category: "STRONG_INSULT",
    severity: "medium",
    source: SUKA_TRANSLIT_GLOBAL_SOURCE,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.suka.token.loose",
    category: "STRONG_INSULT",
    severity: "medium",
    source: token(
      String.raw`${SUKA_CONTEXT_GUARD}с(?:у|y)к(?:ара|ачка|учка|ин|ой|а|и|у)`,
    ),
    match: "loose",
    loose: { stretch: true },
  }),
  russianRule({
    id: "ru.insult.suchon.family",
    category: "STRONG_INSULT",
    severity: "medium",
    source: token(SUCHON_FORMS),
    match: "strict",
  }),
]);
