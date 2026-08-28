import { describe, expect, it, vi } from "vitest";

import {
  createModerationPipeline,
  type ModerationInput,
  type TextFilter,
  type TextGuard,
} from "../src/index.js";

const allowingGuard = (
  name: string,
  check = vi.fn(() => ({ allowed: true }) as const),
): TextGuard => ({
  name,
  check,
});

const maskingFilter = (
  find = vi.fn((text: string) => [
    { start: 0, end: text.length, value: text, filter: "mask" },
  ]),
): TextFilter => ({
  name: "mask",
  check: (text) => find(text).length > 0,
  find,
  censor: () => {
    throw new Error("child censor must not run");
  },
  process: () => {
    throw new Error("child process must not run");
  },
});

describe("createModerationPipeline", () => {
  it("runs guards in registration order on the original input", () => {
    const order: string[] = [];
    const input: ModerationInput = { actorKey: "u1", text: "secret" };
    const first = allowingGuard(
      "first",
      vi.fn((seen) => {
        order.push("first");
        expect(seen).toBe(input);
        return { allowed: true };
      }),
    );
    const second = allowingGuard(
      "second",
      vi.fn((seen) => {
        order.push("second");
        expect(seen.text).toBe("secret");
        return { allowed: true };
      }),
    );

    expect(
      createModerationPipeline({ guards: [first, second] }).process(input),
    ).toEqual({ allowed: true, text: "secret", matches: [] });
    expect(order).toEqual(["first", "second"]);
  });

  it("stops at the first blocked guard and skips filters", () => {
    const later = allowingGuard("later");
    const filter = maskingFilter();
    const pipeline = createModerationPipeline({
      guards: [
        {
          name: "blocker",
          check: () => ({ allowed: false, reason: "blocked" }),
        },
        later,
      ],
      filters: [filter],
    });

    expect(pipeline.process({ actorKey: "u1", text: "secret" })).toEqual({
      allowed: false,
      guard: "blocker",
      reason: "blocked",
    });
    expect(later.check).not.toHaveBeenCalled();
    expect(filter.find).not.toHaveBeenCalled();
  });

  it("passes allowed text to combined filters with a custom mask", () => {
    const result = createModerationPipeline({
      guards: [allowingGuard("allow")],
      filters: [maskingFilter()],
    }).process({ actorKey: "u1", text: "secret" }, "#");

    expect(result).toEqual({
      allowed: true,
      text: "######",
      matches: [{ start: 0, end: 6, value: "secret", filter: "mask" }],
    });
    expect(Object.keys(result).sort()).toEqual(["allowed", "matches", "text"]);
  });

  it("supports missing and empty guard/filter arrays", () => {
    const input = { actorKey: "u1", text: "value" };

    expect(createModerationPipeline().process(input)).toEqual({
      allowed: true,
      text: "value",
      matches: [],
    });
    expect(
      createModerationPipeline({ guards: [], filters: [] }).process(input),
    ).toEqual({ allowed: true, text: "value", matches: [] });
    expect(
      createModerationPipeline({ filters: [maskingFilter()] }).process(input),
    ).toMatchObject({ allowed: true, text: "*****" });
  });

  it("snapshots option arrays at creation", () => {
    const guards: TextGuard[] = [];
    const filters: TextFilter[] = [];
    const pipeline = createModerationPipeline({ guards, filters });

    guards.push({
      name: "late",
      check: () => ({ allowed: false, reason: "late" }),
    });
    filters.push(maskingFilter());

    expect(pipeline.process({ actorKey: "u1", text: "value" })).toEqual({
      allowed: true,
      text: "value",
      matches: [],
    });
  });

  it("validates actor-aware input", () => {
    const pipeline = createModerationPipeline();
    const unsafe = pipeline.process as unknown as (input: unknown) => unknown;

    for (const input of [null, [], "value"]) {
      expect(() => unsafe(input)).toThrow("input must be an object");
    }
    for (const actorKey of [undefined, "", "   "]) {
      expect(() => unsafe({ actorKey, text: "value" })).toThrow(
        "actorKey must be a non-empty string",
      );
    }
    expect(() => unsafe({ actorKey: "u1", text: 42 })).toThrow(
      "text must be a string",
    );
  });

  it("rejects invalid clocks before invoking guards", () => {
    const guard = allowingGuard("guard");
    const pipeline = createModerationPipeline({ guards: [guard] });
    const unsafe = pipeline.process as unknown as (input: unknown) => unknown;

    for (const nowMs of [NaN, Infinity, -Infinity, "1000", null, {}, []]) {
      const process = () => unsafe({ actorKey: "u1", text: "value", nowMs });
      expect(process).toThrow(TypeError);
      expect(process).toThrow("nowMs must be a finite number");
    }
    expect(guard.check).not.toHaveBeenCalled();

    expect(
      pipeline.process({ actorKey: "u1", text: "value", nowMs: undefined }),
    ).toMatchObject({ allowed: true });
    expect(
      pipeline.process({ actorKey: "u1", text: "value", nowMs: 0 }),
    ).toMatchObject({ allowed: true });
  });

  it("does not catch child errors", () => {
    const guardError = new Error("guard failed");
    const filterError = new Error("filter failed");

    expect(() =>
      createModerationPipeline({
        guards: [
          {
            name: "guard",
            check: () => {
              throw guardError;
            },
          },
        ],
      }).process({ actorKey: "u1", text: "value" }),
    ).toThrow(guardError);
    expect(() =>
      createModerationPipeline({
        filters: [
          maskingFilter(
            vi.fn(() => {
              throw filterError;
            }),
          ),
        ],
      }).process({ actorKey: "u1", text: "value" }),
    ).toThrow(filterError);
  });
});
