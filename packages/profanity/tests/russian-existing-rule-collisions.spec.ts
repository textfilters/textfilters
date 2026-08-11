import { describe, expect, it } from "vitest";

import { filter } from "../src";

import {
  russianCollisionAdjacentCases,
  russianCollisionNeutralCases,
  russianCollisionPositiveCases,
} from "./fixtures/russian-existing-rule-collisions";
import { mask } from "./helpers";

describe("Russian existing-rule collisions", () => {
  it("keeps reviewed neutral contexts unchanged across public views", () => {
    for (const input of russianCollisionNeutralCases) {
      expect(filter.check(input), input).toBe(false);
      expect(filter.analyze(input), input).toEqual([]);
      expect(filter.censor(input), input).toBe(input);
    }
  });

  it("keeps a positive boundary counterexample beside every context guard", () => {
    for (const {
      input,
      matchedText,
      ruleId,
    } of russianCollisionPositiveCases) {
      const start = input.indexOf(matchedText);
      const end = start + matchedText.length;

      expect(start, input).toBeGreaterThanOrEqual(0);
      expect(filter.check(input), input).toBe(true);
      expect(filter.analyze(input), input).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 0: start, 1: end, ruleId }),
        ]),
      );
      expect(filter.censor(input), input).toBe(
        `${input.slice(0, start)}${mask(matchedText)}${input.slice(end)}`,
      );
    }
  });

  it("does not suppress adjacent profanity after a neutral context", () => {
    for (const { input, matchedText } of russianCollisionAdjacentCases) {
      const start = input.indexOf(matchedText);
      const end = start + matchedText.length;
      const matches = filter.analyze(input);

      expect(start, input).toBeGreaterThanOrEqual(0);
      expect(matches.length, input).toBeGreaterThan(0);
      expect(matches, input).toEqual(
        expect.arrayContaining([expect.objectContaining({ 0: start, 1: end })]),
      );
      expect(
        matches.every((match) => match[0] === start && match[1] === end),
        input,
      ).toBe(true);
      expect(filter.censor(input), input).toBe(
        `${input.slice(0, start)}${mask(matchedText)}${input.slice(end)}`,
      );
    }
  });
});
