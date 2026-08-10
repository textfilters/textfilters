import {
  cyrillicAdjectiveTailParts,
  cyrillicSuffix,
  joinedPatterns,
  neutralContextGuardedSource,
  optionalRegexGroup,
  prefixedPatternSequences,
  regexAlternatives,
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  separatedPattern,
  separatedPatterns,
  splitPattern,
  token,
  transliteratedAdjectiveTailParts,
} from "./authoring.js";

const ZALUPA_NEUTRAL_TAILS = [
  String.raw`n[aа][mм][eе]`,
  String.raw`surn[aа][mм][eе]`,
  String.raw`[pр]r[oо]fil[eе]`,
  String.raw`[aа][cс][cс][oо]un[tт]`,
  String.raw`url`,
  String.raw`d[oо][mм][aа]in`,
  String.raw`[pр]r[oо]j[eе][cс][tт]`,
  String.raw`r[eе][pр][oо]si[tт][oо]r[yу]`,
] as const;

const ZALUPLENN_TRANSLIT_TAIL_PARTS = prefixedPatternSequences(
  [String.raw`l`, String.raw`[eе]`, String.raw`n`, String.raw`n`],
  transliteratedAdjectiveTailParts,
);
const ZALUPLENN_TRANSLIT_TAILS = joinedPatterns(ZALUPLENN_TRANSLIT_TAIL_PARTS);

const ZALUPA_TRANSLIT_TAILS = [
  ...ZALUPLENN_TRANSLIT_TAILS,
  String.raw`[aа][mм]i`,
  String.raw`[aа][mм]`,
  String.raw`[aа][hн]`,
  String.raw`[oо][yу]`,
  String.raw`[aа]`,
  String.raw`[yу]`,
  String.raw`[eе]`,
  String.raw`u`,
  String.raw`il[aа]s[yу][aа]`,
  String.raw`ilis[yу][aа]`,
  String.raw`il[oо]s[yу][aа]`,
  String.raw`ils[yу][aа]`,
  String.raw`is[hн]s[yу][aа]`,
  String.raw`is[yу][aа]`,
  String.raw`is`,
  String.raw`[yу][aа][tт]s[yу][aа]`,
  String.raw`l[yу][uу]s`,
  String.raw`l[uу]s`,
  String.raw`i[tт]s[yу][aа]`,
] as const;

const ZALUPA_FAMILY_TAILS = [
  String.raw`а`,
  String.raw`ы`,
  String.raw`е`,
  String.raw`у`,
  String.raw`ой`,
  String.raw`ам`,
  String.raw`ами`,
  String.raw`ах`,
  String.raw`ил(?:ся|ась|ись|ось)?`,
  String.raw`и(?:лся|ться|шься|тся|мся|тесь|сь|вш${cyrillicSuffix})`,
  String.raw`люсь`,
  String.raw`ятся`,
  String.raw`ленн${cyrillicSuffix}`,
] as const;

const ZALUPA_NEUTRAL_TAIL = regexAlternatives(ZALUPA_NEUTRAL_TAILS);
const ZALUPA_TRANSLIT_BASE = String.raw`z(?=[aа])[aа](?=l)l(?=[uу])[uу](?=[pр])[pр]`;
const ZALUPA_TRANSLIT_SOURCE = String.raw`${ZALUPA_TRANSLIT_BASE}${optionalRegexGroup(ZALUPA_TRANSLIT_TAILS)}`;

const ZALUPA_SPLIT_NEUTRAL_SEPARATOR = String.raw`[^\p{L}\p{N}]*`;
const ZALUPA_SPLIT_NEUTRAL_BASE = separatedPattern(
  [
    String.raw`z`,
    String.raw`[aа]`,
    String.raw`l`,
    String.raw`[uу]`,
    String.raw`[pр]`,
  ],
  ZALUPA_SPLIT_NEUTRAL_SEPARATOR,
);
const ZALUPA_SPLIT_NEUTRAL_SOURCE = String.raw`${ZALUPA_SPLIT_NEUTRAL_BASE}(?:${ZALUPA_SPLIT_NEUTRAL_SEPARATOR}[aа])?`;

const ZALUPA_SPLIT_SEP = String.raw`[^\p{L}\p{N}\s]+`;
const zalupaSplit = splitPattern(ZALUPA_SPLIT_SEP);

const ZALUPA_SPLIT_TRANSLIT_NOUN_TAILS = [
  String.raw`[aа]${ZALUPA_SPLIT_SEP}[mм](?:${ZALUPA_SPLIT_SEP}i)?`,
  String.raw`[oо]${ZALUPA_SPLIT_SEP}[yу]`,
  String.raw`[aа]${ZALUPA_SPLIT_SEP}[hн]`,
  String.raw`[aа]`,
  String.raw`[yу]`,
  String.raw`[eе]`,
  String.raw`u`,
] as const;

const ZALUPA_SPLIT_IL_TAILS = [
  zalupaSplit([String.raw`s`, String.raw`[yу]`, String.raw`[aа]`]),
  zalupaSplit([
    String.raw`[aа]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ]),
  zalupaSplit([
    String.raw`i`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ]),
  zalupaSplit([
    String.raw`[oо]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ]),
] as const;

const ZALUPA_SPLIT_TRANSLIT_VERB_TAILS = [
  String.raw`i${ZALUPA_SPLIT_SEP}l${ZALUPA_SPLIT_SEP}${regexGroup(ZALUPA_SPLIT_IL_TAILS)}`,
  zalupaSplit([
    String.raw`i`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ]),
  zalupaSplit([
    String.raw`i`,
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ]),
  zalupaSplit([String.raw`i`, String.raw`s`]),
  zalupaSplit([
    String.raw`[yу]`,
    String.raw`[aа]`,
    String.raw`[tт]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ]),
  zalupaSplit([
    String.raw`l`,
    String.raw`[yу]`,
    String.raw`[uу]`,
    String.raw`s`,
  ]),
  zalupaSplit([String.raw`l`, String.raw`[uу]`, String.raw`s`]),
  zalupaSplit([
    String.raw`i`,
    String.raw`[tт]`,
    String.raw`s`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ]),
] as const;
const ZALUPA_SPLIT_TRANSLIT_PASSIVE_TAILS = separatedPatterns(
  ZALUPLENN_TRANSLIT_TAIL_PARTS,
  ZALUPA_SPLIT_SEP,
);

const ZALUPA_SPLIT_TRANSLIT_TAIL = regexGroup([
  regexGroup(ZALUPA_SPLIT_TRANSLIT_PASSIVE_TAILS),
  regexGroup(ZALUPA_SPLIT_TRANSLIT_VERB_TAILS),
  regexGroup(ZALUPA_SPLIT_TRANSLIT_NOUN_TAILS),
]);

const ZALUPA_CYRILLIC_SPLIT_SEP = String.raw`[^\p{L}\p{N}]+`;
const ZALUPA_CYRILLIC_SPLIT_BASE = separatedPattern(
  [String.raw`з`, String.raw`а`, String.raw`л`, String.raw`у`, String.raw`п`],
  ZALUPA_CYRILLIC_SPLIT_SEP,
);
const ZALUPA_CYRILLIC_VERB_SPLIT_SEP = String.raw`[-._]+`;
const ZALUPA_CYRILLIC_VERB_SPLIT_BASE = separatedPattern(
  [String.raw`з`, String.raw`а`, String.raw`л`, String.raw`у`, String.raw`п`],
  ZALUPA_CYRILLIC_VERB_SPLIT_SEP,
);
const ZALUPA_CYRILLIC_NOUN_TAIL_PARTS = [
  [String.raw`а`, String.raw`м`, String.raw`и`],
  [String.raw`а`, String.raw`м`],
  [String.raw`а`, String.raw`х`],
  [String.raw`о`, String.raw`й`],
  [String.raw`а`],
  [String.raw`ы`],
  [String.raw`е`],
  [String.raw`у`],
] as const;
const ZALUPA_CYRILLIC_VERB_TAIL_PARTS = [
  ...prefixedPatternSequences(
    [String.raw`л`, String.raw`е`, String.raw`н`, String.raw`н`],
    cyrillicAdjectiveTailParts,
  ),
  [String.raw`и`, String.raw`л`, String.raw`а`, String.raw`с`, String.raw`ь`],
  [String.raw`и`, String.raw`л`, String.raw`и`, String.raw`с`, String.raw`ь`],
  [String.raw`и`, String.raw`л`, String.raw`о`, String.raw`с`, String.raw`ь`],
  [String.raw`и`, String.raw`ш`, String.raw`ь`, String.raw`с`, String.raw`я`],
  [String.raw`и`, String.raw`т`, String.raw`ь`, String.raw`с`, String.raw`я`],
  [String.raw`и`, String.raw`т`, String.raw`е`, String.raw`с`, String.raw`ь`],
  [String.raw`л`, String.raw`ю`, String.raw`с`, String.raw`ь`],
  [String.raw`и`, String.raw`л`, String.raw`с`, String.raw`я`],
  [String.raw`и`, String.raw`т`, String.raw`с`, String.raw`я`],
  [String.raw`и`, String.raw`м`, String.raw`с`, String.raw`я`],
  [String.raw`я`, String.raw`т`, String.raw`с`, String.raw`я`],
  [String.raw`и`, String.raw`с`, String.raw`ь`],
  [String.raw`и`, String.raw`л`],
] as const;
const ZALUPA_CYRILLIC_NOUN_SPLIT_TAILS = separatedPatterns(
  ZALUPA_CYRILLIC_NOUN_TAIL_PARTS,
  ZALUPA_CYRILLIC_SPLIT_SEP,
);
const ZALUPA_CYRILLIC_VERB_SPLIT_TAILS = separatedPatterns(
  ZALUPA_CYRILLIC_VERB_TAIL_PARTS,
  ZALUPA_CYRILLIC_VERB_SPLIT_SEP,
);

const ZALUPA_CYRILLIC_COMPACT_TAILS = [
  String.raw`ил(?:ся|ась|ись|ось)?`,
  String.raw`и(?:лся|ться|шься|тся|мся|тесь|сь|вш${cyrillicSuffix})`,
  String.raw`люсь`,
  String.raw`ятся`,
  String.raw`ленн${cyrillicSuffix}`,
  String.raw`ами`,
  String.raw`ам`,
  String.raw`ах`,
  String.raw`ой`,
  String.raw`а`,
  String.raw`ы`,
  String.raw`е`,
  String.raw`у`,
] as const;

const ZALUPA_TRANSLIT_SPLIT_BASE = separatedPattern(
  [
    String.raw`z`,
    String.raw`[aа]`,
    String.raw`l`,
    String.raw`[uу]`,
    String.raw`[pр]`,
  ],
  ZALUPA_SPLIT_SEP,
);

const ZALUPA_SPLIT_LOOSE_SOURCE = regexGroup([
  String.raw`${ZALUPA_CYRILLIC_VERB_SPLIT_BASE}` +
    String.raw`${ZALUPA_CYRILLIC_VERB_SPLIT_SEP}` +
    String.raw`${regexGroup(ZALUPA_CYRILLIC_VERB_SPLIT_TAILS)}`,
  String.raw`${ZALUPA_CYRILLIC_SPLIT_BASE}` +
    String.raw`${ZALUPA_CYRILLIC_SPLIT_SEP}` +
    String.raw`${regexGroup(ZALUPA_CYRILLIC_NOUN_SPLIT_TAILS)}`,
  ZALUPA_CYRILLIC_SPLIT_BASE,
  String.raw`за${ZALUPA_SPLIT_SEP}луп${optionalRegexGroup(ZALUPA_CYRILLIC_COMPACT_TAILS)}`,
  String.raw`${ZALUPA_TRANSLIT_SPLIT_BASE}${ZALUPA_SPLIT_SEP}${ZALUPA_SPLIT_TRANSLIT_TAIL}`,
  ZALUPA_TRANSLIT_SPLIT_BASE,
  String.raw`z[aа]${ZALUPA_SPLIT_SEP}l[uу][pр]${optionalRegexGroup(
    ZALUPA_TRANSLIT_TAILS,
  )}`,
]);

const ZALUPA_TRANSLIT_GUARDED_SOURCE = neutralContextGuardedSource(
  ZALUPA_TRANSLIT_SOURCE,
  ZALUPA_SPLIT_NEUTRAL_SOURCE,
  ZALUPA_NEUTRAL_TAIL,
);
const ZALUPA_SPLIT_GUARDED_SOURCE = neutralContextGuardedSource(
  ZALUPA_SPLIT_LOOSE_SOURCE,
  ZALUPA_SPLIT_NEUTRAL_SOURCE,
  ZALUPA_NEUTRAL_TAIL,
);

const ZALUPAT_TAIL = regexGroup([
  String.raw`ться`,
  String.raw`юсь`,
  String.raw`ешься`,
  String.raw`ется`,
  String.raw`емся`,
  String.raw`етесь`,
  String.raw`ются`,
  String.raw`лся`,
  String.raw`лась`,
  String.raw`лось`,
  String.raw`лись`,
  String.raw`йся`,
  String.raw`йтесь`,
]);

export default russianFamilyDictionary([
  russianRule({
    id: "ru.obscene.zalupa.family",
    category: "OBSCENE_MAT",
    severity: "high",
    source: String.raw`залуп${optionalRegexGroup(ZALUPA_FAMILY_TAILS)}`,
    match: "strict",
  }),
  russianRule({
    id: "ru.obscene.zalupa.translit",
    category: "OBSCENE_MAT",
    severity: "high",
    source: ZALUPA_TRANSLIT_GUARDED_SOURCE,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.obscene.zalupa.split.loose",
    category: "OBSCENE_MAT",
    severity: "high",
    source: ZALUPA_SPLIT_GUARDED_SOURCE,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.obscene.zalupat.family",
    category: "OBSCENE_MAT",
    severity: "high",
    source: token(String.raw`залупа${ZALUPAT_TAIL}`),
    match: "strict",
  }),
]);
