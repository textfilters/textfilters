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
  token,
} from "./authoring.js";

const HER_SPLIT_SEPARATOR = String.raw`[-._]+`;
const HER_SPLIT_TAILS = [
  String.raw`а${HER_SPLIT_SEPARATOR}м${HER_SPLIT_SEPARATOR}и`,
  String.raw`о${HER_SPLIT_SEPARATOR}м`,
  String.raw`а${HER_SPLIT_SEPARATOR}м`,
  String.raw`а${HER_SPLIT_SEPARATOR}х`,
  String.raw`а`,
  String.raw`у`,
  String.raw`е`,
  String.raw`ы`,
] as const;

const HER_CASE_TRANSLIT_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[mм]`],
  [String.raw`[aа]`],
  [String.raw`[uу]`],
  [String.raw`[eе]`],
  [String.raw`[yу]`],
] as const;

const HERNYA_TAILS = [
  String.raw`ями`,
  String.raw`ям`,
  String.raw`ях`,
  String.raw`ёй`,
  String.raw`ей`,
  String.raw`я`,
  String.raw`и`,
  String.raw`е`,
  String.raw`ю`,
] as const;

const HEROV_CYRILLIC_TAILS = [
  String.raw`ый`,
  String.raw`ая`,
  String.raw`ое`,
  String.raw`ые`,
  String.raw`ого`,
  String.raw`ому`,
  String.raw`ую`,
  String.raw`ой`,
  String.raw`ом`,
  String.raw`ых`,
  String.raw`о`,
  String.raw`ей`,
  String.raw`ыми`,
  String.raw`ым`,
] as const;

const OHERET_CYRILLIC_TAILS = [
  String.raw`ть`,
  String.raw`л`,
  String.raw`ли`,
  String.raw`ла`,
  String.raw`ло`,
  String.raw`ю`,
  String.raw`ешь`,
  String.raw`ет`,
  String.raw`ем`,
  String.raw`ете`,
  String.raw`ют`,
  String.raw`й`,
  String.raw`йте`,
] as const;

const OHEREVSH_CYRILLIC_TAIL_PARTS = [
  [String.raw`е`, String.raw`г`, String.raw`о`],
  [String.raw`е`, String.raw`м`, String.raw`у`],
  [String.raw`ы`, String.raw`м`, String.raw`и`],
  [String.raw`и`, String.raw`й`],
  [String.raw`а`, String.raw`я`],
  [String.raw`е`, String.raw`е`],
  [String.raw`и`, String.raw`е`],
  [String.raw`у`, String.raw`ю`],
  [String.raw`е`, String.raw`й`],
  [String.raw`е`, String.raw`м`],
  [String.raw`и`, String.raw`м`],
  [String.raw`и`, String.raw`х`],
] as const;
const OHEREVA_CYRILLIC_TAIL_PARTS = [
  [String.raw`е`, String.raw`т`, String.raw`е`],
  [String.raw`е`, String.raw`ш`, String.raw`ь`],
  [String.raw`ю`, String.raw`т`],
  [String.raw`л`, String.raw`а`],
  [String.raw`л`, String.raw`о`],
  [String.raw`л`, String.raw`и`],
  [String.raw`ю`],
  [String.raw`е`, String.raw`т`],
  [String.raw`е`, String.raw`м`],
  [String.raw`л`],
] as const;
const OHERET_CYRILLIC_SPLIT_TAIL_PARTS = [
  [String.raw`е`, String.raw`т`, String.raw`е`],
  [String.raw`е`, String.raw`ш`, String.raw`ь`],
  [String.raw`ю`, String.raw`т`],
  [String.raw`й`, String.raw`т`, String.raw`е`],
  [String.raw`е`, String.raw`т`, String.raw`ь`],
  [String.raw`л`, String.raw`а`],
  [String.raw`л`, String.raw`о`],
  [String.raw`л`, String.raw`и`],
  [String.raw`ю`],
  [String.raw`е`, String.raw`т`],
  [String.raw`е`, String.raw`м`],
  [String.raw`й`],
  [String.raw`л`],
  ...prefixedPatternSequences(
    [String.raw`е`, String.raw`в`, String.raw`ш`],
    OHEREVSH_CYRILLIC_TAIL_PARTS,
  ),
  ...prefixedPatternSequences(
    [String.raw`е`, String.raw`н`, String.raw`н`],
    cyrillicAdjectiveTailParts,
  ),
  ...prefixedPatternSequences(
    [String.raw`е`, String.raw`в`, String.raw`а`],
    OHEREVA_CYRILLIC_TAIL_PARTS,
  ),
] as const;

const OHERET_TRANSLIT_TAIL_PARTS = [
  [String.raw`[eе]`, String.raw`[tт]`, String.raw`[eе]`],
  [String.raw`[yу]`, String.raw`[uу]`, String.raw`[tт]`],
  [
    String.raw`[vв]`,
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`i`,
    String.raw`[mм]`,
    String.raw`i`,
  ],
  [
    String.raw`[vв]`,
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`[aа]`,
    String.raw`[yу]`,
    String.raw`[aа]`,
  ],
  [
    String.raw`[vв]`,
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`[eе]`,
    String.raw`g`,
    String.raw`[oо]`,
  ],
  [
    String.raw`[vв]`,
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`i`,
    String.raw`[yу]`,
  ],
  [
    String.raw`[vв]`,
    String.raw`s`,
    String.raw`[hн]`,
    String.raw`i`,
    String.raw`[eе]`,
  ],
  [String.raw`l`, String.raw`[aа]`],
  [String.raw`l`, String.raw`[oо]`],
  [String.raw`l`, String.raw`i`],
  [String.raw`[yу]`, String.raw`[uу]`],
  [String.raw`[eе]`, String.raw`s`, String.raw`[hн]`],
  [String.raw`[eе]`, String.raw`[tт]`],
  [String.raw`[eе]`, String.raw`[mм]`],
  [String.raw`[yу]`, String.raw`[tт]`, String.raw`[eе]`],
  [String.raw`[tт]`],
  [String.raw`l`],
  [String.raw`[yу]`],
  [String.raw`[vв]`, String.raw`s`, String.raw`[hн]`],
] as const;

const OHERET_TRANSLIT_TAILS = joinedPatterns(OHERET_TRANSLIT_TAIL_PARTS);

const OHERENN_TRANSLIT_TAIL_PARTS = [
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

const OHEREVA_TRANSLIT_TAIL_PARTS = [
  [String.raw`[yу]`, String.raw`[uу]`, String.raw`[tт]`],
  [String.raw`[eе]`, String.raw`[tт]`, String.raw`[eе]`],
  [String.raw`[eе]`, String.raw`s`, String.raw`[hн]`],
  [String.raw`l`, String.raw`[aа]`],
  [String.raw`l`, String.raw`[oо]`],
  [String.raw`l`, String.raw`i`],
  [String.raw`[yу]`, String.raw`[uу]`],
  [String.raw`[eе]`, String.raw`[tт]`],
  [String.raw`[eе]`, String.raw`[mм]`],
  [String.raw`[tт]`],
  [String.raw`l`],
] as const;

const HERNYA_TRANSLIT_TAIL_PARTS = [
  [String.raw`[yу]`, String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[yу]`, String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[yу]`, String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[yу]`, String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[eе]`, String.raw`[yу]`],
  [String.raw`[yу]`, String.raw`[aа]`],
  [String.raw`[yу]`, String.raw`[uу]`],
  [String.raw`[eе]`],
  [String.raw`i`],
] as const;

const HEROV_TRANSLIT_TAIL_PARTS = [
  [String.raw`[oо]`, String.raw`g`, String.raw`[oо]`],
  [String.raw`[oо]`, String.raw`[mм]`, String.raw`[uу]`],
  [String.raw`[uу]`, String.raw`[yу]`, String.raw`[uу]`],
  [String.raw`[yу]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[yу]`, String.raw`[aа]`],
  [String.raw`[uу]`, String.raw`[yу]`],
  [String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[yу]`, String.raw`[mм]`],
  [String.raw`[yу]`, String.raw`[hн]`],
  [String.raw`[yу]`, String.raw`[yу]`],
  [String.raw`i`, String.raw`[yу]`],
  [String.raw`[oо]`, String.raw`[eе]`],
  [String.raw`[eе]`, String.raw`[yу]`],
  [String.raw`[yу]`, String.raw`[eе]`],
  [String.raw`[oо]`, String.raw`[mм]`],
  [String.raw`[yу]`],
  [String.raw`[oо]`],
] as const;

const HEROVIN_TRANSLIT_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[oо]`, String.raw`[mм]`],
  [String.raw`[aа]`],
  [String.raw`[yу]`],
  [String.raw`[eе]`],
  [String.raw`[uу]`],
] as const;

const HEREL_TRANSLIT_TAIL_PARTS = [
  [String.raw`[eе]`, String.raw`l`, String.raw`[aа]`],
  [String.raw`[eе]`, String.raw`l`, String.raw`[oо]`],
  [String.raw`[eе]`, String.raw`l`, String.raw`i`],
  [String.raw`[eе]`, String.raw`l`],
] as const;

const HERNYA_TRANSLIT_TAILS = joinedPatterns(HERNYA_TRANSLIT_TAIL_PARTS);
const HER_CASE_TRANSLIT_TAILS = joinedPatterns(HER_CASE_TRANSLIT_TAIL_PARTS);
const HEROV_TRANSLIT_TAILS = joinedPatterns(HEROV_TRANSLIT_TAIL_PARTS);
const HEROVIN_TRANSLIT_TAILS = joinedPatterns(HEROVIN_TRANSLIT_TAIL_PARTS);
const HEREL_TRANSLIT_TAILS = joinedPatterns(HEREL_TRANSLIT_TAIL_PARTS);
const OHERENN_TRANSLIT_TAILS = joinedPatterns(OHERENN_TRANSLIT_TAIL_PARTS);
const OHEREVA_TRANSLIT_TAILS = joinedPatterns(OHEREVA_TRANSLIT_TAIL_PARTS);
const OHERET_TRANSLIT_SOURCE = regexGroup([
  String.raw`[oо][hн][eе]r[eе]${regexGroup(OHERET_TRANSLIT_TAILS)}`,
  String.raw`[oо][hн][eе]r[eе]nn${regexGroup(OHERENN_TRANSLIT_TAILS)}`,
  String.raw`[oо][hн][eе]r[eе]v[aа]${regexGroup(OHEREVA_TRANSLIT_TAILS)}`,
]);
const HER_TRANSLIT_TAILS = [
  String.raw`n${regexGroup(HERNYA_TRANSLIT_TAILS)}`,
  String.raw`[oо]vin${optionalRegexGroup(HEROVIN_TRANSLIT_TAILS)}`,
  String.raw`[oо]v${optionalRegexGroup(HEROV_TRANSLIT_TAILS)}`,
  ...HEREL_TRANSLIT_TAILS,
] as const;

const HER_TRANSLIT_SPLIT_SEPARATOR = String.raw`[-._]+`;
const herTranslitSplit = (sources: readonly string[]): string =>
  separatedPattern(sources, HER_TRANSLIT_SPLIT_SEPARATOR);

const HERNYA_TRANSLIT_SPLIT_TAILS = separatedPatterns(
  HERNYA_TRANSLIT_TAIL_PARTS,
  HER_TRANSLIT_SPLIT_SEPARATOR,
);
const HER_CASE_TRANSLIT_SPLIT_TAILS = separatedPatterns(
  HER_CASE_TRANSLIT_TAIL_PARTS,
  HER_TRANSLIT_SPLIT_SEPARATOR,
);
const HEROV_TRANSLIT_SPLIT_TAILS = separatedPatterns(
  HEROV_TRANSLIT_TAIL_PARTS,
  HER_TRANSLIT_SPLIT_SEPARATOR,
);
const HEROVIN_TRANSLIT_SPLIT_TAILS = separatedPatterns(
  HEROVIN_TRANSLIT_TAIL_PARTS,
  HER_TRANSLIT_SPLIT_SEPARATOR,
);
const HEREL_TRANSLIT_SPLIT_TAILS = separatedPatterns(
  HEREL_TRANSLIT_TAIL_PARTS,
  HER_TRANSLIT_SPLIT_SEPARATOR,
);
const HERET_TRANSLIT_SPLIT_TAILS = separatedPatterns(
  [[String.raw`[eе]`, String.raw`[tт]`]],
  HER_TRANSLIT_SPLIT_SEPARATOR,
);
const OHERET_TRANSLIT_SPLIT_TAILS = separatedPatterns(
  OHERET_TRANSLIT_TAIL_PARTS.map((tail) => [String.raw`[eе]`, ...tail]),
  HER_TRANSLIT_SPLIT_SEPARATOR,
);
const OHERENN_TRANSLIT_SPLIT_TAILS = separatedPatterns(
  OHERENN_TRANSLIT_TAIL_PARTS,
  HER_TRANSLIT_SPLIT_SEPARATOR,
);
const OHEREVA_TRANSLIT_SPLIT_TAILS = separatedPatterns(
  OHEREVA_TRANSLIT_TAIL_PARTS,
  HER_TRANSLIT_SPLIT_SEPARATOR,
);

const HER_TRANSLIT_SPLIT_BASE = herTranslitSplit([
  String.raw`[hн]`,
  String.raw`[eе]`,
  String.raw`r`,
]);
const HERNYA_TRANSLIT_SPLIT_SOURCE =
  String.raw`${HER_TRANSLIT_SPLIT_BASE}${HER_TRANSLIT_SPLIT_SEPARATOR}` +
  String.raw`n${HER_TRANSLIT_SPLIT_SEPARATOR}${regexGroup(
    HERNYA_TRANSLIT_SPLIT_TAILS,
  )}`;
const HEROV_TRANSLIT_SPLIT_SOURCE =
  String.raw`${HER_TRANSLIT_SPLIT_BASE}${HER_TRANSLIT_SPLIT_SEPARATOR}` +
  String.raw`[oо]${HER_TRANSLIT_SPLIT_SEPARATOR}v` +
  String.raw`(?:${HER_TRANSLIT_SPLIT_SEPARATOR}${regexGroup(
    HEROV_TRANSLIT_SPLIT_TAILS,
  )})?`;
const HEROVIN_TRANSLIT_SPLIT_SOURCE =
  String.raw`${HER_TRANSLIT_SPLIT_BASE}${HER_TRANSLIT_SPLIT_SEPARATOR}` +
  String.raw`[oо]${HER_TRANSLIT_SPLIT_SEPARATOR}v${HER_TRANSLIT_SPLIT_SEPARATOR}` +
  String.raw`i${HER_TRANSLIT_SPLIT_SEPARATOR}n` +
  String.raw`(?:${HER_TRANSLIT_SPLIT_SEPARATOR}${regexGroup(
    HEROVIN_TRANSLIT_SPLIT_TAILS,
  )})?`;
const HEREL_TRANSLIT_SPLIT_SOURCE =
  String.raw`${HER_TRANSLIT_SPLIT_BASE}${HER_TRANSLIT_SPLIT_SEPARATOR}` +
  regexGroup(HEREL_TRANSLIT_SPLIT_TAILS);
const HERET_TRANSLIT_SPLIT_SOURCE =
  String.raw`${HER_TRANSLIT_SPLIT_BASE}${HER_TRANSLIT_SPLIT_SEPARATOR}` +
  regexGroup(HERET_TRANSLIT_SPLIT_TAILS);
const OHERET_TRANSLIT_SPLIT_SOURCE =
  String.raw`${herTranslitSplit([
    String.raw`[oо]`,
  ])}${HER_TRANSLIT_SPLIT_SEPARATOR}${HER_TRANSLIT_SPLIT_BASE}` +
  String.raw`${HER_TRANSLIT_SPLIT_SEPARATOR}${regexGroup(
    OHERET_TRANSLIT_SPLIT_TAILS,
  )}`;
const OHERENN_TRANSLIT_SPLIT_SOURCE = String.raw`${herTranslitSplit([
  String.raw`[oо]`,
  String.raw`[hн]`,
  String.raw`[eе]`,
  String.raw`r`,
  String.raw`[eе]`,
  String.raw`n`,
  String.raw`n`,
])}${HER_TRANSLIT_SPLIT_SEPARATOR}${regexGroup(OHERENN_TRANSLIT_SPLIT_TAILS)}`;
const OHEREVA_TRANSLIT_SPLIT_SOURCE = String.raw`${herTranslitSplit([
  String.raw`[oо]`,
  String.raw`[hн]`,
  String.raw`[eе]`,
  String.raw`r`,
  String.raw`[eе]`,
  String.raw`v`,
  String.raw`[aа]`,
])}${HER_TRANSLIT_SPLIT_SEPARATOR}${regexGroup(OHEREVA_TRANSLIT_SPLIT_TAILS)}`;
const HER_TRANSLIT_SPLIT_FAMILY_SOURCE = regexGroup([
  HERNYA_TRANSLIT_SPLIT_SOURCE,
  HEROVIN_TRANSLIT_SPLIT_SOURCE,
  HEROV_TRANSLIT_SPLIT_SOURCE,
  HEREL_TRANSLIT_SPLIT_SOURCE,
]);
const HER_TRANSLIT_SPLIT_PREFIX_PARTS = [
  [String.raw`n`, String.raw`[aа]`],
  [String.raw`[pр]`, String.raw`[oо]`],
  [String.raw`[oо]`],
] as const;
const HER_TRANSLIT_SPLIT_BARE_PREFIX_PARTS = [
  [String.raw`n`, String.raw`[aа]`],
  [String.raw`[pр]`, String.raw`[oо]`],
] as const;
const withHerTranslitSplitPrefix = (
  prefix: readonly string[],
  source: string,
): string =>
  String.raw`${herTranslitSplit(prefix)}${HER_TRANSLIT_SPLIT_SEPARATOR}${source}`;
const HER_TRANSLIT_SPLIT_BASE_WITH_CASE_TAILS =
  String.raw`${HER_TRANSLIT_SPLIT_BASE}` +
  String.raw`(?:${HER_TRANSLIT_SPLIT_SEPARATOR}${regexGroup(
    HER_CASE_TRANSLIT_SPLIT_TAILS,
  )})?`;
const HER_TRANSLIT_SPLIT_SOURCE = regexGroup([
  OHERENN_TRANSLIT_SPLIT_SOURCE,
  OHEREVA_TRANSLIT_SPLIT_SOURCE,
  OHERET_TRANSLIT_SPLIT_SOURCE,
  HER_TRANSLIT_SPLIT_FAMILY_SOURCE,
  ...HER_TRANSLIT_SPLIT_PREFIX_PARTS.map((prefix) =>
    withHerTranslitSplitPrefix(prefix, HER_TRANSLIT_SPLIT_FAMILY_SOURCE),
  ),
  HERET_TRANSLIT_SPLIT_SOURCE,
  ...HER_TRANSLIT_SPLIT_PREFIX_PARTS.map((prefix) =>
    withHerTranslitSplitPrefix(prefix, HERET_TRANSLIT_SPLIT_SOURCE),
  ),
  ...HER_TRANSLIT_SPLIT_BARE_PREFIX_PARTS.map((prefix) =>
    withHerTranslitSplitPrefix(prefix, HER_TRANSLIT_SPLIT_BASE_WITH_CASE_TAILS),
  ),
]);

const HERSON_CONTEXT_PREFIX = String.raw`(?:на|по|о)(?:\s+|\s*[._/@:,\-–—]+\s*)`;
const HERSON_CONTEXT_TAILS = [
  String.raw`сон`,
  String.raw`ес`,
  String.raw`увим`,
  String.raw`ц`,
] as const;
const HERSON_CONTEXT_SOURCE = String.raw`хер${regexGroup(HERSON_CONTEXT_TAILS)}${cyrillicSuffix}`;
const HERSON_COMPACT_CONTEXT = String.raw`${HERSON_CONTEXT_PREFIX}${HERSON_CONTEXT_SOURCE}(?:\s+области)?`;
const HER_PREFIXED_SOURCE = String.raw`(?:на|по|о)хер${cyrillicSuffix}`;
const OHERET_CYRILLIC_SPLIT_BASE = separatedPattern(
  [String.raw`о`, String.raw`х`, String.raw`е`, String.raw`р`],
  HER_SPLIT_SEPARATOR,
);
const OHERET_CYRILLIC_SPLIT_SOURCE =
  String.raw`${OHERET_CYRILLIC_SPLIT_BASE}${HER_SPLIT_SEPARATOR}` +
  regexGroup(
    separatedPatterns(OHERET_CYRILLIC_SPLIT_TAIL_PARTS, HER_SPLIT_SEPARATOR),
  );
const HER_SPLIT_BASE = String.raw`х${HER_SPLIT_SEPARATOR}е${HER_SPLIT_SEPARATOR}р`;
const HER_SPLIT_TAIL_SOURCE = String.raw`(?:${HER_SPLIT_SEPARATOR}${regexGroup(HER_SPLIT_TAILS)})?`;
const HER_SPLIT_SOURCE = String.raw`${HER_SPLIT_BASE}${HER_SPLIT_TAIL_SOURCE}`;
const HERSON_CONTEXT_SPLIT_PREFIX = regexGroup([
  String.raw`на`,
  String.raw`по`,
  separatedPattern([String.raw`н`, String.raw`а`], HER_SPLIT_SEPARATOR),
  separatedPattern([String.raw`п`, String.raw`о`], HER_SPLIT_SEPARATOR),
  String.raw`о`,
]);
const HERSON_CONTEXT_SPLIT_TAILS = separatedPatterns(
  [
    [String.raw`с`, String.raw`о`, String.raw`н`],
    [String.raw`е`, String.raw`с`],
    [String.raw`у`, String.raw`в`, String.raw`и`, String.raw`м`],
    [String.raw`ц`],
  ],
  HER_SPLIT_SEPARATOR,
);
const HERSON_CONTEXT_SPLIT_SUFFIX = String.raw`(?:${HER_SPLIT_SEPARATOR}[а-яё])+`;
const HERSON_CONTEXT_SPLIT_SOURCE =
  String.raw`${HERSON_CONTEXT_SPLIT_PREFIX}${HER_SPLIT_SEPARATOR}` +
  String.raw`${HER_SPLIT_BASE}${HER_SPLIT_SEPARATOR}` +
  String.raw`${regexGroup(HERSON_CONTEXT_SPLIT_TAILS)}` +
  String.raw`${HERSON_CONTEXT_SPLIT_SUFFIX}?`;
const HERSON_CONTEXT_CHUNK_TAIL_SOURCE = String.raw`${regexGroup(HERSON_CONTEXT_TAILS)}${cyrillicSuffix}`;
const HERSON_CONTEXT_CHUNK_SOURCE =
  String.raw`${HERSON_CONTEXT_SPLIT_PREFIX}${HER_SPLIT_SEPARATOR}` +
  String.raw`хер${HER_SPLIT_SEPARATOR}${HERSON_CONTEXT_CHUNK_TAIL_SOURCE}`;
const HERSON_CONTEXT = regexGroup([
  HERSON_COMPACT_CONTEXT,
  HERSON_CONTEXT_CHUNK_SOURCE,
  HERSON_CONTEXT_SPLIT_SOURCE,
]);

export default russianFamilyDictionary([
  russianRule({
    id: "ru.vulgar.her.base",
    category: "VULGAR",
    severity: "medium",
    source: token(String.raw`хер(?:а|у|ом|е|ы|ам|ами|ах)?`),
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.her.base.split.loose",
    category: "VULGAR",
    severity: "medium",
    source: String.raw`(?<!\p{L})${HER_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.vulgar.her.family",
    category: "VULGAR",
    severity: "medium",
    source: String.raw`хер${regexGroup([
      String.raw`н${regexGroup(HERNYA_TAILS)}`,
      String.raw`овин${cyrillicSuffix}`,
      String.raw`ов${optionalRegexGroup(HEROV_CYRILLIC_TAILS)}`,
    ])}`,
  }),
  russianRule({
    id: "ru.vulgar.her.prefixed",
    category: "VULGAR",
    severity: "medium",
    source: String.raw`(?!${HERSON_CONTEXT})${HER_PREFIXED_SOURCE}`,
  }),
  russianRule({
    id: "ru.vulgar.oheret.family",
    category: "VULGAR",
    severity: "medium",
    source: String.raw`охер${regexGroup([
      String.raw`е${regexGroup(OHERET_CYRILLIC_TAILS)}`,
      String.raw`евш${cyrillicSuffix}`,
      String.raw`енн${cyrillicSuffix}`,
      String.raw`ева${cyrillicSuffix}`,
    ])}`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.oheret.split.loose",
    category: "VULGAR",
    severity: "medium",
    source: String.raw`(?<!\p{L})${OHERET_CYRILLIC_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.vulgar.oheret.translit.bare",
    category: "VULGAR",
    severity: "medium",
    source: String.raw`(?<!\p{L})${OHERET_TRANSLIT_SOURCE}(?!\p{L})`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.her.prefixed.translit.bare",
    category: "VULGAR",
    severity: "medium",
    source: String.raw`(?<!\p{L})(?:n[aа]|[pр][oо])[hн][eе]r${optionalRegexGroup(
      HER_CASE_TRANSLIT_TAILS,
    )}(?!\p{L})`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.heret.translit.bare",
    category: "VULGAR",
    severity: "medium",
    source: String.raw`(?<!\p{L})(?:n[aа]|[pр][oо]|[oо])?[hн][eе]r[eе][tт](?!\p{L})`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.her.translit",
    category: "VULGAR",
    severity: "medium",
    source: String.raw`(?<!\p{L})(?:n[aа]|[pр][oо]|[oо])?[hн][eе]r${regexGroup(HER_TRANSLIT_TAILS)}(?!\p{L})`,
    match: "strict",
  }),
  russianRule({
    id: "ru.vulgar.her.translit.split.loose",
    category: "VULGAR",
    severity: "medium",
    source: String.raw`(?<!\p{L})${HER_TRANSLIT_SPLIT_SOURCE}(?!\p{L})`,
    match: "loose",
    loose: {},
  }),
]);
