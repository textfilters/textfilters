import { describe, expect, it } from "vitest";

import { filter } from "../src";

import {
  coverageMetadataCases,
  expectedCoveredCases,
  neutralCollisionCases,
} from "./fixtures/russian-reviewed-gaps";
import { mask } from "./helpers";
import { expectUnchanged } from "./russian-audit-helpers";

describe("Russian coverage gap audit", () => {
  it("keeps nearby reviewed families explicitly expected covered", () => {
    for (const testCase of expectedCoveredCases) {
      expect(filter.censor(testCase.input), testCase.note).toBe(
        mask(testCase.input),
      );
    }
  });

  it("preserves metadata for reviewed gap coverage", () => {
    for (const { input, expected } of coverageMetadataCases) {
      expect(filter.analyze(input), input).toEqual(
        expect.arrayContaining([expect.objectContaining(expected)]),
      );
    }
  });

  it("keeps reviewed neutral collisions unchanged", () => {
    for (const testCase of neutralCollisionCases) {
      expectUnchanged(testCase.input);
      expect(filter.analyze(testCase.input), testCase.note).toEqual([]);
    }
  });
});
