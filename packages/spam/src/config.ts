import type { SpamFilterConfig, SpamStateStore } from "./contracts.js";

export const DEFAULT_CONFIG: SpamFilterConfig = {
  minIntervalMs: 700,
  duplicateWindowMs: 12000,
  burstWindowMs: 10000,
  burstMaxMessages: 6,
  maxActors: 3000,
  actorKeyPolicy: "shared_unknown",
  clockPolicy: "input_or_system",
  trackRejectedAttempts: false,
};

const MAX_LIMIT = Number.MAX_SAFE_INTEGER;

// Reject invalid limits instead of clamping them, so a single bad option cannot
// silently disable a guard by expanding it to an effectively unbounded value.
export const toBoundedInt = (
  value: unknown,
  fallback: number,
  min = 1,
): number => {
  if (typeof value !== "number") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min || i > MAX_LIMIT) return fallback;
  return i;
};

export const normalizeConfig = (
  rawConfig: Partial<SpamFilterConfig> = {},
): SpamFilterConfig => ({
  minIntervalMs: toBoundedInt(
    rawConfig.minIntervalMs,
    DEFAULT_CONFIG.minIntervalMs,
    0,
  ),
  duplicateWindowMs: toBoundedInt(
    rawConfig.duplicateWindowMs,
    DEFAULT_CONFIG.duplicateWindowMs,
  ),
  burstWindowMs: toBoundedInt(
    rawConfig.burstWindowMs,
    DEFAULT_CONFIG.burstWindowMs,
  ),
  burstMaxMessages: toBoundedInt(
    rawConfig.burstMaxMessages,
    DEFAULT_CONFIG.burstMaxMessages,
  ),
  maxActors: toBoundedInt(rawConfig.maxActors, DEFAULT_CONFIG.maxActors),
  actorKeyPolicy:
    rawConfig.actorKeyPolicy === "reject_missing"
      ? "reject_missing"
      : DEFAULT_CONFIG.actorKeyPolicy,
  clockPolicy:
    rawConfig.clockPolicy === "system" ? "system" : DEFAULT_CONFIG.clockPolicy,
  trackRejectedAttempts: rawConfig.trackRejectedAttempts === true,
  stateStore: isSpamStateStore(rawConfig.stateStore)
    ? rawConfig.stateStore
    : undefined,
});

function isSpamStateStore(value: unknown): value is SpamStateStore {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof value.get === "function" &&
    "set" in value &&
    typeof value.set === "function" &&
    "delete" in value &&
    typeof value.delete === "function" &&
    "clear" in value &&
    typeof value.clear === "function" &&
    "entries" in value &&
    typeof value.entries === "function" &&
    "size" in value &&
    typeof value.size === "number"
  );
}
