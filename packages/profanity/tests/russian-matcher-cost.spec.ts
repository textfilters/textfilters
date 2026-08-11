import { describe, expect, it } from "vitest";
import { russianMatcherCostReport } from "../src/languages/ru/matcher-cost.js";
import russianMatcherCostBaseline from "./fixtures/russian-matcher-cost-baseline.json" with { type: "json" };

describe("Russian matcher cost", () => {
  it("matches the reviewed structural baseline", () => {
    expect(russianMatcherCostReport()).toEqual(russianMatcherCostBaseline);
  });
});
