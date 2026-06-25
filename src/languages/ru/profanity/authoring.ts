import type {
  ProfanityLanguageDictionary,
  ProfanityLanguageLooseMatchOptions,
  ProfanityLanguageRuleDefinition,
  ProfanityLanguageRuleSource,
} from "../../profanity.js";
import type { ProfanityCategory, ProfanitySeverity } from "../../../types.js";

type RussianRuleMatch = "strict" | "loose" | "strict-loose";

interface RussianRuleOptions {
  readonly id: string;
  readonly category: ProfanityCategory;
  readonly severity: ProfanitySeverity;
  readonly source: ProfanityLanguageRuleSource;
  readonly match?: RussianRuleMatch;
  readonly loose?: ProfanityLanguageLooseMatchOptions;
}

const DEFAULT_LOOSE_MATCH = {
  stretch: true,
} as const satisfies ProfanityLanguageLooseMatchOptions;

export const cyrillicSuffix = String.raw`(?:[а-яё]+)?`;

export const russianFamilyDictionary = (
  rules: readonly ProfanityLanguageRuleDefinition[],
): ProfanityLanguageDictionary => ({
  language: "ru",
  rules,
});

export const russianProfileDictionary = (
  familyDictionaries: readonly ProfanityLanguageDictionary[],
  ruleOrder: readonly string[],
): ProfanityLanguageDictionary => {
  const rulesById = new Map<string, ProfanityLanguageRuleDefinition>();

  for (const dictionary of familyDictionaries) {
    for (const rule of dictionary.rules) {
      if (rule.id === undefined) {
        throw new Error("Russian profanity family rule is missing an id.");
      }

      if (rulesById.has(rule.id)) {
        throw new Error(`Duplicate Russian profanity rule id: ${rule.id}`);
      }

      rulesById.set(rule.id, rule);
    }
  }

  const orderedIds = new Set<string>();
  const rules = ruleOrder.map((ruleId) => {
    if (orderedIds.has(ruleId)) {
      throw new Error(`Duplicate Russian profanity rule order id: ${ruleId}`);
    }

    orderedIds.add(ruleId);

    const rule = rulesById.get(ruleId);
    if (rule === undefined) {
      throw new Error(`Missing Russian profanity rule id: ${ruleId}`);
    }

    return rule;
  });

  if (rules.length !== rulesById.size) {
    throw new Error(
      "Russian profanity rule order does not include every rule.",
    );
  }

  return {
    language: "ru",
    rules,
  };
};

export const russianRule = ({
  id,
  category,
  severity,
  source,
  match = "strict-loose",
  loose = DEFAULT_LOOSE_MATCH,
}: RussianRuleOptions): ProfanityLanguageRuleDefinition => ({
  id,
  category,
  severity,
  source,
  match: {
    ...(match === "strict" || match === "strict-loose" ? { strict: {} } : {}),
    ...(match === "loose" || match === "strict-loose" ? { loose } : {}),
  },
});

export const token = (source: string): string =>
  String.raw`(?<!\p{L})${source}(?!\p{L})`;

export const regexAlternatives = (sources: readonly string[]): string =>
  sources.join("|");

export const regexGroup = (sources: readonly string[]): string =>
  String.raw`(?:${regexAlternatives(sources)})`;

export const optionalRegexGroup = (sources: readonly string[]): string =>
  String.raw`${regexGroup(sources)}?`;

export const separatedPattern = (
  sources: readonly string[],
  separator: string,
): string => sources.join(separator);

export const splitPattern =
  (separator: string) =>
  (sources: readonly string[]): string =>
    separatedPattern(sources, separator);

export const splitPatternLiteral =
  (separator: string) =>
  (source: string): string =>
    splitPattern(separator)(Array.from(source));

export const splitPatternWithTails =
  (separator: string) =>
  (baseParts: readonly string[], tails: readonly string[]): string =>
    String.raw`${splitPattern(separator)(baseParts)}${separator}${regexGroup(
      tails,
    )}`;

export const splitPatternWithOptionalTails =
  (separator: string) =>
  (baseParts: readonly string[], tails: readonly string[]): string =>
    String.raw`${splitPattern(separator)(baseParts)}(?:${separator}${regexGroup(
      tails,
    )})?`;

type PatternSequence = readonly string[];

interface PatternTailViews {
  readonly joined: string[];
  readonly separated: string[];
}

export const cyrillicAdjectiveTailParts = [
  [String.raw`о`, String.raw`г`, String.raw`о`],
  [String.raw`о`, String.raw`м`, String.raw`у`],
  [String.raw`ы`, String.raw`м`, String.raw`и`],
  [String.raw`ы`, String.raw`й`],
  [String.raw`а`, String.raw`я`],
  [String.raw`о`, String.raw`е`],
  [String.raw`ы`, String.raw`е`],
  [String.raw`у`, String.raw`ю`],
  [String.raw`о`, String.raw`й`],
  [String.raw`о`, String.raw`м`],
  [String.raw`ы`, String.raw`м`],
  [String.raw`ы`, String.raw`х`],
] as const;

export const transliteratedAdjectiveTailParts = [
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

export const prefixedPatternSequences = (
  prefix: readonly string[],
  sequences: readonly PatternSequence[],
): string[][] => sequences.map((sequence) => [...prefix, ...sequence]);

const longestSequencesFirst = (
  sequences: readonly PatternSequence[],
): PatternSequence[] =>
  [...sequences].sort((left, right) => right.length - left.length);

export const patternTailViews = (
  sequences: readonly PatternSequence[],
  separator: string,
): PatternTailViews => {
  const orderedSequences = longestSequencesFirst(sequences);

  return {
    joined: orderedSequences.map((source) => source.join("")),
    separated: orderedSequences.map((source) =>
      separatedPattern(source, separator),
    ),
  };
};

export const joinedPatterns = (
  sequences: readonly PatternSequence[],
): string[] => patternTailViews(sequences, "").joined;

export const separatedPatterns = (
  sequences: readonly PatternSequence[],
  separator: string,
): string[] => patternTailViews(sequences, separator).separated;

const NEUTRAL_CONTEXT_SEPARATOR = String.raw`(?:\s+|\s*[./@:,\-–—]+\s*)`;
const NEUTRAL_CONTEXT_BOUNDARY = String.raw`(?![\p{L}\p{N}_-])`;

const neutralContextLookahead = (source: string, neutralTail: string): string =>
  String.raw`${source}(?:['’]s)?${NEUTRAL_CONTEXT_SEPARATOR}` +
  String.raw`(?:${neutralTail})${NEUTRAL_CONTEXT_BOUNDARY}`;

export const neutralContextGuardedSource = (
  source: string,
  neutralSource: string,
  neutralTail: string,
): string =>
  String.raw`(?<!\p{L})(?!${neutralContextLookahead(neutralSource, neutralTail)})${source}(?!\p{L})`;

export const neutralContextGuard = (
  source: string,
  neutralTail: string,
): string => neutralContextGuardedSource(source, source, neutralTail);
