import {
  issue,
  type ProfanityLanguageDictionaryValidationIssue,
} from "./contracts.js";
import { isRecord } from "./shared.js";

export const GENERATED_METADATA_KEYS = new Set([
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

export const validateGeneratedMetadata = (
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
