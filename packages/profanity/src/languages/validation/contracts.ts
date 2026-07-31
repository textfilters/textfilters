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

export const issue = (
  path: string,
  code: ProfanityLanguageDictionaryValidationIssueCode,
  message: string,
): ProfanityLanguageDictionaryValidationIssue => ({
  path,
  code,
  message,
});
