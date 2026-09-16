import { describe, expect, it } from "vitest";
import { createActorState, pruneActorStates } from "../src/actor-state.js";

describe("bounded actor eviction", () => {
  it.each([
    [100, 100, 100, 100],
    [100, 50, 75, 25],
    [-10, 0, -5, 0],
    [0, 1, 100, 101],
  ])("preserves stable oldest selection for timestamps %j", (...times) => {
    const actors = new Map(
      times.map((lastMessageAt, index) => [
        String(index),
        { ...createActorState(), lastMessageAt },
      ]),
    );
    const expected = [...actors]
      .sort((a, b) => a[1].lastMessageAt - b[1].lastMessageAt)
      .slice(2)
      .map(([key]) => key)
      .sort();
    pruneActorStates(actors, 0, 2, 1_000);
    expect([...actors.keys()].sort()).toEqual(expected);
  });

  it("removes expired records before selecting the oldest and stays bounded under churn", () => {
    const actors = new Map();
    for (let index = 0; index < 2_000; index++) {
      const lastMessageAt = index % 3 === 0 ? -index : index;
      actors.set(String(index), { ...createActorState(), lastMessageAt });
      pruneActorStates(actors, index, 3, 10);
      expect(actors.size).toBeLessThanOrEqual(3);
    }
    expect([...actors.keys()]).toEqual(["1996", "1997", "1999"]);
  });
});
