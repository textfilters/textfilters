import { describe, expect, it } from "vitest";

import * as core from "../src/index.js";

describe("core public entrypoint", () => {
  it("exports only the final runtime primitives", () => {
    expect(Object.keys(core).sort()).toEqual([
      "combineFilters",
      "createModerationPipeline",
      "maskTextRanges",
    ]);
  });
});
