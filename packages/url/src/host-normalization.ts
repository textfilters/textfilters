import { lowerNfkc, stripZeroWidth } from "@textfilters/core";

const GREEK_FINAL_SIGMA_RE = /ς/gu;
const VARIATION_SELECTOR_RE = /[\u{fe00}-\u{fe0f}\u{e0100}-\u{e01ef}]/gu;

// Whole-string lowercasing uses the contextual final sigma. Fold it back to
// the standard sigma so complete-label and per-code-point matching agree.
export const normalizeHostText = (value: unknown): string =>
  lowerNfkc(value).replace(GREEK_FINAL_SIGMA_RE, "σ").normalize("NFKC");

export const stripIgnorableHostFormatting = (value: unknown): string =>
  stripZeroWidth(value).replace(VARIATION_SELECTOR_RE, "");
