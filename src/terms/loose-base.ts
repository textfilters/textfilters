import looseBase from "./data/loose-base.json" with { type: "json" };
import type { InternalProfanityRuleDefinition } from "../matchers/internal-rules.js";

export const LOOSE_BASE: readonly InternalProfanityRuleDefinition[] = looseBase;
