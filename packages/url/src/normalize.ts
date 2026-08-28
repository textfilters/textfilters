const ZERO_WIDTH_RE = /[\u200B-\u200D\u2060\uFEFF]/gu;

export const lowerNfkc = (text: string): string =>
  text.normalize("NFKC").toLowerCase();

export const stripZeroWidth = (text: string): string =>
  text.replace(ZERO_WIDTH_RE, "");
