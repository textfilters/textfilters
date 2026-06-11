import type { InternalProfanityRuleDefinition } from "../matchers/internal-rules.js";
import type { ProfanityTaxonomyMetadata } from "../types.js";

export interface ProfanityLanguageDictionary {
  readonly language: string;
  readonly rules: readonly ProfanityLanguageRuleDefinition[];
}

export interface ProfanityLanguageRuleDefinition extends ProfanityTaxonomyMetadata {
  readonly id?: string;
  readonly source: string;
  readonly match: ProfanityLanguageRuleMatch;
}

export interface ProfanityLanguageRuleMatch {
  readonly strict?: ProfanityLanguageStrictMatchOptions;
  readonly loose?: ProfanityLanguageLooseMatchOptions;
}

export type ProfanityLanguageStrictMatchOptions = Record<string, never>;

export interface ProfanityLanguageLooseMatchOptions {
  readonly stretch?: boolean;
}

export type ProfanityLanguageMatchMode = "strict" | "loose";

export const dictionaryRulesForMode = (
  dictionary: ProfanityLanguageDictionary,
  mode: ProfanityLanguageMatchMode,
): InternalProfanityRuleDefinition[] =>
  dictionary.rules.flatMap((rule) => {
    const match = rule.match[mode];

    if (match === undefined) {
      return [];
    }

    const definition: InternalProfanityRuleDefinition = {
      ...(rule.id === undefined ? {} : { id: rule.id }),
      source: rule.source,
      ...(rule.category === undefined ? {} : { category: rule.category }),
      ...(rule.severity === undefined ? {} : { severity: rule.severity }),
      ...(mode === "loose"
        ? looseOptions(match as ProfanityLanguageLooseMatchOptions)
        : {}),
    };

    return [definition];
  });

const looseOptions = (
  match: ProfanityLanguageLooseMatchOptions,
): { readonly loose?: ProfanityLanguageLooseMatchOptions } =>
  match.stretch === true ? { loose: { stretch: true } } : {};
