import { lowerNfkc, stripZeroWidth } from "@textfilters/core";

export const MAX_MESSAGE_NORMALIZED_LENGTH = 512;
export const UNKNOWN_ACTOR_KEY = "__unknown_actor__";

// Spam comparisons are intentionally short and formatting-insensitive: repeated
// whitespace and zero-width obfuscation should not create distinct messages.
export const normalizeForSpam = (text: unknown): string =>
  lowerNfkc(stripZeroWidth(text))
    .replace(/\s+/gu, " ")
    .slice(0, MAX_MESSAGE_NORMALIZED_LENGTH)
    .trim();

// Missing actor keys still need a stable bucket so stateless callers get
// deterministic behavior instead of bypassing rate and duplicate checks.
export const normalizeActorKey = (value: unknown): string =>
  lowerNfkc(stripZeroWidth(value)).trim() || UNKNOWN_ACTOR_KEY;
