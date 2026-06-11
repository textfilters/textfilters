import strictBase from "./data/strict-base.json" with { type: "json" };
import type { InternalProfanityRuleDefinition } from "../matchers/internal-rules.js";

export const STRICT_BASE: readonly InternalProfanityRuleDefinition[] =
  strictBase;
