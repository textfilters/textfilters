import { describe, expect, it, vi } from "vitest";

import {
  createInMemorySpamStateStore,
  createSpamFilter,
  SPAM_BLOCK_REASONS,
} from "../src/index.js";
import { createCloningSpamStateStore, expectDecisions } from "./helpers.js";

describe("spam state stores", () => {
  it("keeps default in-memory stores isolated by filter instance", () => {
    const first = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 10_000,
    });
    const second = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 10_000,
    });

    expect(first.check({ actorKey: "u1", text: "same", nowMs: 1_000 })).toEqual(
      { allowed: true },
    );
    expect(first.check({ actorKey: "u1", text: "same", nowMs: 2_000 })).toEqual(
      {
        allowed: false,
        reason: SPAM_BLOCK_REASONS.duplicate,
      },
    );
    expect(
      second.check({ actorKey: "u1", text: "same", nowMs: 2_000 }),
    ).toEqual({ allowed: true });
  });

  it("can share actor state through a supplied store", () => {
    const stateStore = createInMemorySpamStateStore();
    const first = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 10_000,
      stateStore,
    });
    const second = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 10_000,
      stateStore,
    });

    expect(first.check({ actorKey: "u1", text: "same", nowMs: 1_000 })).toEqual(
      { allowed: true },
    );
    expect(
      second.check({ actorKey: "u1", text: "same", nowMs: 2_000 }),
    ).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.duplicate,
    });
  });

  it("persists accepted actor mutations back to cloning stores", () => {
    const stateStore = createCloningSpamStateStore();
    const filter = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 10_000,
      stateStore,
    });

    expect(
      filter.check({ actorKey: "u1", text: "same", nowMs: 1_000 }),
    ).toEqual({ allowed: true });
    expect(
      filter.check({ actorKey: "u1", text: "same", nowMs: 2_000 }),
    ).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.duplicate,
    });
  });

  it("isolates shared store state between different policy windows", () => {
    const stateStore = createInMemorySpamStateStore();
    const longWindow = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 10_000,
      stateStore,
    });
    const shortWindow = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 100,
      stateStore,
    });

    expect(
      longWindow.check({ actorKey: "u1", text: "same", nowMs: 1_000 }),
    ).toEqual({ allowed: true });
    expect(
      shortWindow.check({ actorKey: "u1", text: "same", nowMs: 1_000 }),
    ).toEqual({ allowed: true });
    expect(
      shortWindow.check({ actorKey: "u1", text: "same", nowMs: 2_000 }),
    ).toEqual({ allowed: true });
    expect(
      longWindow.check({ actorKey: "u1", text: "same", nowMs: 2_000 }),
    ).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.duplicate,
    });
  });

  it("isolates shared store state between clock policies", () => {
    const nowSpy = vi.spyOn(Date, "now");
    const stateStore = createInMemorySpamStateStore();
    const inputClock = createSpamFilter({
      minIntervalMs: 700,
      stateStore,
    });
    const systemClock = createSpamFilter({
      clockPolicy: "system",
      minIntervalMs: 700,
      stateStore,
    });

    try {
      nowSpy.mockReturnValue(1_000);

      expect(
        inputClock.check({ actorKey: "u1", text: "future", nowMs: 1_000_000 }),
      ).toEqual({ allowed: true });
      expect(systemClock.check({ actorKey: "u1", text: "now" })).toEqual({
        allowed: true,
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("supports reset()", () => {
    const filter = createSpamFilter({ minIntervalMs: 10_000 });

    expect(filter.check({ actorKey: "u1", text: "one", nowMs: 1_000 })).toEqual(
      {
        allowed: true,
      },
    );
    expect(filter.check({ actorKey: "u1", text: "two", nowMs: 1_100 })).toEqual(
      {
        allowed: false,
        reason: SPAM_BLOCK_REASONS.tooFast,
      },
    );

    filter.reset();

    const afterReset = { actorKey: "u1", text: "two", nowMs: 1_100 };
    expect(filter.check(afterReset)).toEqual({ allowed: true });
  });

  it("clears a supplied store on reset()", () => {
    const stateStore = createInMemorySpamStateStore();
    const filter = createSpamFilter({ stateStore });

    expect(filter.check({ actorKey: "u1", text: "one", nowMs: 1_000 })).toEqual(
      { allowed: true },
    );
    expect(stateStore.size).toBe(1);

    filter.reset();

    expect(stateStore.size).toBe(0);
  });

  it("evicts old actor states when map grows over limit", () => {
    expect(
      expectDecisions(
        {
          minIntervalMs: 0,
          duplicateWindowMs: 100,
          burstWindowMs: 100,
          maxActors: 2,
        },
        [
          { actorKey: "u1", text: "a", nowMs: 0 },
          { actorKey: "u2", text: "a", nowMs: 0 },
          { actorKey: "u3", text: "a", nowMs: 1_000 },
          { actorKey: "u1", text: "a", nowMs: 1_001 },
        ],
      ),
    ).toEqual([
      { allowed: true },
      { allowed: true },
      { allowed: true },
      { allowed: true },
    ]);
  });

  it("evicts oldest states when map is oversized without stale actors", () => {
    expect(
      expectDecisions(
        {
          minIntervalMs: 1,
          duplicateWindowMs: 1_000,
          burstWindowMs: 1_000,
          maxActors: 2,
        },
        [
          { actorKey: "u1", text: "a", nowMs: 1_000 },
          { actorKey: "u2", text: "a", nowMs: 1_000 },
          { actorKey: "u3", text: "a", nowMs: 1_000 },
          { actorKey: "u1", text: "a", nowMs: 1_001 },
        ],
      ),
    ).toEqual([
      { allowed: true },
      { allowed: true },
      { allowed: true },
      { allowed: true },
    ]);
  });

  it("prunes supplied store actor state after accepted messages", () => {
    const stateStore = createInMemorySpamStateStore();
    const filter = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 100,
      burstWindowMs: 100,
      maxActors: 2,
      stateStore,
    });

    expect(filter.check({ actorKey: "u1", text: "a", nowMs: 0 })).toEqual({
      allowed: true,
    });
    expect(filter.check({ actorKey: "u2", text: "a", nowMs: 0 })).toEqual({
      allowed: true,
    });
    expect(filter.check({ actorKey: "u3", text: "a", nowMs: 1_000 })).toEqual({
      allowed: true,
    });

    expect(stateStore.size).toBe(2);
    expect(filter.check({ actorKey: "u1", text: "a", nowMs: 1_001 })).toEqual({
      allowed: true,
    });
  });

  it("preserves burst state across duplicate rejections with out-of-order clocks", () => {
    const filter = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 2_000,
      burstWindowMs: 1_000,
      burstMaxMessages: 2,
    });

    expect(filter.check({ actorKey: "u1", text: "same", nowMs: 0 })).toEqual({
      allowed: true,
    });
    expect(filter.check({ actorKey: "u1", text: "other", nowMs: 100 })).toEqual(
      { allowed: true },
    );
    expect(
      filter.check({ actorKey: "u1", text: "same", nowMs: 1_500 }),
    ).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.duplicate,
    });
    expect(filter.check({ actorKey: "u1", text: "late", nowMs: 500 })).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.burst,
    });
  });

  it("evicts oldest actors from a supplied store when none are stale", () => {
    const stateStore = createInMemorySpamStateStore();
    const filter = createSpamFilter({
      minIntervalMs: 1,
      duplicateWindowMs: 1_000,
      burstWindowMs: 1_000,
      maxActors: 2,
      stateStore,
    });

    expect(filter.check({ actorKey: "u1", text: "a", nowMs: 1_000 })).toEqual({
      allowed: true,
    });
    expect(filter.check({ actorKey: "u2", text: "a", nowMs: 1_000 })).toEqual({
      allowed: true,
    });
    expect(filter.check({ actorKey: "u3", text: "a", nowMs: 1_000 })).toEqual({
      allowed: true,
    });

    expect(stateStore.size).toBe(2);
    expect(filter.check({ actorKey: "u1", text: "a", nowMs: 1_001 })).toEqual({
      allowed: true,
    });
  });
});
