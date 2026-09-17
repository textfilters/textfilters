import { describe, expect, it, vi } from "vitest";

import { createSpamGuard } from "../src/index.js";
import * as actorState from "../src/actor-state.js";

const options = {
  minIntervalMs: 0,
  burstWindowMs: 1,
  burstMaxMessages: 1000,
  duplicateWindowMs: 10_000,
};
const input = (text: string, nowMs = 0, actorKey = "actor") => ({
  text,
  nowMs,
  actorKey,
});
const duplicate = { allowed: false, reason: "duplicate" };

describe("full normalized spam messages", () => {
  it.each([511, 512, 513, 10_000])(
    "distinguishes equal-length suffixes after %i units",
    (length) => {
      const guard = createSpamGuard(options);
      const prefix = "x".repeat(length);
      for (const suffix of ["a", "b"])
        expect(guard.check(input(prefix + suffix))).toEqual({ allowed: true });
      for (const suffix of ["a", "b"])
        expect(guard.check(input(prefix + suffix))).toEqual(duplicate);
    },
  );

  it("normalizes the whole message once, including around the old boundary", () => {
    for (const length of [510, 511, 512, 513]) {
      const guard = createSpamGuard(options);
      const prefix = "x".repeat(length);
      const first = prefix + "Ｅ\u0301\u200b  😀\nTAIL";
      const equivalent = prefix + "é 😀 tail";
      expect(guard.check(input(first))).toEqual({ allowed: true });
      expect(guard.check(input(equivalent))).toEqual(duplicate);
      expect(guard.check(input(prefix + "é 😁 tail"))).toEqual({
        allowed: true,
      });
    }
  });

  it("preserves exact unpaired surrogate distinctions", () => {
    const guard = createSpamGuard(options);
    for (const suffix of ["\ud800", "\ud801", "\udc00", "\ufffd"]) {
      const text = "x".repeat(512) + suffix;
      expect(guard.check(input(text))).toEqual({ allowed: true });
      expect(guard.check(input(text))).toEqual(duplicate);
    }
  });

  it("does not mistake content after a long whitespace prefix for empty text", () => {
    const guard = createSpamGuard(options);
    expect(guard.check(input(" ".repeat(1_000) + "hello"))).toEqual({
      allowed: true,
    });
    expect(guard.check(input("hello"))).toEqual(duplicate);
  });

  it("preserves duplicate boundaries, rejected attempts, clocks, and reset", () => {
    const guard = createSpamGuard(options);
    const text = "x".repeat(10_000);
    expect(guard.check(input(text, 100))).toEqual({ allowed: true });
    for (const now of [100, 99, 10_099])
      expect(guard.check(input(text, now))).toEqual(duplicate);
    expect(guard.check(input(text, 10_100))).toEqual({ allowed: true });
    guard.reset();
    expect(guard.check(input(text, 0))).toEqual({ allowed: true });
  });

  it("retains bounded records across many long messages and actor churn", () => {
    const record = vi.spyOn(actorState, "recordRecentNormalizedText");
    const prune = vi.spyOn(actorState, "pruneActorStates");
    try {
      const guard = createSpamGuard({ ...options, maxActors: 2 });
      const prefix = "x".repeat(10_000);
      for (let index = 0; index < 300; index++) {
        expect(guard.check(input(prefix + index, index))).toEqual({
          allowed: true,
        });
      }
      const state = record.mock.calls.at(-1)![0];
      expect(state.recentNormalizedTexts.size).toBe(256);
      expect(
        [...state.recentNormalizedTexts.keys()].every(
          (key) => key.length === 71,
        ),
      ).toBe(true);
      expect(guard.check(input(prefix + 0, 300))).toEqual({ allowed: true });
      for (let index = 0; index < 30; index++)
        guard.check(input(prefix, index + 301, `actor-${index}`));
      expect(prune.mock.calls.at(-1)![0].size).toBe(2);
      expect(guard.check(input(prefix + 299, 400))).toEqual({ allowed: true });
    } finally {
      record.mockRestore();
      prune.mockRestore();
    }
  });
});
