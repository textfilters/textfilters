import type { ProfanityCategory, ProfanitySeverity } from "../../types.js";
import {
  issue,
  type ProfanityLanguageDictionaryValidationIssue,
} from "./contracts.js";
import { isNonEmptyString } from "./shared.js";

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

const SEMANTIC_RULE_ID_PATTERN = /^[a-z]{2}\.[a-z]+(?:\.[a-z0-9]+)+$/u;
const CATEGORY_ID_SEGMENTS = new Map<ProfanityCategory, string>([
  ["OBSCENE_MAT", "obscene"],
  ["STRONG_INSULT", "insult"],
  ["VULGAR", "vulgar"],
  ["EUPHEMISM", "euphemism"],
]);

export const validateRuleId = (
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

export const validateRuleIdTaxonomy = (
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

export const validateRuleTaxonomy = (
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
