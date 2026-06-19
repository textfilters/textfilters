import type { InternalProfanityRuleDefinition } from "../matchers/internal-rules.js";
import type { ProfanityTaxonomyMetadata } from "../types.js";

export interface ProfanityLanguageDictionary {
  readonly language: string;
  readonly rules: readonly ProfanityLanguageRuleDefinition[];
}

export interface ProfanityLanguageRuleDefinition extends ProfanityTaxonomyMetadata {
  readonly id?: string;
  readonly source: ProfanityLanguageRuleSource;
  readonly match: ProfanityLanguageRuleMatch;
}

export type ProfanityLanguageRuleSource = string | readonly string[];

export interface ProfanityLanguageRuleMatch {
  readonly strict?: ProfanityLanguageStrictMatchOptions;
  readonly loose?: ProfanityLanguageLooseMatchOptions;
}

export type ProfanityLanguageStrictMatchOptions = Record<string, never>;

export interface ProfanityLanguageLooseMatchOptions {
  readonly stretch?: boolean;
  readonly hyphenTail?: boolean;
  readonly hyphenTailMin?: number;
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
      source: languageRuleSourcePattern(rule.source),
      ...(rule.category === undefined ? {} : { category: rule.category }),
      ...(rule.severity === undefined ? {} : { severity: rule.severity }),
      ...(mode === "loose"
        ? looseOptions(match as ProfanityLanguageLooseMatchOptions)
        : {}),
    };

    return [definition];
  });

export const languageRuleSourcePattern = (
  source: ProfanityLanguageRuleSource,
): string => (typeof source === "string" ? source : source.join(""));

const looseOptions = (
  match: ProfanityLanguageLooseMatchOptions,
): { readonly loose?: ProfanityLanguageLooseMatchOptions } =>
  match.stretch === true || match.hyphenTail === true
    ? {
        loose: {
          ...(match.stretch === true ? { stretch: true } : {}),
          ...(match.hyphenTail === true ? { hyphenTail: true } : {}),
          ...(match.hyphenTail === true && match.hyphenTailMin !== undefined
            ? { hyphenTailMin: match.hyphenTailMin }
            : {}),
        },
      }
    : {};
