import { loosenInternalRuleSource } from "../../matchers/internal-rules.js";
import { languageRuleSourcePattern } from "../profanity.js";
import {
  issue,
  type ProfanityLanguageDictionaryValidationIssue,
} from "./contracts.js";
import { isRuleSource } from "./rule-source.js";
import { isRecord } from "./shared.js";

const ALLOWED_MATCH_KEYS = new Set(["strict", "loose"]);
const ALLOWED_LOOSE_MATCH_OPTION_KEYS = new Set([
  "stretch",
  "hyphenTail",
  "hyphenTailMin",
]);

export const validateRuleMatch = (
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
