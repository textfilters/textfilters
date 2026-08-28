import type { SpamGuardOptions } from "./contracts.js";

export interface SpamGuardConfig {
  readonly minIntervalMs: number;
  readonly duplicateWindowMs: number;
  readonly burstWindowMs: number;
  readonly burstMaxMessages: number;
  readonly maxActors: number;
}

export const DEFAULT_CONFIG: SpamGuardConfig = {
  minIntervalMs: 700,
  duplicateWindowMs: 12_000,
  burstWindowMs: 10_000,
  burstMaxMessages: 6,
  maxActors: 3_000,
};

const MAX_LIMIT = Number.MAX_SAFE_INTEGER;

export function normalizeConfig(
  options: SpamGuardOptions = {},
): SpamGuardConfig {
  return {
    minIntervalMs: toBoundedInt(
      options.minIntervalMs,
      DEFAULT_CONFIG.minIntervalMs,
      0,
    ),
    duplicateWindowMs: toBoundedInt(
      options.duplicateWindowMs,
      DEFAULT_CONFIG.duplicateWindowMs,
    ),
    burstWindowMs: toBoundedInt(
      options.burstWindowMs,
      DEFAULT_CONFIG.burstWindowMs,
    ),
    burstMaxMessages: toBoundedInt(
      options.burstMaxMessages,
      DEFAULT_CONFIG.burstMaxMessages,
    ),
    maxActors: toBoundedInt(options.maxActors, DEFAULT_CONFIG.maxActors),
  };
}

export function toBoundedInt(
  value: number | undefined,
  fallback: number,
  minimum = 1,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const integer = Math.trunc(value);
  return integer >= minimum && integer <= MAX_LIMIT ? integer : fallback;
}
