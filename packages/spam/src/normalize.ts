const ZERO_WIDTH_RE = /[\u200B-\u200D\u2060\uFEFF]/gu;

const normalize = (text: string): string =>
  text.replace(ZERO_WIDTH_RE, "").normalize("NFKC").toLowerCase();

export const normalizeForSpam = (text: string): string =>
  normalize(text).replace(/\s+/gu, " ").trim();

export const normalizeActorKey = (actorKey: string): string =>
  normalize(actorKey).trim();
