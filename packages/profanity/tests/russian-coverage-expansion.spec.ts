import { describe, expect, it } from "vitest";

import { createProfanityFilter, filter } from "../src";

import {
  nahuyGuardCounterexamples,
  prefixedAhuelAttributionCases,
  russianBoundaryCases,
  russianNormalizationCases,
  russianPositiveGroups,
  splitAhuelAttributionCases,
  splitInflectedPrefixedAhuelAttributionCases,
  splitPrefixedAhuelAttributionCases,
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

  it("keeps matches inside token and punctuation boundaries", () => {
    for (const { input, matchedText, ruleId } of russianBoundaryCases) {
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

  it("keeps bare zhopa strict and symbol masking complete", () => {
    const strictOnlyFilter = createProfanityFilter(undefined, []);

    for (const candidate of [strictOnlyFilter, filter]) {
      expect(candidate.analyze("жоп")).toEqual([
        expect.objectContaining({
          0: 0,
          1: 3,
          ruleId: "ru.vulgar.zhopa.family",
          category: "VULGAR",
          severity: "low",
          mode: "strict",
        }),
      ]);
    }

    expect(filter.analyze("жопа")).toEqual([
      expect.objectContaining({
        0: 0,
        1: 4,
        ruleId: "ru.vulgar.zhopa.family",
        mode: "strict",
      }),
    ]);

    expect(filter.analyze("жоп@")).toEqual([
      expect.objectContaining({
        0: 0,
        1: 3,
        ruleId: "ru.vulgar.zhopa.family",
        mode: "strict",
      }),
      expect.objectContaining({
        0: 0,
        1: 4,
        ruleId: "ru.vulgar.zhopa.split.loose",
        category: "VULGAR",
        severity: "low",
        mode: "loose",
      }),
    ]);
    expect(filter.censor("жоп@")).toBe("****");
    expect(filter.censor("жоп@foo.ru")).toBe("***@foo.ru");
    expect(
      filter
        .analyze("жоп@foo.ru")
        .some(({ ruleId }) => ruleId === "ru.vulgar.zhopa.split.loose"),
    ).toBe(false);

    for (const input of ["ж0па", "ж о п а"]) {
      expect(filter.analyze(input), input).toEqual([
        expect.objectContaining({
          0: 0,
          1: input.length,
          ruleId: "ru.vulgar.zhopa.split.loose",
          category: "VULGAR",
          severity: "low",
        }),
      ]);
    }
  });

  it("separates direct and split ahue attribution", () => {
    expect(filter.analyze("ахуели")).toEqual([
      expect.objectContaining({
        0: 0,
        1: 6,
        ruleId: "ru.vulgar.ahue.extended.family",
      }),
    ]);
    for (const input of splitAhuelAttributionCases) {
      expect(filter.censor(input), input).toBe(mask(input));
      const matches = filter.analyze(input);
      const familyMatches = matches.filter(
        ({ ruleId }) => ruleId === "ru.vulgar.ahue.split.loose",
      );

      expect(familyMatches, input).toEqual([
        expect.objectContaining({
          0: 0,
          1: input.length,
          category: "VULGAR",
          severity: "medium",
          mode: "loose",
        }),
      ]);
    }

    expect(filter.censor("ахуел и ушёл")).toBe("***** и ушёл");
    expect(filter.censor("а-хуел и ушёл")).toBe("****** и ушёл");
    expect(filter.censor("ахуел—а он ушёл")).toBe("*****—а он ушёл");
    expect(filter.censor("а-хуел—а он ушёл")).toBe("******—а он ушёл");
    expect(filter.censor("«ах-уел» сказал")).toBe("«******» сказал");
  });

  it("keeps prefixed ahuel attribution on the correct family", () => {
    for (const input of prefixedAhuelAttributionCases) {
      const matches = filter.analyze(input);

      expect(filter.censor(input), input).toBe(mask(input));
      expect(matches, input).toEqual([
        expect.objectContaining({
          0: 0,
          1: input.length,
          ruleId: "ru.vulgar.ohue.prefixed.family",
          category: "VULGAR",
          severity: "medium",
          mode: "strict",
        }),
      ]);
    }

    for (const input of splitPrefixedAhuelAttributionCases) {
      expect(filter.censor(input), input).toBe(mask(input));
      const matches = filter.analyze(input);
      const familyMatches = matches.filter(
        ({ ruleId }) => ruleId === "ru.vulgar.ohue.prefixed.split.loose",
      );

      expect(familyMatches, input).toEqual([
        expect.objectContaining({
          0: 0,
          1: input.length,
          category: "VULGAR",
          severity: "medium",
          mode: "loose",
        }),
      ]);
      expect(
        matches.some(
          ({ ruleId }) => ruleId === "ru.vulgar.nahuy.in.token.loose",
        ),
        input,
      ).toBe(false);
    }

    for (const input of splitInflectedPrefixedAhuelAttributionCases) {
      const matches = filter.analyze(input);
      const familyMatches = matches.filter(
        ({ ruleId }) => ruleId === "ru.vulgar.ohue.prefixed.split.loose",
      );

      expect(filter.censor(input), input).toBe(mask(input));
      expect(familyMatches, input).toEqual([
        expect.objectContaining({
          0: 0,
          1: input.length,
          category: "VULGAR",
          severity: "medium",
          mode: "loose",
        }),
      ]);
      expect(
        matches.some(
          ({ ruleId }) => ruleId === "ru.vulgar.nahuy.in.token.loose",
        ),
        input,
      ).toBe(false);
    }

    for (const input of nahuyGuardCounterexamples) {
      const matches = filter.analyze(input);

      expect(filter.censor(input), input).toBe(mask(input));
      expect(
        matches.some(({ ruleId }) => ruleId?.includes("nahuy")),
        input,
      ).toBe(true);
      expect(
        matches.some(({ ruleId }) => ruleId?.includes("ohue.prefixed")),
        input,
      ).toBe(false);
    }

    expect(filter.censor("«п-о-о-х-у-е-л» сказал")).toBe(
      "«*************» сказал",
    );
    expect(filter.censor("п-о-о-х-у-е-л—а он ушёл")).toBe(
      "*************—а он ушёл",
    );
  });

  it("keeps long unmatched mudak obfuscations linear", () => {
    expect(filter.check(`м${"u".repeat(20_000)}x`)).toBe(false);
  }, 2_000);
});
