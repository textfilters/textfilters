import { expect } from "vitest";

import type { ProfanityLanguageDictionary } from "../src/languages/profanity.js";
import type { ProfanityCategory, ProfanitySeverity } from "../src/index.js";

const ALLOWED_PROFANITY_CATEGORIES = [
  "OBSCENE_MAT",
  "STRONG_INSULT",
  "VULGAR",
  "EUPHEMISM",
] as const satisfies readonly ProfanityCategory[];

const ALLOWED_PROFANITY_SEVERITIES = [
  "high",
  "medium",
  "low",
  "soft",
] as const satisfies readonly ProfanitySeverity[];

const ALLOWED_PROFANITY_CATEGORY_SET = new Set<unknown>(
  ALLOWED_PROFANITY_CATEGORIES,
);

const ALLOWED_PROFANITY_SEVERITY_SET = new Set<unknown>(
  ALLOWED_PROFANITY_SEVERITIES,
);

const ALLOWED_LOOSE_MATCH_OPTION_KEYS = new Set(["stretch"]);
const GENERATED_MATCHER_METADATA_KEYS = new Set(["id", "order", "ruleId"]);

export const assertLanguageDictionaryInvariants = (
  dictionary: ProfanityLanguageDictionary,
): void => {
  const failures = [
    ...dictionaryShapeFailures(dictionary),
    ...dictionary.rules.flatMap((rule, index) =>
      ruleInvariantFailures(rule, index),
    ),
    ...generatedMatcherMetadataFailures(dictionary),
  ];

  expect(failures).toEqual([]);
};

const dictionaryShapeFailures = (
  dictionary: ProfanityLanguageDictionary,
): string[] => {
  const failures = [];

  if (dictionary.language.trim().length === 0) {
    failures.push("dictionary.language must not be empty");
  }

  if (dictionary.rules.length === 0) {
    failures.push("dictionary.rules must not be empty");
  }

  return failures;
};

const ruleInvariantFailures = (
  rule: ProfanityLanguageDictionary["rules"][number],
  index: number,
): string[] => {
  const failures = [];

  if (rule.source.trim().length === 0) {
    failures.push(`rules[${index}].source must not be empty`);
  }

  if (rule.match.strict === undefined && rule.match.loose === undefined) {
    failures.push(`rules[${index}].match must include strict or loose`);
  }

  if (rule.match.strict !== undefined) {
    const strictKeys = Object.keys(rule.match.strict);
    if (strictKeys.length > 0) {
      failures.push(
        `rules[${index}].match.strict must not include generated matcher metadata`,
      );
    }
  }

  if (rule.match.loose !== undefined) {
    for (const key of Object.keys(rule.match.loose)) {
      if (!ALLOWED_LOOSE_MATCH_OPTION_KEYS.has(key)) {
        failures.push(`rules[${index}].match.loose.${key} is not supported`);
      }
    }

    if ("stretch" in rule.match.loose && rule.match.loose.stretch !== true) {
      failures.push(`rules[${index}].match.loose.stretch must be true`);
    }
  }

  if (
    rule.category !== undefined &&
    !ALLOWED_PROFANITY_CATEGORY_SET.has(rule.category)
  ) {
    failures.push(`rules[${index}].category is not supported`);
  }

  if (
    rule.severity !== undefined &&
    !ALLOWED_PROFANITY_SEVERITY_SET.has(rule.severity)
  ) {
    failures.push(`rules[${index}].severity is not supported`);
  }

  return failures;
};

const generatedMatcherMetadataFailures = (
  dictionary: ProfanityLanguageDictionary,
): string[] => {
  const failures = [];
  const visit = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      if (value.startsWith("builtin:")) {
        failures.push(`${path} must not contain generated matcher ids`);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    if (typeof value !== "object" || value === null) {
      return;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      if (key === "order") {
        failures.push(
          `${path}.${key} must not contain generated order metadata`,
        );
      }

      if (
        (key === "strict" || key === "loose") &&
        typeof nestedValue === "object" &&
        nestedValue !== null
      ) {
        for (const optionKey of Object.keys(nestedValue)) {
          if (GENERATED_MATCHER_METADATA_KEYS.has(optionKey)) {
            failures.push(
              `${path}.${key}.${optionKey} must not contain generated matcher metadata`,
            );
          }
        }
      }

      visit(nestedValue, `${path}.${key}`);
    }
  };

  visit(dictionary, "dictionary");
  return failures;
};
