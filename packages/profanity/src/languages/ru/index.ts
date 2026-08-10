import blyaProfanity from "./profanity/blya.json" with { type: "json" };
import chmoProfanity from "./profanity/chmo.js";
import ebProfanity from "./profanity/eb.json" with { type: "json" };
import expandedFamilyProfanity from "./profanity/expanded-families.js";
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
} from "../profanity.js";
import { russianProfileDictionary } from "./profanity/authoring.js";

export const RUSSIAN_PROFANITY_FAMILY_DICTIONARIES = [
  blyaProfanity as ProfanityLanguageDictionary,
  chmoProfanity,
  ebProfanity as ProfanityLanguageDictionary,
  expandedFamilyProfanity,
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

export const RUSSIAN_PROFANITY_DICTIONARY: ProfanityLanguageDictionary =
  russianProfileDictionary(
    RUSSIAN_PROFANITY_FAMILY_DICTIONARIES,
    russianProfanityRuleOrder as readonly string[],
  );

export const russianProfanityDictionary = RUSSIAN_PROFANITY_DICTIONARY;

export const RUSSIAN_PROFANITY_STRICT_RULES = dictionaryRulesForMode(
  RUSSIAN_PROFANITY_DICTIONARY,
  "strict",
);

export const RUSSIAN_PROFANITY_LOOSE_RULES = dictionaryRulesForMode(
  RUSSIAN_PROFANITY_DICTIONARY,
  "loose",
);
