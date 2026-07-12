import { describe, expect, it } from "vitest";

import { filter } from "../src";

import { mask } from "./helpers";

describe("Russian reviewed gaps from issue 149", () => {
  it("fully masks the reviewed symbol-split pidor inflections", () => {
    for (const input of ["пидора$сы", "пидора#сы"]) {
      expect(filter.censor(input), input).toBe(mask(input));
    }
  });

  it("detects the reviewed standalone truncated eba form", () => {
    expect(filter.censor("еба")).toBe(mask("еба"));
  });

  it("preserves metadata and UTF-16 source ranges for the reviewed rules", () => {
    const cases = [
      {
        input: "пидора$сы",
        expected: {
          ruleId: "ru.insult.pidor.as.plural.symbol.loose",
          category: "STRONG_INSULT",
          severity: "high",
          mode: "loose",
        },
      },
      {
        input: "пидора#сы",
        expected: {
          ruleId: "ru.insult.pidor.as.plural.symbol.loose",
          category: "STRONG_INSULT",
          severity: "high",
          mode: "loose",
        },
      },
      {
        input: "еба",
        expected: {
          ruleId: "ru.obscene.eb.truncated",
          category: "OBSCENE_MAT",
          severity: "high",
          mode: "strict",
        },
      },
      {
        input: "пиздец",
        expected: {
          ruleId: "ru.vulgar.pizdec.loose",
          category: "VULGAR",
          severity: "medium",
          mode: "loose",
        },
      },
    ] as const;

    for (const { input, expected } of cases) {
      expect(filter.analyze(input), input).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            0: 0,
            1: input.length,
            ...expected,
          }),
        ]),
      );
    }
  });

  it("does not widen masking over arbitrary symbol tails", () => {
    const cases = ["пидора%сы", "пидора&сы", "пидора$сын", "пидора#сыр"];

    for (const input of cases) {
      expect(filter.censor(input), input).toBe(
        `${mask("пидора")}${input.slice(6)}`,
      );
    }
  });

  it("keeps nearby neutral prefixes unchanged", () => {
    const cases = ["підоренда", "підоруч", "ебайк", "ебаскет"];

    for (const input of cases) {
      expect(filter.censor(input), input).toBe(input);
      expect(filter.analyze(input), input).toEqual([]);
    }
  });
});
