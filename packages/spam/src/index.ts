import {
  cloneActorState,
  createActorState,
  pruneActorStates,
  pruneBurstTimestamps,
  pruneDuplicateTexts,
  recordRecentNormalizedText,
  trimActorRecords,
  type ActorState,
} from "./actor-state.js";
import { normalizeConfig } from "./config.js";
import {
  SPAM_BLOCK_REASONS,
  type SpamGuard,
  type SpamGuardOptions,
} from "./contracts.js";
import { normalizeActorKey, normalizeForSpam } from "./normalize.js";

const MAX_RECENT_TEXTS_PER_ACTOR = 256;

export { SPAM_BLOCK_REASONS } from "./contracts.js";
export type {
  SpamBlockReason,
  SpamDecision,
  SpamGuard,
  SpamGuardOptions,
} from "./contracts.js";

export function createSpamGuard(options: SpamGuardOptions = {}): SpamGuard {
  const config = normalizeConfig(options);
  const actors = new Map<string, ActorState>();
  const retentionMs = Math.max(
    config.minIntervalMs,
    config.duplicateWindowMs,
    config.burstWindowMs,
  );

  const guard: SpamGuard = {
    name: "spam",

    check(input) {
      if (typeof input !== "object" || input === null || Array.isArray(input)) {
        throw new TypeError("input must be an object");
      }
      if (typeof input.actorKey !== "string") {
        throw new TypeError("actorKey must be a non-empty string");
      }
      const actorKey = normalizeActorKey(input.actorKey);
      if (actorKey.length === 0) {
        throw new TypeError("actorKey must be a non-empty string");
      }
      if (typeof input.text !== "string") {
        throw new TypeError("text must be a string");
      }
      const nowMs = resolveNowMs(input.nowMs);
      const normalized = normalizeForSpam(input.text);
      if (normalized.length === 0) {
        return { allowed: false, reason: SPAM_BLOCK_REASONS.empty };
      }

      const actor = cloneActorState(actors.get(actorKey) ?? createActorState());
      if (
        config.minIntervalMs > 0 &&
        actor.lastMessageAt !== Number.NEGATIVE_INFINITY &&
        nowMs - actor.lastMessageAt < config.minIntervalMs
      ) {
        return { allowed: false, reason: SPAM_BLOCK_REASONS.tooFast };
      }

      pruneDuplicateTexts(actor, nowMs, config.duplicateWindowMs);
      const previousTextAt = actor.recentNormalizedTexts.get(normalized);
      if (
        previousTextAt !== undefined &&
        nowMs - previousTextAt < config.duplicateWindowMs
      ) {
        return { allowed: false, reason: SPAM_BLOCK_REASONS.duplicate };
      }

      pruneBurstTimestamps(actor, nowMs, config.burstWindowMs);
      if (actor.timestamps.length >= config.burstMaxMessages) {
        return { allowed: false, reason: SPAM_BLOCK_REASONS.burst };
      }

      actor.timestamps.push(nowMs);
      actor.lastMessageAt = nowMs;
      recordRecentNormalizedText(actor, normalized, nowMs);
      trimActorRecords(
        actor,
        Math.max(config.burstMaxMessages, 1),
        MAX_RECENT_TEXTS_PER_ACTOR,
      );
      actors.set(actorKey, actor);
      pruneActorStates(actors, nowMs, config.maxActors, retentionMs);
      return { allowed: true };
    },

    reset() {
      actors.clear();
    },
  };

  return Object.freeze(guard);
}

function resolveNowMs(nowMs: number | undefined): number {
  if (nowMs === undefined) return Date.now();
  if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) {
    throw new TypeError("nowMs must be a finite number");
  }
  return nowMs;
}
