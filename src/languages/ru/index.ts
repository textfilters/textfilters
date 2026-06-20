import blyaProfanity from "./profanity/blya.json" with { type: "json" };
import chmoProfanity from "./profanity/chmo.js";
import ebProfanity from "./profanity/eb.json" with { type: "json" };
import gandonProfanity from "./profanity/gandon.js";
import herProfanity from "./profanity/her.js";
import huyProfanity from "./profanity/huy.json" with { type: "json" };
import mudProfanity from "./profanity/mud.json" with { type: "json" };
import pidorProfanity from "./profanity/pidor.json" with { type: "json" };
import pizdaProfanity from "./profanity/pizda.json" with { type: "json" };
import russianProfanityRuleOrder from "./profanity/order.json" with { type: "json" };
import reviewedGapProfanity from "./profanity/reviewed-gaps.js";
import shitProfanity from "./profanity/shit.js";
import shlyuhaProfanity from "./profanity/shlyuha.js";
import sukaProfanity from "./profanity/suka.js";
import zalupaProfanity from "./profanity/zalupa.js";
import {
  dictionaryRulesForMode,
  type ProfanityLanguageDictionary,
  type ProfanityLanguageRuleDefinition,
} from "../profanity.js";

export const RUSSIAN_PROFANITY_FAMILY_DICTIONARIES = [
  blyaProfanity as ProfanityLanguageDictionary,
  chmoProfanity,
  ebProfanity as ProfanityLanguageDictionary,
  gandonProfanity,
  herProfanity,
  huyProfanity as ProfanityLanguageDictionary,
  mudProfanity as ProfanityLanguageDictionary,
  pidorProfanity as ProfanityLanguageDictionary,
  pizdaProfanity as ProfanityLanguageDictionary,
  reviewedGapProfanity,
  shitProfanity,
  shlyuhaProfanity,
  sukaProfanity,
  zalupaProfanity,
] as const;

const RUSSIAN_PROFANITY_RULES_BY_ID = new Map<
  string,
  ProfanityLanguageRuleDefinition
>();

for (const dictionary of RUSSIAN_PROFANITY_FAMILY_DICTIONARIES) {
  for (const rule of dictionary.rules) {
    if (rule.id === undefined) {
      throw new Error("Russian profanity family rule is missing an id.");
    }

    if (RUSSIAN_PROFANITY_RULES_BY_ID.has(rule.id)) {
      throw new Error(`Duplicate Russian profanity rule id: ${rule.id}`);
    }

    RUSSIAN_PROFANITY_RULES_BY_ID.set(rule.id, rule);
  }
}

const RUSSIAN_PROFANITY_RULE_ORDER =
  russianProfanityRuleOrder as readonly string[];
const RUSSIAN_PROFANITY_RULE_ORDER_IDS = new Set<string>();

const RUSSIAN_PROFANITY_RULES = RUSSIAN_PROFANITY_RULE_ORDER.map((ruleId) => {
  if (RUSSIAN_PROFANITY_RULE_ORDER_IDS.has(ruleId)) {
    throw new Error(`Duplicate Russian profanity rule order id: ${ruleId}`);
  }

  RUSSIAN_PROFANITY_RULE_ORDER_IDS.add(ruleId);

  const rule = RUSSIAN_PROFANITY_RULES_BY_ID.get(ruleId);

  if (rule === undefined) {
    throw new Error(`Missing Russian profanity rule id: ${ruleId}`);
  }

  return rule;
});

if (RUSSIAN_PROFANITY_RULES.length !== RUSSIAN_PROFANITY_RULES_BY_ID.size) {
  throw new Error("Russian profanity rule order does not include every rule.");
}

export const RUSSIAN_PROFANITY_DICTIONARY = {
  language: "ru",
  rules: RUSSIAN_PROFANITY_RULES,
} as const satisfies ProfanityLanguageDictionary;

export const russianProfanityDictionary = RUSSIAN_PROFANITY_DICTIONARY;

export const RUSSIAN_PROFANITY_STRICT_RULES = dictionaryRulesForMode(
  RUSSIAN_PROFANITY_DICTIONARY,
  "strict",
);

export const RUSSIAN_PROFANITY_LOOSE_RULES = dictionaryRulesForMode(
  RUSSIAN_PROFANITY_DICTIONARY,
  "loose",
);
