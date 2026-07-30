const ZERO_WIDTH_RE = /[\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Normalizes public text-like input before filters process it.
 */
export function normalizeTextInput(value: unknown): string {
  return String(value ?? "");
}

/**
 * Normalizes arbitrary input for case-insensitive matching with compatibility
 * forms such as fullwidth Latin letters folded to their canonical shape.
 */
export function lowerNfkc(value: unknown): string {
  return normalizeTextInput(value).normalize("NFKC").toLowerCase();
}

/**
 * Removes invisible joiner-like characters before filters compare user text.
 */
export function stripZeroWidth(value: unknown): string {
  return normalizeTextInput(value).replace(ZERO_WIDTH_RE, "");
}

/**
 * Normalizes visible masking to exactly one user-visible code point.
 */
export function normalizeVisibleMaskChar(maskChar?: unknown): string {
  return Array.from(normalizeTextInput(maskChar) || "*")[0] ?? "*";
}

/**
 * Keeps UTF-16 length-preserving masking stable with one code unit.
 */
export function normalizeLengthPreservingMaskChar(maskChar?: unknown): string {
  const normalized = normalizeVisibleMaskChar(maskChar);
  return normalized.length === 1 ? normalized : "*";
}

/**
 * Backwards-compatible alias for visible mask character normalization.
 */
export function normalizeMaskChar(maskChar?: unknown): string {
  return normalizeVisibleMaskChar(maskChar);
}

export function toCodePoints(value: unknown): string[] {
  return Array.from(normalizeTextInput(value));
}
