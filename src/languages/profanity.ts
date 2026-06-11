import type {
  InternalProfanityRuleDefinition,
  InternalProfanityRuleLooseOptions,
} from "../matchers/internal-rules.js";
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

export interface ProfanityLanguageStrictMatchOptions {
  readonly id?: string;
  readonly order?: number;
}

export interface ProfanityLanguageLooseMatchOptions extends InternalProfanityRuleLooseOptions {
  readonly id?: string;
  readonly order?: number;
}

export type ProfanityLanguageMatchMode = "strict" | "loose";

export const dictionaryRulesForMode = (
  dictionary: ProfanityLanguageDictionary,
  mode: ProfanityLanguageMatchMode,
): InternalProfanityRuleDefinition[] =>
  dictionary.rules
    .flatMap((rule, index) => {
      const match = rule.match[mode];

      if (match === undefined) {
        return [];
      }

      const definition: InternalProfanityRuleDefinition = {
        id: match.id ?? rule.id,
        source: rule.source,
        ...(rule.category === undefined ? {} : { category: rule.category }),
        ...(rule.severity === undefined ? {} : { severity: rule.severity }),
        ...(mode === "loose"
          ? looseOptions(match as ProfanityLanguageLooseMatchOptions)
          : {}),
      };

      return [{ definition, order: match.order ?? index }];
    })
    .sort((left, right) => left.order - right.order)
    .map(({ definition }) => definition);

const looseOptions = (
  match: ProfanityLanguageLooseMatchOptions,
): { readonly loose?: InternalProfanityRuleLooseOptions } =>
  match.stretch === true ? { loose: { stretch: true } } : {};
