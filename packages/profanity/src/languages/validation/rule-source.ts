import { languageRuleSourcePattern } from "../profanity.js";
import {
  issue,
  type ProfanityLanguageDictionaryValidationIssue,
} from "./contracts.js";
import { isNonEmptyString } from "./shared.js";

export const validateRuleSource = (
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

export const isRuleSource = (
  source: unknown,
): source is string | readonly string[] =>
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
