import { SCANNER_PUNCTUATION, TOKEN_VALUE } from "../core/types.js";

const LOCAL_CHAR_RE = /^[a-z0-9._%+-]$/u;
const WORD_CHAR_RE = /^[a-z0-9_+-]$/u;
const DOMAIN_LABEL_RE = /^[a-z0-9-]+$/u;
const TLD_RE = /^[a-z][a-z0-9-]{1,62}$/u;
const LOCAL_DOT_SEQUENCE = TOKEN_VALUE.dotSymbol + TOKEN_VALUE.dotSymbol;

export const isLocalChar = (value: string): boolean =>
  LOCAL_CHAR_RE.test(value);

export const isWordChar = (value: string): boolean => WORD_CHAR_RE.test(value);

export const hasLeadingBoundary = (value: string): boolean =>
  value === "" || !isLocalChar(value);

export const hasTrailingBoundary = (value: string): boolean =>
  value === "" || value === TOKEN_VALUE.dotSymbol || !isLocalChar(value);

export const isValidLocal = (value: string): boolean => {
  // Local-part validation mirrors the direct scanner and the token scanner, so
  // an obfuscated address cannot accept a local that a literal address rejects.
  if (value.length === 0 || value.length > 64) return false;
  if (
    value.startsWith(TOKEN_VALUE.dotSymbol) ||
    value.endsWith(TOKEN_VALUE.dotSymbol)
  ) {
    return false;
  }
  if (value.includes(LOCAL_DOT_SEQUENCE)) return false;
  return Array.from(value).every(isLocalChar);
};

export const isValidDomain = (labels: readonly string[]): boolean => {
  if (labels.length < 2) return false;
  return (
    labels.every((label) => {
      if (label.length === 0 || label.length > 63) return false;
      if (
        label.startsWith(SCANNER_PUNCTUATION.hyphen) ||
        label.endsWith(SCANNER_PUNCTUATION.hyphen)
      ) {
        return false;
      }
      return DOMAIN_LABEL_RE.test(label);
    }) && TLD_RE.test(labels[labels.length - 1])
  );
};
