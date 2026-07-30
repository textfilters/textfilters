import {
  createActorState,
  createInMemorySpamStateStore,
  createScopedSpamStateStore,
  pruneActorStates,
  pruneBurstTimestamps,
  pruneDuplicateTexts,
  recordRecentNormalizedText,
  trimActorRecords,
} from "./actor-state.js";
import { normalizeConfig } from "./config.js";
import {
  SPAM_BLOCK_REASONS,
  SPAM_FILTER_NAME,
  type ActorState,
  type SpamCheckInput,
  type SpamFilter,
  type SpamFilterConfig,
} from "./contracts.js";
import {
  normalizeActorKey,
  normalizeForSpam,
  UNKNOWN_ACTOR_KEY,
} from "./normalize.js";

const MAX_RECENT_TEXTS_PER_ACTOR = 256;

export * from "./contracts.js";
export { createInMemorySpamStateStore } from "./actor-state.js";

export function createSpamFilter(
  rawConfig: Partial<SpamFilterConfig> = {},
): SpamFilter {
  const config = normalizeConfig(rawConfig);
  const state = createScopedSpamStateStore(
    config.stateStore ?? createInMemorySpamStateStore(),
    stateScopeForConfig(config),
  );

  const retentionMs = Math.max(
    config.minIntervalMs,
    config.duplicateWindowMs,
    config.burstWindowMs,
  );
  const actorRecordLimits = {
    maxTimestamps: Math.max(config.burstMaxMessages, 1),
    maxRecentTexts: MAX_RECENT_TEXTS_PER_ACTOR,
  };

  return {
    name: SPAM_FILTER_NAME,
    check(input: SpamCheckInput) {
      const nowMs = resolveNowMs(input.nowMs, config.clockPolicy);
      const { actorKey, text } = input;
      const normalizedActorKey = normalizeActorKey(actorKey);
      const normalized = normalizeForSpam(text);
      if (!normalized) {
        return { allowed: false, reason: SPAM_BLOCK_REASONS.empty };
      }
      if (
        config.actorKeyPolicy === "reject_missing" &&
        normalizedActorKey === UNKNOWN_ACTOR_KEY
      ) {
        return { allowed: false, reason: SPAM_BLOCK_REASONS.missingActor };
      }

      let actor = state.get(normalizedActorKey);
      if (!actor) {
        actor = createActorState();
      }

      if (
        config.minIntervalMs > 0 &&
        actor.lastMessageAt >= 0 &&
        nowMs - actor.lastMessageAt < config.minIntervalMs
      ) {
        commitRejectedAttempt(actor, normalized, nowMs, config);
        trimActorRecords(actor, actorRecordLimits);
        if (config.trackRejectedAttempts) {
          state.set(normalizedActorKey, actor);
        }
        pruneActorStates(state, nowMs, config.maxActors, retentionMs);
        return { allowed: false, reason: SPAM_BLOCK_REASONS.tooFast };
      }

      pruneDuplicateTexts(actor, nowMs, config.duplicateWindowMs);
      const previousTextAt = actor.recentNormalizedTexts.get(normalized);
      if (
        previousTextAt !== undefined &&
        nowMs - previousTextAt < config.duplicateWindowMs
      ) {
        commitRejectedAttempt(actor, normalized, nowMs, config);
        trimActorRecords(actor, actorRecordLimits);
        state.set(normalizedActorKey, actor);
        pruneActorStates(state, nowMs, config.maxActors, retentionMs);
        return { allowed: false, reason: SPAM_BLOCK_REASONS.duplicate };
      }

      pruneBurstTimestamps(actor, nowMs, config.burstWindowMs);
      if (actor.timestamps.length >= config.burstMaxMessages) {
        commitRejectedAttempt(actor, normalized, nowMs, config);
        trimActorRecords(actor, actorRecordLimits);
        state.set(normalizedActorKey, actor);
        pruneActorStates(state, nowMs, config.maxActors, retentionMs);
        return { allowed: false, reason: SPAM_BLOCK_REASONS.burst };
      }

      // State updates happen only after all blocking checks pass, so rejected
      // messages do not extend duplicate windows or burst counters.
      actor.timestamps.push(nowMs);
      actor.lastMessageAt = nowMs;
      actor.lastNormalizedText = normalized;
      actor.lastTextAt = nowMs;
      recordRecentNormalizedText(actor, normalized, nowMs);
      trimActorRecords(actor, actorRecordLimits);
      state.set(normalizedActorKey, actor);
      pruneActorStates(state, nowMs, config.maxActors, retentionMs);

      return { allowed: true };
    },
    reset() {
      state.clear();
    },
  };
}

function stateScopeForConfig(config: SpamFilterConfig): string {
  return JSON.stringify([
    config.minIntervalMs,
    config.duplicateWindowMs,
    config.burstWindowMs,
    config.burstMaxMessages,
    config.maxActors,
    config.actorKeyPolicy,
    config.clockPolicy,
    config.trackRejectedAttempts,
  ]);
}

function resolveNowMs(
  nowMs: number | undefined,
  clockPolicy: SpamFilterConfig["clockPolicy"],
): number {
  if (clockPolicy === "input_or_system" && Number.isFinite(nowMs)) {
    return Number(nowMs);
  }

  return Date.now();
}

function commitRejectedAttempt(
  actor: ActorState,
  normalized: string,
  nowMs: number,
  config: SpamFilterConfig,
): void {
  if (!config.trackRejectedAttempts) return;

  const commitAt = Math.max(nowMs, actor.lastMessageAt, actor.lastTextAt);
  pruneDuplicateTexts(actor, commitAt, config.duplicateWindowMs);
  pruneBurstTimestamps(actor, commitAt, config.burstWindowMs);

  actor.timestamps.push(commitAt);
  actor.lastMessageAt = commitAt;
  actor.lastNormalizedText = normalized;
  actor.lastTextAt = commitAt;
  recordRecentNormalizedText(actor, normalized, commitAt);
}

export function spamFilter(
  rawConfig: Partial<SpamFilterConfig> = {},
): SpamFilter {
  return createSpamFilter(rawConfig);
}
