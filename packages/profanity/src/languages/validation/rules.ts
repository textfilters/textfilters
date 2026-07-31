import {
  issue,
  type ProfanityLanguageDictionaryValidationIssue,
} from "./contracts.js";
import { GENERATED_METADATA_KEYS } from "./generated-metadata.js";
import {
  validateRuleId,
  validateRuleIdTaxonomy,
  validateRuleTaxonomy,
} from "./rule-identity.js";
import { validateRuleMatch } from "./rule-match.js";
import { validateRuleSource } from "./rule-source.js";
import { isNonEmptyString, isRecord } from "./shared.js";

const ALLOWED_RULE_KEYS = new Set([
  "id",
  "category",
  "severity",
  "source",
  "match",
]);

export const validateRules = (
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
    validateRuleMatch(rule, path, issues);
  });
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
