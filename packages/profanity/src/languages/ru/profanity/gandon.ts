import {
  cyrillicSuffix,
  neutralContextGuard,
  neutralContextGuardedSource,
  patternTailViews,
  regexAlternatives,
  regexGroup,
  russianFamilyDictionary,
  russianRule,
  separatedPattern,
} from "./authoring.js";

const GANDON_NEUTRAL_TAILS = [
  String.raw`f[aа][mм]il[yу]`,
  String.raw`surn[aа][mм][eе]`,
  String.raw`[eе]s[tт][aа][tт][eе]`,
  String.raw`vill[aа]g[eе]`,
  String.raw`r[oо][aа]d`,
  String.raw`s[tт]r[eе][eе][tт]`,
  String.raw`[pр]l[aа][cс][eе]`,
  String.raw`[hн][oо]us[eе]`,
  String.raw`[hн][aа]ll`,
] as const;

const GANDON_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[mм]`],
  [String.raw`[oо]`, String.raw`v`],
  [String.raw`[aа]`],
  [String.raw`[uу]`],
  [String.raw`[yу]`],
  [String.raw`[eе]`],
] as const;

const GANDOSHA_TAIL_PARTS = [
  [String.raw`[aа]`, String.raw`[mм]`, String.raw`i`],
  [String.raw`[aа]`, String.raw`[mм]`],
  [String.raw`[aа]`, String.raw`[hн]`],
  [String.raw`[oо]`, String.raw`[yу]`],
  [String.raw`[aа]`],
  [String.raw`i`],
  [String.raw`[eе]`],
  [String.raw`[uу]`],
] as const;

const GANDON_SPLIT_SEPARATOR = String.raw`[-._]+`;
const GANDON_TAILS = patternTailViews(
  GANDON_TAIL_PARTS,
  GANDON_SPLIT_SEPARATOR,
);
const GANDOSHA_TAILS = patternTailViews(
  GANDOSHA_TAIL_PARTS,
  GANDON_SPLIT_SEPARATOR,
);
const GANDON_TRANSLIT_BASE = String.raw`g(?=[aаoо])[aаoо](?=n)n(?=d)d(?=[oо])[oо]`;
const GANDON_NEUTRAL_TAIL = regexAlternatives(GANDON_NEUTRAL_TAILS);
const GANDON_TRANSLIT_SOURCE = regexGroup([
  String.raw`${GANDON_TRANSLIT_BASE}(?=n)n${regexGroup(GANDON_TAILS.joined)}?`,
  String.raw`${GANDON_TRANSLIT_BASE}(?=s)s(?=[hн])[hн]${regexGroup(
    GANDOSHA_TAILS.joined,
  )}`,
]);

const GANDON_SPLIT_BASE = separatedPattern(
  [
    String.raw`g`,
    String.raw`[aаoо]`,
    String.raw`n`,
    String.raw`d`,
    String.raw`[oо]`,
  ],
  GANDON_SPLIT_SEPARATOR,
);
const GANDON_SPLIT_NEUTRAL_SOURCE = String.raw`${GANDON_SPLIT_BASE}${GANDON_SPLIT_SEPARATOR}n`;
const GANDON_SPLIT_SOURCE = String.raw`${GANDON_SPLIT_BASE}${GANDON_SPLIT_SEPARATOR}${regexGroup(
  [
    String.raw`n(?:${GANDON_SPLIT_SEPARATOR}${regexGroup(GANDON_TAILS.separated)})?`,
    String.raw`s${GANDON_SPLIT_SEPARATOR}[hн]${GANDON_SPLIT_SEPARATOR}${regexGroup(
      GANDOSHA_TAILS.separated,
    )}`,
  ],
)}`;
const GANDON_SPLIT_GUARDED_SOURCE = neutralContextGuardedSource(
  GANDON_SPLIT_SOURCE,
  GANDON_SPLIT_NEUTRAL_SOURCE,
  GANDON_NEUTRAL_TAIL,
);
const GANDON_LOOSE_SEPARATOR = String.raw`[^\p{L}\p{N}]*`;
const GANDON_TRANSLIT_BARE_SOURCE = separatedPattern(
  [String.raw`g`, String.raw`[aаoо]`, "n", "d", String.raw`[oо]`, "n"],
  GANDON_LOOSE_SEPARATOR,
);
const GANDON_TRANSLIT_PERSON_GUARD = String.raw`(?!(?<=(?<!\p{L})[pр]i[eе]rr[eе]\s+)${GANDON_TRANSLIT_BARE_SOURCE}(?!\p{L}))`;
const GANDON_CYRILLIC_BARE_SOURCE = separatedPattern(
  ["г", String.raw`[ао]`, "н", "д", "о", "н"],
  GANDON_LOOSE_SEPARATOR,
);
const GANDON_CYRILLIC_PERSON_GUARD = String.raw`(?!(?<=(?<!\p{L})пьер\s+)${GANDON_CYRILLIC_BARE_SOURCE}(?!\p{L}))`;

export default russianFamilyDictionary([
  russianRule({
    id: "ru.insult.gandon.family",
    category: "STRONG_INSULT",
    severity: "medium",
    source: String.raw`${GANDON_CYRILLIC_PERSON_GUARD}г[ао]ндо(?:н|ш(?:а|и|е|у|ой))${cyrillicSuffix}`,
    match: "loose",
    loose: { stretch: true },
  }),
  russianRule({
    id: "ru.insult.gandon.translit",
    category: "STRONG_INSULT",
    severity: "medium",
    source: String.raw`${GANDON_TRANSLIT_PERSON_GUARD}${neutralContextGuard(
      GANDON_TRANSLIT_SOURCE,
      GANDON_NEUTRAL_TAIL,
    )}`,
    match: "loose",
    loose: {},
  }),
  russianRule({
    id: "ru.insult.gandon.split.loose",
    category: "STRONG_INSULT",
    severity: "medium",
    source: String.raw`${GANDON_TRANSLIT_PERSON_GUARD}${GANDON_SPLIT_GUARDED_SOURCE}`,
    match: "loose",
    loose: {},
  }),
]);
