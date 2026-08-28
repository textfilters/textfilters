import { describe, expect, it } from "vitest";

import {
  cloneActorState,
  createActorState,
  pruneActorStates,
  pruneBurstTimestamps,
  pruneDuplicateTexts,
  recordRecentNormalizedText,
  trimActorRecords,
} from "../src/actor-state.js";

describe("spam actor state", () => {
  it("clones mutable records before guard evaluation", () => {
    const actor = createActorState();
    actor.timestamps.push(1);
    actor.lastMessageAt = 1;
    actor.recentNormalizedTexts.set("one", 1);

    const clone = cloneActorState(actor);
    clone.timestamps.push(2);
    clone.recentNormalizedTexts.set("two", 2);

    expect(actor.timestamps).toEqual([1]);
    expect([...actor.recentNormalizedTexts]).toEqual([["one", 1]]);
  });

  it("prunes expired burst and duplicate records", () => {
    const actor = createActorState();
    actor.timestamps.push(0, 5, 10);
    actor.recentNormalizedTexts.set("old", 0);
    actor.recentNormalizedTexts.set("new", 10);

    pruneBurstTimestamps(actor, 10, 6);
    pruneDuplicateTexts(actor, 10, 6);

    expect(actor.timestamps).toEqual([5, 10]);
    expect([...actor.recentNormalizedTexts]).toEqual([["new", 10]]);
  });

  it("retains only the newest bounded records", () => {
    const actor = createActorState();
    actor.timestamps.push(3, 1, 2);
    recordRecentNormalizedText(actor, "old", 1);
    recordRecentNormalizedText(actor, "middle", 2);
    recordRecentNormalizedText(actor, "new", 3);

    trimActorRecords(actor, 2, 2);

    expect(actor.timestamps).toEqual([2, 3]);
    expect([...actor.recentNormalizedTexts]).toEqual([
      ["middle", 2],
      ["new", 3],
    ]);
  });

  it("prunes expired actors before the oldest active actors", () => {
    const actors = new Map([
      ["expired", { ...createActorState(), lastMessageAt: 0 }],
      ["older", { ...createActorState(), lastMessageAt: 90 }],
      ["newer", { ...createActorState(), lastMessageAt: 100 }],
    ]);

    pruneActorStates(actors, 100, 2, 20);
    expect([...actors.keys()]).toEqual(["older", "newer"]);

    actors.set("newest", { ...createActorState(), lastMessageAt: 110 });
    pruneActorStates(actors, 110, 2, 1_000);
    expect([...actors.keys()]).toEqual(["newer", "newest"]);
  });
});
