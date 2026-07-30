import type { InternalProfanityRuleDefinition } from "../matchers/internal-rules.js";
import { RUSSIAN_PROFANITY_LOOSE_RULES } from "../languages/ru/index.js";

export const LOOSE_BASE: readonly InternalProfanityRuleDefinition[] =
  RUSSIAN_PROFANITY_LOOSE_RULES;
