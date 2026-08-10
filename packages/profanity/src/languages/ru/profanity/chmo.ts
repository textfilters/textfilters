import {
  cyrillicSuffix,
  globalMatchSource,
  joinedPatterns,
  neutralContextGuardedSource,
  optionalRegexGroup,
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  separatedPattern,
  separatedPatterns,
  token,
} from "./authoring.js";

const CHMO_TAIL_PARTS = [
  [String.raw`[oо]`, String.raw`[mм]`],
  [String.raw`[oо]`],
  [String.raw`[uу]`],
  [String.raw`[eе]`],
] as const;

const CHMOSHNIK_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[mм]`],
  [String.raw`[oо]`, String.raw`v`],
  [String.raw`[aа]`],
  [String.raw`[uу]`],
  [String.raw`[eе]`],
  [String.raw`i`],
] as const;

const CHMYR_TAIL_PARTS = [
  [String.raw`[yу]`, String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[yу]`, String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[yу]`, String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[eе]`, String.raw`[yу]`],
  [String.raw`[yу]`, String.raw`[aа]`],
  [String.raw`[yу]`, String.raw`[uу]`],
  [String.raw`[eе]`, String.raw`[mм]`],
  [String.raw`[eе]`],
  [String.raw`i`],
] as const;

const CHMO_TRANSLIT_TAILS = joinedPatterns(CHMO_TAIL_PARTS);
const CHMOSHNIK_TRANSLIT_TAILS = joinedPatterns(CHMOSHNIK_TAIL_PARTS);
const CHMYR_TRANSLIT_TAILS = joinedPatterns(CHMYR_TAIL_PARTS);
const CHMO_TRANSLIT_SOURCE = regexGroup([
  String.raw`[cс][hн][mм]${regexGroup(CHMO_TRANSLIT_TAILS)}`,
  String.raw`[cс][hн][mм][oо]s[hн]ni[kк]${optionalRegexGroup(
    CHMOSHNIK_TRANSLIT_TAILS,
  )}`,
  String.raw`[cс][hн][mм][yу]r${optionalRegexGroup(CHMYR_TRANSLIT_TAILS)}`,
]);
const CHMO_TRANSLIT_CONTEXT_GUARDED_SOURCE =
  String.raw`(?<![oо]l[eе][kк]s[aа]ndr\s+)` +
  String.raw`(?![cс][hн][mм][oо]\s+[eе]nz[yу][mм][eе])` +
  CHMO_TRANSLIT_SOURCE;

const CHMO_SPLIT_SEP = String.raw`[-._]+`;
const chmoSplit = (sources: readonly string[]): string =>
  separatedPattern(sources, CHMO_SPLIT_SEP);

const CHMO_SPLIT_BASES = [
  chmoSplit([String.raw`[cс]`, String.raw`[hн]`, String.raw`[mм]`]),
  chmoSplit([String.raw`[cс][hн]`, String.raw`[mм]`]),
] as const;
const CHMO_SPLIT_TAILS = separatedPatterns(CHMO_TAIL_PARTS, CHMO_SPLIT_SEP);

const CHMOSHNIK_SPLIT_BASES = [
  chmoSplit([
    String.raw`[cс]`,
    String.raw`[hн]`,
    String.raw`[mм]`,
    String.raw`[oо]`,
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`n`,
    String.raw`i`,
    String.raw`[kк]`,
  ]),
  chmoSplit([
    String.raw`[cс][hн]`,
    String.raw`[mм]`,
    String.raw`[oо]`,
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`n`,
    String.raw`i`,
    String.raw`[kк]`,
  ]),
] as const;
const CHMOSHNIK_SPLIT_TAILS = separatedPatterns(
  CHMOSHNIK_TAIL_PARTS,
  CHMO_SPLIT_SEP,
);

const CHMYR_SPLIT_BASES = [
  chmoSplit([
    String.raw`[cс]`,
    String.raw`[hн]`,
    String.raw`[mм]`,
    String.raw`[yу]`,
    String.raw`r`,
  ]),
  chmoSplit([
    String.raw`[cс][hн]`,
    String.raw`[mм]`,
    String.raw`[yу]`,
    String.raw`r`,
  ]),
] as const;
const CHMYR_SPLIT_TAILS = separatedPatterns(CHMYR_TAIL_PARTS, CHMO_SPLIT_SEP);

const CHMO_SPLIT_SOURCE = regexGroup([
  String.raw`${regexGroup(CHMOSHNIK_SPLIT_BASES)}(?:${CHMO_SPLIT_SEP}${regexGroup(
    CHMOSHNIK_SPLIT_TAILS,
  )})?`,
  String.raw`${regexGroup(CHMYR_SPLIT_BASES)}(?:${CHMO_SPLIT_SEP}${regexGroup(
    CHMYR_SPLIT_TAILS,
  )})?`,
  String.raw`${regexGroup(CHMO_SPLIT_BASES)}${CHMO_SPLIT_SEP}${regexGroup(
    CHMO_SPLIT_TAILS,
  )}`,
]);
const CHMO_SPLIT_HMO_CONTEXT = String.raw`${regexGroup(
  CHMO_SPLIT_BASES,
)}${CHMO_SPLIT_SEP}[oо]`;
const CHMO_SPLIT_GUARDED_SOURCE = neutralContextGuardedSource(
  CHMO_SPLIT_SOURCE,
  CHMO_SPLIT_HMO_CONTEXT,
  regexGroup([String.raw`d`, String.raw`[pр]l[aа]n`]),
);

const CHMO_CYRILLIC_SPLIT_BASE = chmoSplit([String.raw`ч`, String.raw`м`]);
const CHMOSHNIK_CYRILLIC_SPLIT_BASE = chmoSplit([
  String.raw`ч`,
  String.raw`м`,
  String.raw`о`,
  String.raw`ш`,
  String.raw`н`,
  String.raw`и`,
  String.raw`к`,
]);
const CHMOSHNIK_CYRILLIC_TAIL_PARTS = [
  [String.raw`а`, String.raw`м`, String.raw`и`],
  [String.raw`а`, String.raw`м`],
  [String.raw`а`, String.raw`х`],
  [String.raw`о`, String.raw`м`],
  [String.raw`о`, String.raw`в`],
  [String.raw`а`],
  [String.raw`у`],
  [String.raw`е`],
  [String.raw`и`],
] as const;
const CHMYR_CYRILLIC_SPLIT_BASE = chmoSplit([
  String.raw`ч`,
  String.raw`м`,
  String.raw`ы`,
  String.raw`р`,
]);
const CHMYR_CYRILLIC_TAIL_PARTS = [
  [String.raw`я`, String.raw`м`, String.raw`и`],
  [String.raw`я`, String.raw`м`],
  [String.raw`я`, String.raw`х`],
  [String.raw`[её]`, String.raw`м`],
  [String.raw`е`, String.raw`й`],
  [String.raw`ь`],
  [String.raw`я`],
  [String.raw`ю`],
  [String.raw`е`],
  [String.raw`и`],
] as const;
const CHMO_CYRILLIC_SPLIT_SOURCE = regexGroup([
  String.raw`${CHMOSHNIK_CYRILLIC_SPLIT_BASE}(?:${CHMO_SPLIT_SEP}${regexGroup(
    separatedPatterns(CHMOSHNIK_CYRILLIC_TAIL_PARTS, CHMO_SPLIT_SEP),
  )})?`,
  String.raw`${CHMYR_CYRILLIC_SPLIT_BASE}(?:${CHMO_SPLIT_SEP}${regexGroup(
    separatedPatterns(CHMYR_CYRILLIC_TAIL_PARTS, CHMO_SPLIT_SEP),
  )})?`,
  String.raw`${CHMO_CYRILLIC_SPLIT_BASE}(?:${CHMO_SPLIT_SEP}о${CHMO_SPLIT_SEP}м|${CHMO_SPLIT_SEP}[уе])`,
]);

export default russianFamilyDictionary([
  russianRule({
    id: "ru.insult.chmo.base",
    category: "STRONG_INSULT",
    severity: "medium",
    source: token(String.raw`чмо`),
  }),
  russianRule({
    id: "ru.insult.chmo.declined",
    category: "STRONG_INSULT",
    severity: "medium",
    source: token(String.raw`чм(?:ом|у|е)`),
    match: "strict",
  }),
  russianRule({
    id: "ru.insult.chmo.declined.split.loose",
    category: "STRONG_INSULT",
    severity: "medium",
    source: String.raw`(?<!\p{L})${CHMO_CYRILLIC_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.chmoshnik.family",
    category: "STRONG_INSULT",
    severity: "medium",
    source: String.raw`чмошник${cyrillicSuffix}`,
    match: "strict",
  }),
  russianRule({
    id: "ru.insult.chmyr.family",
    category: "STRONG_INSULT",
    severity: "medium",
    source: globalMatchSource(
      String.raw`(?<!\p{L})(?<!сергей\s+)чмыр(?:ь|я|ю|[её]м|е|и|ей|ями?|ях)?(?!\p{L})`,
    ),
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.chmo.translit",
    category: "STRONG_INSULT",
    severity: "medium",
    source: globalMatchSource(
      String.raw`(?<!\p{L})${CHMO_TRANSLIT_CONTEXT_GUARDED_SOURCE}(?!\p{L})`,
    ),
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.chmo.translit.split.loose",
    category: "STRONG_INSULT",
    severity: "medium",
    source: CHMO_SPLIT_GUARDED_SOURCE,
    match: "loose",
    loose: {},
  }),
]);
