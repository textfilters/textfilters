import { type ProfanityNormalizationStrategy } from "./profanity.js";
import {
  issue,
  type ProfanityLanguageDictionaryValidationIssue,
} from "./validation/contracts.js";
import { validateGeneratedMetadata } from "./validation/generated-metadata.js";
import { validateRules } from "./validation/rules.js";
import { isNonEmptyString, isRecord } from "./validation/shared.js";

export type {
  ProfanityLanguageDictionaryValidationIssue,
  ProfanityLanguageDictionaryValidationIssueCode,
} from "./validation/contracts.js";

const ALLOWED_NORMALIZATION_STRATEGIES = new Set<unknown>([
  "cyrillic-homoglyphs",
  "latin-preserving",
] as const satisfies readonly ProfanityNormalizationStrategy[]);

const LANGUAGE_CODE_PATTERN = /^[a-z]{2}$/u;

export const validateProfanityLanguageDictionary = (
  dictionary: unknown,
): ProfanityLanguageDictionaryValidationIssue[] => {
  const issues: ProfanityLanguageDictionaryValidationIssue[] = [];

  if (!isRecord(dictionary)) {
    issues.push(
      issue("$", "invalid_dictionary", "Dictionary must be an object."),
    );
    return issues;
  }

  validateLanguage(dictionary, issues);
  validateNormalization(dictionary, issues);
  validateRules(dictionary, issues);
  validateGeneratedMetadata(dictionary, issues);

  return issues;
};

const validateNormalization = (
  dictionary: Record<string, unknown>,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (
    "normalization" in dictionary &&
    dictionary.normalization !== undefined &&
    !ALLOWED_NORMALIZATION_STRATEGIES.has(dictionary.normalization)
  ) {
    issues.push(
      issue(
        "normalization",
        "invalid_normalization",
        "Dictionary normalization must be cyrillic-homoglyphs or latin-preserving.",
      ),
    );
  }
};

const validateLanguage = (
  dictionary: Record<string, unknown>,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (!("language" in dictionary)) {
    issues.push(
      issue("language", "missing_language", "Dictionary language is required."),
    );
    return;
  }

  if (
    !isNonEmptyString(dictionary.language) ||
    !LANGUAGE_CODE_PATTERN.test(dictionary.language)
  ) {
    issues.push(
      issue(
        "language",
        "invalid_language",
        "Dictionary language must be a lowercase ISO 639-1 language code.",
      ),
    );
  }
};
