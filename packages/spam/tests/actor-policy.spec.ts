import { describe, expect, it } from "vitest";

import {
  createInMemorySpamStateStore,
  createSpamFilter,
  SPAM_BLOCK_REASONS,
} from "../src/index.js";
import {
  createCloningSpamStateStore,
  expectDecisions,
  onlyActorState,
} from "./helpers.js";

describe("spam actor and rejection policies", () => {
  it("normalizes actor key and strips zero-width characters from text", () => {
    expect(
      expectDecisions({ minIntervalMs: 0, duplicateWindowMs: 10_000 }, [
        { actorKey: " User_1 ", text: "he\u200Bllo", nowMs: 1_000 },
        { actorKey: "user_1", text: "hello", nowMs: 2_000 },
      ]),
    ).toEqual([
      { allowed: true },
      { allowed: false, reason: SPAM_BLOCK_REASONS.duplicate },
    ]);
  });

  it("keeps missing actor keys in the shared unknown bucket by default", () => {
    expect(
      expectDecisions({ minIntervalMs: 0, duplicateWindowMs: 10_000 }, [
        { text: "same", nowMs: 1_000 },
        { actorKey: "   ", text: " same ", nowMs: 2_000 },
      ]),
    ).toEqual([
      { allowed: true },
      { allowed: false, reason: SPAM_BLOCK_REASONS.duplicate },
    ]);
  });

  it("can reject missing actor keys explicitly", () => {
    const filter = createSpamFilter({
      actorKeyPolicy: "reject_missing",
      minIntervalMs: 0,
    });

    expect(filter.check({ text: "hello", nowMs: 1_000 })).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.missingActor,
    });
    expect(
      filter.check({ actorKey: "   ", text: "hello", nowMs: 1_000 }),
    ).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.missingActor,
    });
    expect(
      filter.check({ actorKey: "u1", text: "hello", nowMs: 1_000 }),
    ).toEqual({
      allowed: true,
    });
  });

  it("keeps rejected attempts from updating state by default", () => {
    expect(
      expectDecisions({ minIntervalMs: 700 }, [
        { actorKey: "u1", text: "one", nowMs: 1_000 },
        { actorKey: "u1", text: "two", nowMs: 1_600 },
        { actorKey: "u1", text: "three", nowMs: 1_701 },
      ]),
    ).toEqual([
      { allowed: true },
      { allowed: false, reason: SPAM_BLOCK_REASONS.tooFast },
      { allowed: true },
    ]);
  });

  it("can track rejected attempts to keep pressure on repeated failures", () => {
    expect(
      expectDecisions({ minIntervalMs: 700, trackRejectedAttempts: true }, [
        { actorKey: "u1", text: "one", nowMs: 1_000 },
        { actorKey: "u1", text: "two", nowMs: 1_600 },
        { actorKey: "u1", text: "three", nowMs: 1_701 },
        { actorKey: "u1", text: "four", nowMs: 2_301 },
      ]),
    ).toEqual([
      { allowed: true },
      { allowed: false, reason: SPAM_BLOCK_REASONS.tooFast },
      { allowed: false, reason: SPAM_BLOCK_REASONS.tooFast },
      { allowed: false, reason: SPAM_BLOCK_REASONS.tooFast },
    ]);
  });

  it("tracks rejected attempts in a supplied store", () => {
    const stateStore = createInMemorySpamStateStore();
    const filter = createSpamFilter({
      minIntervalMs: 700,
      trackRejectedAttempts: true,
      stateStore,
    });

    expect(filter.check({ actorKey: "u1", text: "one", nowMs: 1_000 })).toEqual(
      { allowed: true },
    );
    expect(filter.check({ actorKey: "u1", text: "two", nowMs: 1_600 })).toEqual(
      {
        allowed: false,
        reason: SPAM_BLOCK_REASONS.tooFast,
      },
    );

    expect(stateStore.size).toBe(1);
    expect(
      filter.check({ actorKey: "u1", text: "three", nowMs: 2_201 }),
    ).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.tooFast,
    });
  });

  it("bounds tracked rejected burst records per actor", () => {
    const stateStore = createInMemorySpamStateStore();
    const filter = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 10_000,
      burstWindowMs: 10_000,
      burstMaxMessages: 3,
      trackRejectedAttempts: true,
      stateStore,
    });

    for (let index = 0; index < 20; index++) {
      filter.check({
        actorKey: "u1",
        text: `message ${index}`,
        nowMs: 1_000 + index,
      });
    }

    const actor = onlyActorState(stateStore);

    expect(actor.timestamps).toHaveLength(3);
    expect(actor.timestamps).toEqual([1_017, 1_018, 1_019]);
  });

  it("bounds recent duplicate text records per actor", () => {
    const stateStore = createInMemorySpamStateStore();
    const filter = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 60_000,
      burstWindowMs: 60_000,
      burstMaxMessages: 1_000,
      stateStore,
    });

    for (let index = 0; index < 300; index++) {
      expect(
        filter.check({
          actorKey: "u1",
          text: `message ${index}`,
          nowMs: 1_000 + index,
        }),
      ).toEqual({ allowed: true });
    }

    const actor = onlyActorState(stateStore);

    expect(actor.recentNormalizedTexts.size).toBe(256);
    expect(actor.recentNormalizedTexts.has("message 0")).toBe(false);
    expect(actor.recentNormalizedTexts.get("message 299")).toBe(1_299);
  });

  it("persists tracked rejected attempts back to cloning stores", () => {
    const stateStore = createCloningSpamStateStore();
    const filter = createSpamFilter({
      minIntervalMs: 700,
      trackRejectedAttempts: true,
      stateStore,
    });

    expect(filter.check({ actorKey: "u1", text: "one", nowMs: 1_000 })).toEqual(
      { allowed: true },
    );
    expect(filter.check({ actorKey: "u1", text: "two", nowMs: 1_600 })).toEqual(
      {
        allowed: false,
        reason: SPAM_BLOCK_REASONS.tooFast,
      },
    );
    expect(
      filter.check({ actorKey: "u1", text: "three", nowMs: 2_201 }),
    ).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.tooFast,
    });
  });

  it("does not let tracked rejected attempts rewind actor time", () => {
    expect(
      expectDecisions({ minIntervalMs: 700, trackRejectedAttempts: true }, [
        { actorKey: "u1", text: "one", nowMs: 1_000 },
        { actorKey: "u1", text: "back", nowMs: 500 },
        { actorKey: "u1", text: "next", nowMs: 1_200 },
      ]),
    ).toEqual([
      { allowed: true },
      { allowed: false, reason: SPAM_BLOCK_REASONS.tooFast },
      { allowed: false, reason: SPAM_BLOCK_REASONS.tooFast },
    ]);
  });

  it("can extend duplicate windows after rejected duplicates", () => {
    expect(
      expectDecisions(
        {
          minIntervalMs: 0,
          duplicateWindowMs: 1_000,
          trackRejectedAttempts: true,
        },
        [
          { actorKey: "u1", text: "same", nowMs: 1_000 },
          { actorKey: "u1", text: "same", nowMs: 1_500 },
          { actorKey: "u1", text: "same", nowMs: 2_001 },
          { actorKey: "u1", text: "same", nowMs: 2_501 },
          { actorKey: "u1", text: "same", nowMs: 3_502 },
        ],
      ),
    ).toEqual([
      { allowed: true },
      { allowed: false, reason: SPAM_BLOCK_REASONS.duplicate },
      { allowed: false, reason: SPAM_BLOCK_REASONS.duplicate },
      { allowed: false, reason: SPAM_BLOCK_REASONS.duplicate },
      { allowed: true },
    ]);
  });

  it("falls back to safe defaults for invalid config values", () => {
    expect(
      expectDecisions(
        {
          minIntervalMs: -1,
          duplicateWindowMs: 0,
          burstWindowMs: Number.NaN,
          burstMaxMessages: -5,
          maxActors: 0,
        },
        [
          { actorKey: "u1", text: "one", nowMs: 1_000 },
          { actorKey: "u1", text: "two", nowMs: 1_600 },
        ],
      ),
    ).toEqual([
      { allowed: true },
      { allowed: false, reason: SPAM_BLOCK_REASONS.tooFast },
    ]);

    expect(
      expectDecisions(
        {
          minIntervalMs: null as unknown as number,
        },
        [
          { actorKey: "u1", text: "one", nowMs: 1_000 },
          { actorKey: "u1", text: "two", nowMs: 1_600 },
        ],
      ),
    ).toEqual([
      { allowed: true },
      { allowed: false, reason: SPAM_BLOCK_REASONS.tooFast },
    ]);
  });

  it("runs deterministic sequences with explicit nowMs", () => {
    expect(
      expectDecisions(
        { minIntervalMs: 200, duplicateWindowMs: 1_000, burstMaxMessages: 2 },
        [
          { actorKey: "a", text: "one", nowMs: 10 },
          { actorKey: "b", text: "one", nowMs: 20 },
          { actorKey: "a", text: "two", nowMs: 209 },
          { actorKey: "a", text: "two", nowMs: 410 },
          { actorKey: "a", text: "three", nowMs: 620 },
        ],
      ),
    ).toEqual([
      { allowed: true },
      { allowed: true },
      { allowed: false, reason: SPAM_BLOCK_REASONS.tooFast },
      { allowed: true },
      { allowed: false, reason: SPAM_BLOCK_REASONS.burst },
    ]);
  });
});
