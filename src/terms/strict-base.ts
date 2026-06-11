import type { InternalProfanityRuleDefinition } from "../matchers/internal-rules.js";
import { RUSSIAN_PROFANITY_STRICT_RULES } from "../languages/ru/index.js";

export const STRICT_BASE: readonly InternalProfanityRuleDefinition[] =
  RUSSIAN_PROFANITY_STRICT_RULES;
