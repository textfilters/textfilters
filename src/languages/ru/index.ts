import russianProfanity from "./profanity.json" with { type: "json" };
import { dictionaryRulesForMode } from "../profanity.js";
import type { ProfanityLanguageDictionary } from "../profanity.js";

export const RUSSIAN_PROFANITY_DICTIONARY =
  russianProfanity as ProfanityLanguageDictionary;

export const RUSSIAN_PROFANITY_STRICT_RULES = dictionaryRulesForMode(
  RUSSIAN_PROFANITY_DICTIONARY,
  "strict",
);

export const RUSSIAN_PROFANITY_LOOSE_RULES = dictionaryRulesForMode(
  RUSSIAN_PROFANITY_DICTIONARY,
  "loose",
);
