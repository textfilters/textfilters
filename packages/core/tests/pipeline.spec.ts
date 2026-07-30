import { describe, expect, it } from "vitest";
import {
  createTextPipeline,
  type TextCensor,
  type TextGuard,
} from "../src/index.js";

describe("textfilters pipeline", () => {
  it("runs censors in registration order", () => {
    const replaceA: TextCensor = {
      censor: (text) => text.replaceAll("a", "b"),
    };
    const replaceB: TextCensor = {
      censor: (text) => text.replaceAll("b", "c"),
    };

    const pipeline = createTextPipeline().use(replaceA).use(replaceB);

    expect(pipeline.censor("a-b")).toBe("c-c");
  });

  it("runs guards before censoring", () => {
    const guard: TextGuard = {
      check: ({ text }) =>
        text === "blocked"
          ? { allowed: false, reason: "blocked" }
          : { allowed: true },
    };
    const censor: TextCensor = {
      censor: () => "censored",
    };

    const pipeline = createTextPipeline().guard(guard).use(censor);

    expect(pipeline.process({ text: "blocked" })).toEqual({
      allowed: false,
      reason: "blocked",
    });
    expect(pipeline.process({ text: "allowed" })).toEqual({
      allowed: true,
      text: "censored",
    });
  });

  it("passes actor metadata to guards", () => {
    const seen: Array<string | undefined> = [];
    const guard: TextGuard = {
      check: ({ actorKey }) => {
        seen.push(actorKey);
        return { allowed: true };
      },
    };

    createTextPipeline().guard(guard).check({
      actorKey: "user-1",
      text: "hi",
    });
    expect(seen).toEqual(["user-1"]);
  });
});
