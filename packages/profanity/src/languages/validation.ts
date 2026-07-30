import type { ProfanityCategory, ProfanitySeverity } from "../types.js";
import { loosenInternalRuleSource } from "../matchers/internal-rules.js";
import {
  languageRuleSourcePattern,
  type ProfanityNormalizationStrategy,
} from "./profanity.js";

export type ProfanityLanguageDictionaryValidationIssueCode =
  | "invalid_dictionary"
  | "missing_language"
  | "invalid_language"
  | "invalid_normalization"
  | "missing_rules"
  | "invalid_rules"
  | "empty_rules"
  | "invalid_rule"
  | "missing_id"
  | "invalid_id"
  | "generated_id"
  | "suspicious_id"
  | "duplicate_id"
  | "language_mismatch_id"
  | "missing_category"
  | "invalid_category"
  | "missing_severity"
  | "invalid_severity"
  | "missing_source"
  | "invalid_source"
  | "source_not_trimmed"
  | "invalid_source_pattern"
  | "duplicate_source"
  | "missing_match"
  | "invalid_match"
  | "unsupported_rule_key"
  | "invalid_source_exemptions"
  | "unsupported_match_key"
  | "missing_match_mode"
  | "invalid_strict_options"
  | "unsupported_strict_option"
  | "invalid_loose_options"
  | "unsupported_loose_option"
  | "invalid_loose_option_value"
  | "generated_metadata";

export interface ProfanityLanguageDictionaryValidationIssue {
  readonly path: string;
  readonly code: ProfanityLanguageDictionaryValidationIssueCode;
  readonly message: string;
}

const ALLOWED_PROFANITY_CATEGORIES = new Set<unknown>([
  "OBSCENE_MAT",
  "STRONG_INSULT",
  "VULGAR",
  "EUPHEMISM",
] as const satisfies readonly ProfanityCategory[]);

const ALLOWED_PROFANITY_SEVERITIES = new Set<unknown>([
  "high",
  "medium",
  "low",
  "soft",
] as const satisfies readonly ProfanitySeverity[]);

const ALLOWED_NORMALIZATION_STRATEGIES = new Set<unknown>([
  "cyrillic-homoglyphs",
  "latin-preserving",
] as const satisfies readonly ProfanityNormalizationStrategy[]);

const ALLOWED_RULE_KEYS = new Set([
  "id",
  "category",
  "severity",
  "source",
  "match",
  "originalSourceExemptions",
]);
const ALLOWED_MATCH_KEYS = new Set(["strict", "loose"]);
const ALLOWED_LOOSE_MATCH_OPTION_KEYS = new Set([
  "stretch",
  "hyphenTail",
  "hyphenTailMin",
]);
const SEMANTIC_RULE_ID_PATTERN = /^[a-z]{2}\.[a-z]+(?:\.[a-z0-9]+)+$/u;
const LANGUAGE_CODE_PATTERN = /^[a-z]{2}$/u;
const CATEGORY_ID_SEGMENTS = new Map<ProfanityCategory, string>([
  ["OBSCENE_MAT", "obscene"],
  ["STRONG_INSULT", "insult"],
  ["VULGAR", "vulgar"],
  ["EUPHEMISM", "euphemism"],
]);
const GENERATED_METADATA_KEYS = new Set([
  "ruleId",
  "order",
  "re",
  "regex",
  "regexp",
  "pattern",
  "patterns",
  "range",
  "ranges",
  "trimHyphenTail",
]);

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

const validateRules = (
  dictionary: Record<string, unknown>,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (!("rules" in dictionary)) {
    issues.push(
      issue("rules", "missing_rules", "Dictionary rules are required."),
    );
    return;
  }

  if (!Array.isArray(dictionary.rules)) {
    issues.push(
      issue("rules", "invalid_rules", "Dictionary rules must be an array."),
    );
    return;
  }

  if (dictionary.rules.length === 0) {
    issues.push(
      issue("rules", "empty_rules", "Dictionary rules must not be empty."),
    );
  }

  const language = isNonEmptyString(dictionary.language)
    ? dictionary.language
    : undefined;
  const seenRuleIds = new Map<string, number>();
  const seenRuleSources = new Map<string, number>();

  dictionary.rules.forEach((rule, index) => {
    const path = `rules[${index}]`;

    if (!isRecord(rule)) {
      issues.push(
        issue(path, "invalid_rule", "Dictionary rule must be an object."),
      );
      return;
    }

    validateRuleKeys(rule, path, issues);
    validateRuleId(rule, path, index, language, seenRuleIds, issues);
    validateRuleTaxonomy(rule, path, issues);
    validateRuleIdTaxonomy(rule, path, issues);
    validateRuleSource(rule, path, index, seenRuleSources, issues);
    validateSourceExemptions(rule, path, issues);
    validateRuleMatch(rule, path, issues);
  });
};

const validateSourceExemptions = (
  rule: Record<string, unknown>,
  path: string,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (!("originalSourceExemptions" in rule)) {
    return;
  }

  if (
    !Array.isArray(rule.originalSourceExemptions) ||
    rule.originalSourceExemptions.length === 0 ||
    !rule.originalSourceExemptions.every(isNonEmptyString)
  ) {
    issues.push(
      issue(
        `${path}.originalSourceExemptions`,
        "invalid_source_exemptions",
        "Original-source exemptions must be a non-empty array of non-empty strings.",
      ),
    );
  }
};

const validateRuleId = (
  rule: Record<string, unknown>,
  path: string,
  index: number,
  language: string | undefined,
  seenRuleIds: Map<string, number>,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (!("id" in rule)) {
    issues.push(issue(`${path}.id`, "missing_id", "Rule id is required."));
    return;
  }

  if (!isNonEmptyString(rule.id)) {
    issues.push(
      issue(`${path}.id`, "invalid_id", "Rule id must be a non-empty string."),
    );
    return;
  }

  if (rule.id.startsWith("builtin:")) {
    issues.push(
      issue(
        `${path}.id`,
        "generated_id",
        "Rule id must not use a generated builtin:* id.",
      ),
    );
  } else if (!SEMANTIC_RULE_ID_PATTERN.test(rule.id)) {
    issues.push(
      issue(
        `${path}.id`,
        "invalid_id",
        "Rule id must be a semantic dotted id.",
      ),
    );
  } else if (language !== undefined && !rule.id.startsWith(`${language}.`)) {
    issues.push(
      issue(
        `${path}.id`,
        "language_mismatch_id",
        "Rule id must start with the dictionary language code.",
      ),
    );
  }

  const firstIndex = seenRuleIds.get(rule.id);
  if (firstIndex !== undefined) {
    issues.push(
      issue(
        `${path}.id`,
        "duplicate_id",
        `Rule id duplicates rules[${firstIndex}].id.`,
      ),
    );
    return;
  }

  seenRuleIds.set(rule.id, index);
};

const validateRuleKeys = (
  rule: Record<string, unknown>,
  path: string,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  for (const key of Object.keys(rule)) {
    if (!ALLOWED_RULE_KEYS.has(key) && !GENERATED_METADATA_KEYS.has(key)) {
      issues.push(
        issue(
          `${path}.${key}`,
          "unsupported_rule_key",
          "Rule field is not supported in source dictionaries.",
        ),
      );
    }
  }
};

const validateRuleIdTaxonomy = (
  rule: Record<string, unknown>,
  path: string,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (
    !isNonEmptyString(rule.id) ||
    !SEMANTIC_RULE_ID_PATTERN.test(rule.id) ||
    !ALLOWED_PROFANITY_CATEGORIES.has(rule.category)
  ) {
    return;
  }

  const category = rule.category as ProfanityCategory;
  const categorySegment = CATEGORY_ID_SEGMENTS.get(category);
  const actualSegment = rule.id.split(".")[1];

  if (categorySegment !== undefined && actualSegment !== categorySegment) {
    issues.push(
      issue(
        `${path}.id`,
        "suspicious_id",
        "Rule id category segment should match the rule category.",
      ),
    );
  }
};

const validateRuleTaxonomy = (
  rule: Record<string, unknown>,
  path: string,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (!("category" in rule)) {
    issues.push(
      issue(
        `${path}.category`,
        "missing_category",
        "Rule category is required.",
      ),
    );
  } else if (!ALLOWED_PROFANITY_CATEGORIES.has(rule.category)) {
    issues.push(
      issue(
        `${path}.category`,
        "invalid_category",
        "Rule category must be a supported profanity category.",
      ),
    );
  }

  if (!("severity" in rule)) {
    issues.push(
      issue(
        `${path}.severity`,
        "missing_severity",
        "Rule severity is required.",
      ),
    );
  } else if (!ALLOWED_PROFANITY_SEVERITIES.has(rule.severity)) {
    issues.push(
      issue(
        `${path}.severity`,
        "invalid_severity",
        "Rule severity must be a supported profanity severity.",
      ),
    );
  }
};

const validateRuleSource = (
  rule: Record<string, unknown>,
  path: string,
  index: number,
  seenRuleSources: Map<string, number>,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (!("source" in rule)) {
    issues.push(
      issue(`${path}.source`, "missing_source", "Rule source is required."),
    );
    return;
  }

  const source = rule.source;
  const sourcePath = `${path}.source`;

  if (!isRuleSource(source)) {
    issues.push(
      issue(
        sourcePath,
        "invalid_source",
        "Rule source must be a non-empty string or an array of non-empty strings.",
      ),
    );
    return;
  }

  if (typeof source === "string") {
    validateSourceString(source, sourcePath, issues);
  } else {
    source.forEach((part, partIndex) =>
      validateSourceString(part, `${sourcePath}[${partIndex}]`, issues),
    );
  }

  const sourcePattern = languageRuleSourcePattern(source);

  try {
    new RegExp(sourcePattern, "u");
  } catch {
    issues.push(
      issue(
        sourcePath,
        "invalid_source_pattern",
        "Rule source must compile as a Unicode regular expression.",
      ),
    );
  }

  const normalizedSource = sourcePattern.trim().normalize("NFC");
  const firstIndex = seenRuleSources.get(normalizedSource);
  if (firstIndex !== undefined) {
    issues.push(
      issue(
        sourcePath,
        "duplicate_source",
        `Rule source duplicates rules[${firstIndex}].source.`,
      ),
    );
    return;
  }

  seenRuleSources.set(normalizedSource, index);
};

const isRuleSource = (source: unknown): source is string | readonly string[] =>
  isNonEmptyString(source) ||
  (Array.isArray(source) &&
    source.length > 0 &&
    source.every((part) => isNonEmptyString(part)));

const validateSourceString = (
  source: string,
  path: string,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (source !== source.trim()) {
    issues.push(
      issue(
        path,
        "source_not_trimmed",
        "Rule source must not include leading or trailing whitespace.",
      ),
    );
  }
};

const validateRuleMatch = (
  rule: Record<string, unknown>,
  path: string,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (!("match" in rule)) {
    issues.push(
      issue(`${path}.match`, "missing_match", "Rule match is required."),
    );
    return;
  }

  if (!isRecord(rule.match)) {
    issues.push(
      issue(`${path}.match`, "invalid_match", "Rule match must be an object."),
    );
    return;
  }

  const hasStrict = rule.match.strict !== undefined;
  const hasLoose = rule.match.loose !== undefined;

  for (const key of Object.keys(rule.match)) {
    if (!ALLOWED_MATCH_KEYS.has(key)) {
      issues.push(
        issue(
          `${path}.match.${key}`,
          "unsupported_match_key",
          "Rule match key is not supported.",
        ),
      );
    }
  }

  if (!hasStrict && !hasLoose) {
    issues.push(
      issue(
        `${path}.match`,
        "missing_match_mode",
        "Rule match must include strict, loose, or both.",
      ),
    );
  }

  if (hasStrict) {
    validateStrictMatch(rule.match.strict, `${path}.match.strict`, issues);
  }

  if (hasLoose) {
    validateLooseMatch(rule.match.loose, `${path}.match.loose`, issues);
    validateLooseSourcePattern(rule, path, rule.match.loose, issues);
  }
};

const validateStrictMatch = (
  strict: unknown,
  path: string,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (!isRecord(strict)) {
    issues.push(
      issue(
        path,
        "invalid_strict_options",
        "Strict match options must be an object.",
      ),
    );
    return;
  }

  for (const key of Object.keys(strict)) {
    issues.push(
      issue(
        `${path}.${key}`,
        "unsupported_strict_option",
        "Strict match options do not support custom fields.",
      ),
    );
  }
};

const validateLooseMatch = (
  loose: unknown,
  path: string,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (!isRecord(loose)) {
    issues.push(
      issue(
        path,
        "invalid_loose_options",
        "Loose match options must be an object.",
      ),
    );
    return;
  }

  for (const [key, value] of Object.entries(loose)) {
    if (!ALLOWED_LOOSE_MATCH_OPTION_KEYS.has(key)) {
      issues.push(
        issue(
          `${path}.${key}`,
          "unsupported_loose_option",
          "Loose match option is not supported.",
        ),
      );
      continue;
    }

    if (value === undefined) {
      continue;
    }

    if ((key === "stretch" || key === "hyphenTail") && value !== true) {
      issues.push(
        issue(
          `${path}.${key}`,
          "invalid_loose_option_value",
          "Loose match option must be true when present.",
        ),
      );
    }

    if (
      key === "hyphenTailMin" &&
      (typeof value !== "number" || !Number.isInteger(value) || value < 1)
    ) {
      issues.push(
        issue(
          `${path}.${key}`,
          "invalid_loose_option_value",
          "Loose match numeric options must be positive integers.",
        ),
      );
    }
  }

  if (
    typeof loose.hyphenTailMin === "number" &&
    Number.isInteger(loose.hyphenTailMin) &&
    loose.hyphenTailMin >= 1 &&
    loose.hyphenTail !== true
  ) {
    issues.push(
      issue(
        `${path}.hyphenTailMin`,
        "invalid_loose_option_value",
        "hyphenTailMin requires hyphenTail to be true.",
      ),
    );
  }
};

const validateLooseSourcePattern = (
  rule: Record<string, unknown>,
  path: string,
  loose: unknown,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  if (!isRuleSource(rule.source) || !isValidLooseMatch(loose)) {
    return;
  }

  const sourcePattern = languageRuleSourcePattern(rule.source);

  try {
    new RegExp(sourcePattern, "u");
    new RegExp(loosenInternalRuleSource(sourcePattern, loose), "u");
  } catch {
    issues.push(
      issue(
        `${path}.source`,
        "invalid_source_pattern",
        "Rule source must compile after loose matching expansion.",
      ),
    );
  }
};

const isValidLooseMatch = (
  loose: unknown,
): loose is {
  readonly stretch?: boolean;
  readonly hyphenTail?: boolean;
  readonly hyphenTailMin?: number;
} => {
  if (!isRecord(loose)) {
    return false;
  }

  for (const [key, value] of Object.entries(loose)) {
    if (!ALLOWED_LOOSE_MATCH_OPTION_KEYS.has(key)) {
      return false;
    }

    if (value === undefined) {
      continue;
    }

    if ((key === "stretch" || key === "hyphenTail") && value !== true) {
      return false;
    }

    if (
      key === "hyphenTailMin" &&
      (typeof value !== "number" || !Number.isInteger(value) || value < 1)
    ) {
      return false;
    }
  }

  return loose.hyphenTailMin === undefined || loose.hyphenTail === true;
};

const validateGeneratedMetadata = (
  dictionary: Record<string, unknown>,
  issues: ProfanityLanguageDictionaryValidationIssue[],
): void => {
  const seen = new WeakSet<object>();

  const visit = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      if (value.startsWith("builtin:") && !path.endsWith(".id")) {
        issues.push(
          issue(
            path,
            "generated_id",
            "Source dictionary must not contain builtin:* ids.",
          ),
        );
      }
      return;
    }

    if (Array.isArray(value)) {
      if (seen.has(value)) {
        return;
      }

      seen.add(value);
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    if (seen.has(value)) {
      return;
    }

    seen.add(value);

    for (const [key, nestedValue] of Object.entries(value)) {
      const nestedPath = path === "$" ? key : `${path}.${key}`;

      if (GENERATED_METADATA_KEYS.has(key)) {
        issues.push(
          issue(
            nestedPath,
            "generated_metadata",
            "Source dictionary must not contain generated matcher metadata.",
          ),
        );
      }

      visit(nestedValue, nestedPath);
    }
  };

  visit(dictionary, "$");
};

const issue = (
  path: string,
  code: ProfanityLanguageDictionaryValidationIssueCode,
  message: string,
): ProfanityLanguageDictionaryValidationIssue => ({
  path,
  code,
  message,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
