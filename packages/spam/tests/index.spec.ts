import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { createModerationPipeline, type TextGuard } from "@textfilters/core";
import {
  createSpamGuard,
  SPAM_BLOCK_REASONS,
  type SpamBlockReason,
  type SpamDecision,
  type SpamGuard,
  type SpamGuardOptions,
} from "../src/index.js";

const input = (actorKey: string, text: string, nowMs: number) => ({
  actorKey,
  text,
  nowMs,
});

describe("@textfilters/spam", () => {
  it("exports the final guard contract", () => {
    const guard: SpamGuard = createSpamGuard();
    const options: SpamGuardOptions = { minIntervalMs: 0 };
    const reason: SpamBlockReason = SPAM_BLOCK_REASONS.duplicate;
    const decision: SpamDecision = { allowed: false, reason };

    expectTypeOf(guard).toMatchTypeOf<TextGuard>();
    expect(options).toEqual({ minIntervalMs: 0 });
    expect(decision).toEqual({ allowed: false, reason: "duplicate" });
    expect(SPAM_BLOCK_REASONS).toEqual({
      empty: "empty",
      tooFast: "too_fast",
      duplicate: "duplicate",
      burst: "burst",
    });
    expect(guard.name).toBe("spam");
    expect(Object.isFrozen(guard)).toBe(true);
  });

  it("rejects empty normalized text without creating actor state", () => {
    const guard = createSpamGuard({ minIntervalMs: 1_000 });

    expect(guard.check(input("u1", " \u200B \t", 1_000))).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.empty,
    });
    expect(guard.check(input("u1", "hello", 1_001))).toEqual({
      allowed: true,
    });
  });

  it("enforces the minimum interval at an exact boundary", () => {
    const guard = createSpamGuard({ minIntervalMs: 700 });

    expect(guard.check(input("u1", "one", 0))).toEqual({ allowed: true });
    expect(guard.check(input("u1", "two", 699))).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.tooFast,
    });
    expect(guard.check(input("u1", "two", 700))).toEqual({ allowed: true });
  });

  it("detects normalized duplicates until the window expires", () => {
    const guard = createSpamGuard({
      minIntervalMs: 0,
      duplicateWindowMs: 1_000,
    });

    expect(guard.check(input("u1", "Ｈello\u200B   WORLD", 0))).toEqual({
      allowed: true,
    });
    expect(guard.check(input("u1", " hello world ", 999))).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.duplicate,
    });
    expect(guard.check(input("u1", "hello world", 1_000))).toEqual({
      allowed: true,
    });
  });

  it("blocks bursts without counting rejected attempts", () => {
    const guard = createSpamGuard({
      minIntervalMs: 0,
      duplicateWindowMs: 10_000,
      burstWindowMs: 1_000,
      burstMaxMessages: 2,
    });

    expect(guard.check(input("u1", "one", 0))).toEqual({ allowed: true });
    expect(guard.check(input("u1", "one", 100))).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.duplicate,
    });
    expect(guard.check(input("u1", "two", 200))).toEqual({ allowed: true });
    expect(guard.check(input("u1", "three", 300))).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.burst,
    });
    expect(guard.check(input("u1", "three", 1_000))).toEqual({
      allowed: true,
    });
  });

  it("keeps actors and guard instances isolated", () => {
    const options = { minIntervalMs: 0, duplicateWindowMs: 10_000 };
    const first = createSpamGuard(options);
    const second = createSpamGuard(options);

    expect(first.check(input(" User ", "same", 0))).toEqual({ allowed: true });
    expect(first.check(input("user", "same", 1))).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.duplicate,
    });
    expect(first.check(input("other", "same", 1))).toEqual({ allowed: true });
    expect(second.check(input("user", "same", 1))).toEqual({ allowed: true });
  });

  it("does not commit interval-rejected text", () => {
    const guard = createSpamGuard({
      minIntervalMs: 100,
      duplicateWindowMs: 1_000,
    });

    expect(guard.check(input("u1", "one", 0))).toEqual({ allowed: true });
    expect(guard.check(input("u1", "two", 50))).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.tooFast,
    });
    expect(guard.check(input("u1", "two", 100))).toEqual({ allowed: true });
  });

  it("uses Date.now only when nowMs is absent", () => {
    const now = vi.spyOn(Date, "now");
    const guard = createSpamGuard({ minIntervalMs: 100 });

    try {
      now.mockReturnValueOnce(1_000).mockReturnValueOnce(1_050);
      expect(guard.check({ actorKey: "u1", text: "one" })).toEqual({
        allowed: true,
      });
      expect(guard.check({ actorKey: "u1", text: "two" })).toEqual({
        allowed: false,
        reason: SPAM_BLOCK_REASONS.tooFast,
      });
      expect(now).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });

  it("rejects invalid moderation input and explicit clocks", () => {
    const guard = createSpamGuard();
    const unsafe = guard as unknown as {
      check(value: unknown): SpamDecision;
    };

    expect(() => unsafe.check(null)).toThrow("input must be an object");
    expect(() => unsafe.check({ text: "hello" })).toThrow(
      "actorKey must be a non-empty string",
    );
    expect(() => unsafe.check({ actorKey: " ", text: "hello" })).toThrow(
      "actorKey must be a non-empty string",
    );
    expect(() => unsafe.check({ actorKey: "u1", text: null })).toThrow(
      "text must be a string",
    );
    expect(() =>
      unsafe.check({ actorKey: "u1", text: "hello", nowMs: Number.NaN }),
    ).toThrow("nowMs must be a finite number");
  });

  it("resets all private actor state", () => {
    const guard = createSpamGuard({ minIntervalMs: 0 });

    expect(guard.check(input("u1", "same", 0))).toEqual({ allowed: true });
    expect(guard.check(input("u1", "same", 1))).toEqual({
      allowed: false,
      reason: SPAM_BLOCK_REASONS.duplicate,
    });
    guard.reset();
    expect(guard.check(input("u1", "same", 1))).toEqual({ allowed: true });
  });

  it("prunes the oldest actors after maxActors is exceeded", () => {
    const guard = createSpamGuard({
      minIntervalMs: 0,
      duplicateWindowMs: 10_000,
      burstWindowMs: 10_000,
      burstMaxMessages: 10,
      maxActors: 2,
    });

    expect(guard.check(input("a", "same", 0))).toEqual({ allowed: true });
    expect(guard.check(input("b", "same", 1))).toEqual({ allowed: true });
    expect(guard.check(input("c", "same", 2))).toEqual({ allowed: true });
    expect(guard.check(input("a", "same", 3))).toEqual({ allowed: true });
  });

  it("bounds remembered duplicate texts per actor", () => {
    const guard = createSpamGuard({
      minIntervalMs: 0,
      duplicateWindowMs: 1_000_000,
      burstWindowMs: 1,
      burstMaxMessages: 1,
    });

    for (let index = 0; index < 257; index += 1) {
      expect(guard.check(input("u1", `message-${index}`, index * 2))).toEqual({
        allowed: true,
      });
    }
    expect(guard.check(input("u1", "message-0", 1_000))).toEqual({
      allowed: true,
    });
  });

  it("short-circuits moderation before filters and returns guard identity", () => {
    let processed = 0;
    const guard = createSpamGuard({ minIntervalMs: 0 });
    const pipeline = createModerationPipeline({
      guards: [guard],
      filters: [
        {
          name: "marker",
          check: () => true,
          find: () => {
            processed += 1;
            return [{ start: 0, end: 4, value: "same", filter: "marker" }];
          },
          censor: () => "****",
          process: () => ({
            censored: "****",
            matches: [{ start: 0, end: 4, value: "same", filter: "marker" }],
          }),
        },
      ],
    });

    expect(pipeline.process(input("u1", "same", 0))).toEqual({
      allowed: true,
      text: "****",
      matches: [{ start: 0, end: 4, value: "same", filter: "marker" }],
    });
    expect(pipeline.process(input("u1", "same", 1))).toEqual({
      allowed: false,
      guard: "spam",
      reason: SPAM_BLOCK_REASONS.duplicate,
    });
    expect(processed).toBe(1);
  });
});
