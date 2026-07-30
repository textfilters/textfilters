import { describe, expect, it } from "vitest";

import {
  createTextPipeline,
  maskRanges,
  type TextCensor,
  type TextGuard,
} from "../src/index.js";

describe("@textfilters/core curated regressions", () => {
  it("short-circuits guards and does not run censors after a block", () => {
    const seen: string[] = [];
    const blocker: TextGuard = {
      check: () => {
        seen.push("blocker");
        return { allowed: false, reason: "blocked" };
      },
    };
    const laterGuard: TextGuard = {
      check: () => {
        seen.push("later-guard");
        return { allowed: true };
      },
    };
    const censor: TextCensor = {
      censor: () => {
        seen.push("censor");
        return "masked";
      },
    };

    const result = createTextPipeline()
      .guard(blocker)
      .guard(laterGuard)
      .use(censor)
      .process({ text: "secret" });

    expect(result).toEqual({ allowed: false, reason: "blocked" });
    expect(seen).toEqual(["blocker"]);
  });

  it("passes the original input to every guard before censoring", () => {
    const seen: string[] = [];
    const guard: TextGuard = {
      check: ({ text }) => {
        seen.push(text);
        return { allowed: true };
      },
    };
    const censor: TextCensor = {
      censor: (text) => text.replace("secret", "******"),
    };

    const result = createTextPipeline()
      .use(censor)
      .guard(guard)
      .process({ text: "secret" });

    expect(result).toEqual({ allowed: true, text: "******" });
    expect(seen).toEqual(["secret"]);
  });

  it("masks unsorted overlapping UTF-16 ranges deterministically", () => {
    expect(
      maskRanges("alpha secret token", [
        [13, 18],
        [6, 12],
        [8, 16],
      ]),
    ).toBe("alpha ************");
  });
});
