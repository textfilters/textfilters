import { describe, expect, it } from "vitest";

import {
  createModerationPipeline,
  type TextFilter,
  type TextGuard,
} from "@textfilters/core";
import { filter as email } from "@textfilters/email";
import { createSpamGuard, SPAM_BLOCK_REASONS } from "@textfilters/spam";

const allow = (name: string, calls: string[]): TextGuard => ({
  name,
  check: (input) => {
    calls.push(`${name}:${input.text}`);
    return { allowed: true };
  },
});

describe("moderation pipeline integration", () => {
  it("runs guards in order and gives filters the original text", () => {
    const calls: string[] = [];
    const source = "😀 user@example.com";
    const pipeline = createModerationPipeline({
      guards: [allow("first", calls), allow("second", calls)],
      filters: [email],
    });

    const result = pipeline.process({ actorKey: "u1", text: source }, "#");

    expect(calls).toEqual([`first:${source}`, `second:${source}`]);
    expect(result).toEqual({
      allowed: true,
      text: `😀 ${"#".repeat("user@example.com".length)}`,
      matches: email.find(source),
    });
    expect(Object.keys(result)).toEqual(["allowed", "text", "matches"]);
  });

  it("stops after the first blocked guard and never runs filters", () => {
    const calls: string[] = [];
    const blocking: TextGuard = {
      name: "policy",
      check: (input) => {
        calls.push(`policy:${input.text}`);
        return { allowed: false, reason: "blocked" };
      },
    };
    const filter: TextFilter = {
      name: "unexpected",
      check: () => {
        throw new Error("filter ran after a blocked guard");
      },
      find: () => {
        throw new Error("filter ran after a blocked guard");
      },
      censor: () => {
        throw new Error("filter ran after a blocked guard");
      },
      process: () => {
        throw new Error("filter ran after a blocked guard");
      },
    };
    const pipeline = createModerationPipeline({
      guards: [blocking, allow("late", calls)],
      filters: [filter],
    });

    const result = pipeline.process({ actorKey: "u1", text: "original" });

    expect(result).toEqual({
      allowed: false,
      guard: "policy",
      reason: "blocked",
    });
    expect(Object.keys(result)).toEqual(["allowed", "guard", "reason"]);
    expect(calls).toEqual(["policy:original"]);
  });

  it("lets spam inspect unmasked text and preserve state between calls", () => {
    const spam = createSpamGuard({ minIntervalMs: 0 });
    const pipeline = createModerationPipeline({
      guards: [spam],
      filters: [email],
    });
    const message = {
      actorKey: "u1",
      text: "user@example.com",
      nowMs: 0,
    };

    expect(pipeline.process(message)).toEqual({
      allowed: true,
      text: "****************",
      matches: email.find(message.text),
    });
    expect(pipeline.process({ ...message, nowMs: 1 })).toEqual({
      allowed: false,
      guard: "spam",
      reason: SPAM_BLOCK_REASONS.duplicate,
    });
  });

  it("does not share state across spam guard instances", () => {
    const options = { minIntervalMs: 0, duplicateWindowMs: 10_000 };
    const first = createModerationPipeline({
      guards: [createSpamGuard(options)],
    });
    const second = createModerationPipeline({
      guards: [createSpamGuard(options)],
    });
    const message = { actorKey: "u1", text: "same", nowMs: 0 };

    expect(first.process(message).allowed).toBe(true);
    expect(first.process({ ...message, nowMs: 1 }).allowed).toBe(false);
    expect(second.process({ ...message, nowMs: 1 }).allowed).toBe(true);
  });

  it("snapshots input arrays and handles empty arrays", () => {
    const guards: TextGuard[] = [];
    const filters: TextFilter[] = [];
    const pipeline = createModerationPipeline({ guards, filters });
    guards.push({
      name: "late",
      check: () => ({ allowed: false, reason: "late" }),
    });
    filters.push(email);

    expect(
      pipeline.process({ actorKey: "u1", text: "user@example.com" }),
    ).toEqual({
      allowed: true,
      text: "user@example.com",
      matches: [],
    });
  });

  it("rejects invalid actor-aware input", () => {
    const pipeline = createModerationPipeline();
    const unsafe = pipeline as unknown as { process(input: unknown): unknown };

    expect(() => unsafe.process(null)).toThrow(TypeError);
    expect(() => unsafe.process({ text: "hello" })).toThrow(TypeError);
    expect(() => unsafe.process({ actorKey: " ", text: "hello" })).toThrow(
      TypeError,
    );
    expect(() => unsafe.process({ actorKey: "u1", text: null })).toThrow(
      TypeError,
    );
  });

  it("does not swallow guard or filter errors", () => {
    const guardError = new Error("guard failure");
    const filterError = new Error("filter failure");
    const guarded = createModerationPipeline({
      guards: [
        {
          name: "broken",
          check: () => {
            throw guardError;
          },
        },
      ],
    });
    const filtered = createModerationPipeline({
      filters: [
        {
          name: "broken",
          check: () => false,
          find: () => {
            throw filterError;
          },
          censor: (text) => text,
          process: (text) => ({ censored: text, matches: [] }),
        },
      ],
    });

    expect(() => guarded.process({ actorKey: "u1", text: "hello" })).toThrow(
      guardError,
    );
    expect(() => filtered.process({ actorKey: "u1", text: "hello" })).toThrow(
      filterError,
    );
  });
});
