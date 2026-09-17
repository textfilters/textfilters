export interface ActorState {
  readonly timestamps: number[];
  lastMessageAt: number;
  // Bounded duplicate keys, never full long messages.
  readonly recentNormalizedTexts: Map<string, number>;
}

export const createActorState = (): ActorState => ({
  timestamps: [],
  lastMessageAt: Number.NEGATIVE_INFINITY,
  recentNormalizedTexts: new Map(),
});

export const cloneActorState = (actor: ActorState): ActorState => ({
  timestamps: [...actor.timestamps],
  lastMessageAt: actor.lastMessageAt,
  recentNormalizedTexts: new Map(actor.recentNormalizedTexts),
});

export function pruneDuplicateTexts(
  actor: ActorState,
  nowMs: number,
  duplicateWindowMs: number,
): void {
  for (const [text, seenAt] of actor.recentNormalizedTexts) {
    if (nowMs - seenAt >= duplicateWindowMs) {
      actor.recentNormalizedTexts.delete(text);
    }
  }
}

export function pruneBurstTimestamps(
  actor: ActorState,
  nowMs: number,
  burstWindowMs: number,
): void {
  let writeIndex = 0;
  for (const timestamp of actor.timestamps) {
    if (nowMs - timestamp < burstWindowMs) {
      actor.timestamps[writeIndex++] = timestamp;
    }
  }
  actor.timestamps.length = writeIndex;
}

export function trimActorRecords(
  actor: ActorState,
  maxTimestamps: number,
  maxRecentTexts: number,
): void {
  if (actor.timestamps.length > maxTimestamps) {
    actor.timestamps.sort((left, right) => left - right);
    actor.timestamps.splice(0, actor.timestamps.length - maxTimestamps);
  }

  if (actor.recentNormalizedTexts.size > maxRecentTexts) {
    const removeCount = actor.recentNormalizedTexts.size - maxRecentTexts;
    const oldest = [...actor.recentNormalizedTexts]
      .sort((left, right) => left[1] - right[1])
      .slice(0, removeCount);
    for (const [text] of oldest) actor.recentNormalizedTexts.delete(text);
  }
}

export function recordRecentNormalizedText(
  actor: ActorState,
  normalized: string,
  seenAt: number,
): void {
  actor.recentNormalizedTexts.delete(normalized);
  actor.recentNormalizedTexts.set(normalized, seenAt);
}

export function pruneActorStates(
  actors: Map<string, ActorState>,
  nowMs: number,
  maxActors: number,
  retentionMs: number,
): void {
  if (actors.size <= maxActors) return;

  for (const [key, actor] of actors) {
    if (nowMs - actor.lastMessageAt > retentionMs) actors.delete(key);
    if (actors.size <= maxActors) return;
  }

  // Normal insertion adds at most one actor. Strict comparison preserves the
  // stable-sort tie break without assuming timestamps follow insertion order.
  while (actors.size > maxActors) {
    let oldestKey: string | undefined;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, actor] of actors) {
      if (oldestKey === undefined || actor.lastMessageAt < oldestAt) {
        oldestKey = key;
        oldestAt = actor.lastMessageAt;
      }
    }
    if (oldestKey === undefined) return;
    actors.delete(oldestKey);
  }
}
