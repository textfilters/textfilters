import type { InternalProfanityRuleDefinition } from "../matchers/internal-rules.js";
import type { ProfanityCategory, ProfanitySeverity } from "../types.js";

export interface ProfanityLanguageDictionary {
  readonly language: string;
  readonly normalization?: ProfanityNormalizationStrategy;
  readonly rules: readonly ProfanityLanguageRuleDefinition[];
}

export type ProfanityNormalizationStrategy =
  | "cyrillic-homoglyphs"
  | "latin-preserving";

export interface ProfanityDictionaryCompileOptions {
  readonly normalization?: ProfanityNormalizationStrategy;
}

export interface ProfanityLanguageRuleDefinition {
  readonly id: string;
  readonly category: ProfanityCategory;
  readonly severity: ProfanitySeverity;
  readonly source: ProfanityLanguageRuleSource;
  readonly match: ProfanityLanguageRuleMatch;
}

interface SourceExemptedProfanityLanguageRuleDefinition extends ProfanityLanguageRuleDefinition {
  readonly originalSourceExemptions?: readonly string[];
}

export type ProfanityLanguageRuleSource = string | readonly string[];

export type ProfanityLanguageRuleMatch =
  | {
      readonly strict: ProfanityLanguageStrictMatchOptions;
      readonly loose?: ProfanityLanguageLooseMatchOptions;
    }
  | {
      readonly strict?: ProfanityLanguageStrictMatchOptions;
      readonly loose: ProfanityLanguageLooseMatchOptions;
    };

export type ProfanityLanguageStrictMatchOptions = Record<string, never>;

export type ProfanityLanguageLooseMatchOptions = {
  readonly stretch?: true;
} & (
  | {
      readonly hyphenTail: true;
      readonly hyphenTailMin?: number;
    }
  | {
      readonly hyphenTail?: undefined;
      readonly hyphenTailMin?: undefined;
    }
);

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

    const originalSourceExemptions = (
      rule as SourceExemptedProfanityLanguageRuleDefinition
    ).originalSourceExemptions;
    const definition: InternalProfanityRuleDefinition = {
      id: rule.id,
      source: languageRuleSourcePattern(rule.source),
      category: rule.category,
      severity: rule.severity,
      ...(originalSourceExemptions === undefined
        ? {}
        : { originalSourceExemptions }),
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
): { readonly loose?: ProfanityLanguageLooseMatchOptions } => {
  if (match.hyphenTail === true) {
    return {
      loose: {
        ...(match.stretch === true ? { stretch: true } : {}),
        hyphenTail: true,
        ...(match.hyphenTailMin !== undefined
          ? { hyphenTailMin: match.hyphenTailMin }
          : {}),
      },
    };
  }

  return match.stretch === true ? { loose: { stretch: true } } : {};
};
