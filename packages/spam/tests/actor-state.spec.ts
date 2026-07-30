import { describe, expect, it } from "vitest";

import {
  createActorState,
  pruneActorStates,
  pruneBurstTimestamps,
  pruneDuplicateTexts,
  recordRecentNormalizedText,
  trimActorRecords,
} from "../src/actor-state.js";
import type { ActorState } from "../src/index.js";

const actorState = (lastMessageAt: number): ActorState => ({
  ...createActorState(),
  lastMessageAt,
});

describe("actor state pruning", () => {
  it("prunes duplicate texts in place", () => {
    const actor = createActorState();
    actor.recentNormalizedTexts.set("old", 1_000);
    actor.recentNormalizedTexts.set("new", 1_950);

    pruneDuplicateTexts(actor, 2_000, 500);

    expect([...actor.recentNormalizedTexts]).toEqual([["new", 1_950]]);
  });

  it("compacts burst timestamps without replacing the array", () => {
    const actor = createActorState();
    actor.timestamps.push(1_000, 1_500, 1_900);
    const timestamps = actor.timestamps;

    pruneBurstTimestamps(actor, 2_000, 600);

    expect(actor.timestamps).toBe(timestamps);
    expect(actor.timestamps).toEqual([1_500, 1_900]);
  });

  it("prunes expired burst timestamps after retained non-monotonic entries", () => {
    const actor = createActorState();
    actor.timestamps.push(1_000, 500, 1_250);

    pruneBurstTimestamps(actor, 1_501, 1_000);

    expect(actor.timestamps).toEqual([1_000, 1_250]);
  });

  it("trims per-actor records without replacing containers", () => {
    const actor = createActorState();
    actor.timestamps.push(1_000, 1_100, 1_200, 1_300);
    actor.recentNormalizedTexts.set("oldest", 1_000);
    actor.recentNormalizedTexts.set("older", 1_100);
    actor.recentNormalizedTexts.set("newer", 1_200);
    actor.recentNormalizedTexts.set("newest", 1_300);
    const timestamps = actor.timestamps;
    const recentTexts = actor.recentNormalizedTexts;

    trimActorRecords(actor, { maxTimestamps: 2, maxRecentTexts: 2 });

    expect(actor.timestamps).toBe(timestamps);
    expect(actor.timestamps).toEqual([1_200, 1_300]);
    expect(actor.recentNormalizedTexts).toBe(recentTexts);
    expect([...actor.recentNormalizedTexts]).toEqual([
      ["newer", 1_200],
      ["newest", 1_300],
    ]);
  });

  it("keeps newest timestamp values when trimming non-monotonic records", () => {
    const actor = createActorState();
    actor.timestamps.push(1_000, 500, 1_250, 1_300);

    trimActorRecords(actor, { maxTimestamps: 3, maxRecentTexts: 10 });

    expect(actor.timestamps).toEqual([1_000, 1_250, 1_300]);
  });

  it("refreshes duplicate text recency before trimming", () => {
    const actor = createActorState();
    actor.recentNormalizedTexts.set("old", 1_000);
    actor.recentNormalizedTexts.set("middle", 1_100);
    actor.recentNormalizedTexts.set("new", 1_200);

    recordRecentNormalizedText(actor, "old", 1_300);
    trimActorRecords(actor, { maxTimestamps: 10, maxRecentTexts: 2 });

    expect([...actor.recentNormalizedTexts]).toEqual([
      ["new", 1_200],
      ["old", 1_300],
    ]);
  });

  it("keeps newest duplicate text timestamps when trimming non-monotonic records", () => {
    const actor = createActorState();
    actor.recentNormalizedTexts.set("future", 10_000);
    actor.recentNormalizedTexts.set("past-0", 0);
    actor.recentNormalizedTexts.set("past-1", 1);
    actor.recentNormalizedTexts.set("past-2", 2);

    trimActorRecords(actor, { maxTimestamps: 10, maxRecentTexts: 3 });

    expect([...actor.recentNormalizedTexts]).toEqual([
      ["future", 10_000],
      ["past-1", 1],
      ["past-2", 2],
    ]);
  });

  it("does not prune actors below maxActors", () => {
    const state = new Map<string, ActorState>([
      ["a", actorState(1_000)],
      ["b", actorState(2_000)],
    ]);

    pruneActorStates(state, 10_000, 3, 100);

    expect([...state.keys()]).toEqual(["a", "b"]);
  });

  it("prunes stale actors before evicting oldest active actors", () => {
    const state = new Map<string, ActorState>([
      ["stale", actorState(1_000)],
      ["old", actorState(9_500)],
      ["new", actorState(9_900)],
    ]);

    pruneActorStates(state, 10_000, 2, 1_000);

    expect([...state.keys()]).toEqual(["old", "new"]);
  });

  it("evicts the oldest actors when no stale actors are available", () => {
    const state = new Map<string, ActorState>([
      ["oldest", actorState(1_000)],
      ["middle", actorState(2_000)],
      ["newest", actorState(3_000)],
    ]);

    pruneActorStates(state, 3_500, 2, 10_000);

    expect([...state.keys()]).toEqual(["middle", "newest"]);
  });

  it("evicts multiple oldest actors from oversized maps in one prune", () => {
    const state = new Map<string, ActorState>([
      ["oldest", actorState(1_000)],
      ["older", actorState(2_000)],
      ["middle", actorState(3_000)],
      ["newer", actorState(4_000)],
      ["newest", actorState(5_000)],
    ]);

    pruneActorStates(state, 5_500, 2, 10_000);

    expect([...state.keys()]).toEqual(["newer", "newest"]);
  });
});
