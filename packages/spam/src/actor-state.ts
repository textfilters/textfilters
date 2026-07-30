import type { ActorState, SpamStateStore } from "./contracts.js";

export const createActorState = (): ActorState => ({
  timestamps: [],
  lastMessageAt: Number.NEGATIVE_INFINITY,
  lastNormalizedText: "",
  lastTextAt: Number.NEGATIVE_INFINITY,
  recentNormalizedTexts: new Map(),
});

export const createInMemorySpamStateStore = (): SpamStateStore => {
  const actors = new Map<string, ActorState>();

  return {
    get size() {
      return actors.size;
    },
    get(actorKey) {
      return actors.get(actorKey);
    },
    set(actorKey, state) {
      actors.set(actorKey, state);
    },
    delete(actorKey) {
      return actors.delete(actorKey);
    },
    clear() {
      actors.clear();
    },
    entries() {
      return actors.entries();
    },
  };
};

export const createScopedSpamStateStore = (
  store: SpamStateStore,
  scope: string,
): SpamStateStore => {
  const prefix = `${scope.length}:${scope}:`;

  return {
    get size() {
      let size = 0;

      for (const [key] of store.entries()) {
        if (key.startsWith(prefix)) {
          size++;
        }
      }

      return size;
    },
    get(actorKey) {
      return store.get(`${prefix}${actorKey}`);
    },
    set(actorKey, state) {
      store.set(`${prefix}${actorKey}`, state);
    },
    delete(actorKey) {
      return store.delete(`${prefix}${actorKey}`);
    },
    clear() {
      for (const [key] of store.entries()) {
        if (key.startsWith(prefix)) {
          store.delete(key);
        }
      }
    },
    *entries() {
      for (const [key, state] of store.entries()) {
        if (key.startsWith(prefix)) {
          yield [key.slice(prefix.length), state];
        }
      }
    },
  };
};

export const pruneDuplicateTexts = (
  actor: ActorState,
  nowMs: number,
  duplicateWindowMs: number,
): void => {
  for (const [text, seenAt] of actor.recentNormalizedTexts) {
    if (nowMs - seenAt >= duplicateWindowMs) {
      actor.recentNormalizedTexts.delete(text);
    }
  }
};

export const pruneBurstTimestamps = (
  actor: ActorState,
  nowMs: number,
  burstWindowMs: number,
): void => {
  const timestamps = actor.timestamps;
  let writeIndex = 0;

  for (const timestamp of timestamps) {
    if (nowMs - timestamp < burstWindowMs) {
      timestamps[writeIndex] = timestamp;
      writeIndex++;
    }
  }

  timestamps.length = writeIndex;
};

export interface ActorRecordLimits {
  readonly maxTimestamps: number;
  readonly maxRecentTexts: number;
}

export const trimActorRecords = (
  actor: ActorState,
  limits: ActorRecordLimits,
): void => {
  if (actor.timestamps.length > limits.maxTimestamps) {
    actor.timestamps.sort((left, right) => left - right);
    actor.timestamps.splice(0, actor.timestamps.length - limits.maxTimestamps);
  }

  if (actor.recentNormalizedTexts.size > limits.maxRecentTexts) {
    const removeCount =
      actor.recentNormalizedTexts.size - limits.maxRecentTexts;
    const oldestTexts = Array.from(
      actor.recentNormalizedTexts,
      ([text, seenAt]) => ({ seenAt, text }),
    )
      .sort((left, right) => left.seenAt - right.seenAt)
      .slice(0, removeCount);

    for (const { text } of oldestTexts) {
      actor.recentNormalizedTexts.delete(text);
    }
  }
};

export const recordRecentNormalizedText = (
  actor: ActorState,
  normalized: string,
  seenAt: number,
): void => {
  actor.recentNormalizedTexts.delete(normalized);
  actor.recentNormalizedTexts.set(normalized, seenAt);
};

export const pruneActorStates = (
  state: SpamStateStore,
  nowMs: number,
  maxActors: number,
  retentionMs: number,
): void => {
  if (state.size <= maxActors) return;

  for (const [key, actor] of state.entries()) {
    if (nowMs - actor.lastMessageAt > retentionMs) {
      state.delete(key);
    }
    if (state.size <= maxActors) return;
  }

  const evictCount = state.size - maxActors;
  if (evictCount === 1) {
    let oldestKey: string | undefined;
    let oldestAt = Number.POSITIVE_INFINITY;

    for (const [key, actor] of state.entries()) {
      if (actor.lastMessageAt < oldestAt) {
        oldestAt = actor.lastMessageAt;
        oldestKey = key;
      }
    }

    if (oldestKey !== undefined) {
      state.delete(oldestKey);
    }
    return;
  }

  const oldest = Array.from(state.entries(), ([key, actor]) => ({
    key,
    lastMessageAt: actor.lastMessageAt,
  }))
    .sort((left, right) => left.lastMessageAt - right.lastMessageAt)
    .slice(0, evictCount);

  for (const { key } of oldest) {
    state.delete(key);
  }
};
