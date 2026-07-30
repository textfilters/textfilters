import { describe, expect, it } from "vitest";

import { createSpamFilter, SPAM_BLOCK_REASONS } from "../src/index.js";

describe("@textfilters/spam curated regressions", () => {
  it("does not let rejected empty messages create actor state", () => {
    const filter = createSpamFilter({ minIntervalMs: 1_000 });

    expect(filter.check({ actorKey: "u1", text: "   ", nowMs: 1_000 })).toEqual(
      {
        allowed: false,
        reason: SPAM_BLOCK_REASONS.empty,
      },
    );
    expect(
      filter.check({ actorKey: "u1", text: "hello", nowMs: 1_001 }),
    ).toEqual({
      allowed: true,
    });
  });

  it("does not extend duplicate windows after rejected duplicates", () => {
    const filter = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 1_000,
    });

    expect(
      filter.check({ actorKey: "u1", text: "same", nowMs: 1_000 }),
    ).toEqual({
      allowed: true,
    });
    expect(
      filter.check({ actorKey: "u1", text: "same", nowMs: 1_500 }),
    ).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.duplicate,
    });
    expect(
      filter.check({ actorKey: "u1", text: "same", nowMs: 2_001 }),
    ).toEqual({
      allowed: true,
    });
  });

  it("uses a stable bucket for missing actor keys", () => {
    const filter = createSpamFilter({
      minIntervalMs: 0,
      duplicateWindowMs: 10_000,
    });

    expect(filter.check({ text: "same", nowMs: 1_000 })).toEqual({
      allowed: true,
    });
    expect(filter.check({ text: " same ", nowMs: 2_000 })).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.duplicate,
    });
  });
});
