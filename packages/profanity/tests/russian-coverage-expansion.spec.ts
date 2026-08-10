import { describe, expect, it } from "vitest";

import { filter } from "../src";

import {
  guardedTransliterationGroups,
  prefixedAhuelAttributionCases,
  russianGuardBoundaryCases,
  russianNeutralCorpus,
  russianNormalizationCases,
  russianPositiveGroups,
} from "./fixtures/russian-coverage-expansion";
import { mask } from "./helpers";

describe("Russian coverage expansion", () => {
  it("covers the complete reviewed morphology matrices with full ranges", () => {
    for (const group of russianPositiveGroups) {
      for (const input of group.inputs) {
        expect(filter.check(input), `${group.family}: ${input}`).toBe(true);
        expect(filter.censor(input), `${group.family}: ${input}`).toBe(
          mask(input),
        );
        expect(filter.analyze(input), `${group.family}: ${input}`).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              0: 0,
              1: input.length,
              ruleId: group.ruleId,
              category: group.category,
              severity: group.severity,
            }),
          ]),
        );
      }
    }
  });

  it("fully masks reviewed normalization and separator variants", () => {
    for (const input of russianNormalizationCases) {
      expect(filter.check(input), input).toBe(true);
      expect(filter.censor(input), input).toBe(mask(input));
      expect(filter.analyze(input), input).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 0: 0, 1: input.length }),
        ]),
      );
    }
  });

  it("covers reviewed guarded transliterations", () => {
    for (const group of guardedTransliterationGroups) {
      for (const input of group.inputs) {
        expect(filter.check(input), `${group.family}: ${input}`).toBe(true);
        expect(filter.censor(input), `${group.family}: ${input}`).toBe(
          mask(input),
        );
        expect(filter.analyze(input), `${group.family}: ${input}`).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              0: 0,
              1: input.length,
              ruleId: group.ruleId,
              category: group.category,
              severity: group.severity,
            }),
          ]),
        );
      }
    }
  });

  it("keeps the reviewed neutral corpus unchanged", () => {
    for (const input of russianNeutralCorpus) {
      expect(filter.check(input), input).toBe(false);
      expect(filter.analyze(input), input).toEqual([]);
      expect(filter.censor(input), input).toBe(input);
      expect(filter.check(input, { minSeverity: "medium" }), input).toBe(false);
      expect(filter.analyze(input, { minSeverity: "medium" }), input).toEqual(
        [],
      );
      expect(filter.censor(input, { minSeverity: "medium" }), input).toBe(
        input,
      );
    }
  });

  it("keeps context guards and suffixes within their reviewed boundaries", () => {
    for (const { input, matchedText, ruleId } of russianGuardBoundaryCases) {
      const start = input.indexOf(matchedText);

      expect(start, input).toBeGreaterThanOrEqual(0);
      expect(filter.check(input), input).toBe(true);
      expect(filter.censor(input), input).toBe(
        `${input.slice(0, start)}${mask(matchedText)}${input.slice(
          start + matchedText.length,
        )}`,
      );
      expect(filter.analyze(input), input).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            0: start,
            1: start + matchedText.length,
            ruleId,
          }),
        ]),
      );
    }
  });

  it("keeps prefixed ahuel attribution on the correct family", () => {
    for (const input of prefixedAhuelAttributionCases) {
      const matches = filter.analyze(input);

      expect(filter.censor(input), input).toBe(mask(input));
      expect(matches, input).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            0: 0,
            1: input.length,
            ruleId: "ru.vulgar.ohue.family",
            category: "VULGAR",
            severity: "medium",
          }),
        ]),
      );
      expect(
        matches.map(({ ruleId }) => ruleId),
        input,
      ).not.toContain("ru.vulgar.nahuy.in.token.loose");
    }
  });
});
