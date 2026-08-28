import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  GuardDecision,
  ModerationPipeline,
  TextFilter,
  TextGuard,
  TextMatch,
  TextRange,
} from "../src/index.js";

describe("core contracts", () => {
  it("exposes the final filter and guard shapes", () => {
    expectTypeOf<TextRange>().toEqualTypeOf<readonly [number, number]>();
    expectTypeOf<TextMatch>().toMatchTypeOf<{
      start: number;
      end: number;
      value: string;
      filter: string;
      data?: unknown;
    }>();
    expectTypeOf<TextFilter["process"]>().parameters.toEqualTypeOf<
      [text: string, mask?: string]
    >();
    expectTypeOf<TextGuard["check"]>().returns.toEqualTypeOf<GuardDecision>();
    expectTypeOf<ModerationPipeline>().toEqualTypeOf<{
      process: ModerationPipeline["process"];
    }>();
    expect(true).toBe(true);
  });
});
