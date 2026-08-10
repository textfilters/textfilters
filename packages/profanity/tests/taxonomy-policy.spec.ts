import { describe, expect, it } from "vitest";

import {
  englishProfanityDictionary,
  englishProfanityFilter,
  filter,
} from "../src";
import { RUSSIAN_PROFANITY_DICTIONARY } from "../src/languages/ru";

const allowedSeveritiesByCategory = {
  OBSCENE_MAT: new Set(["medium", "high"]),
  STRONG_INSULT: new Set(["low", "medium", "high"]),
  VULGAR: new Set(["low", "medium"]),
  EUPHEMISM: new Set(["soft", "low"]),
} as const;

const nextSeverity = {
  soft: "low",
  low: "medium",
  medium: "high",
  high: undefined,
} as const;

const metadataCounts = (
  rules: readonly {
    readonly category?: string;
    readonly severity?: string;
  }[],
) => {
  const counts: Record<string, number> = {};

  for (const rule of rules) {
    const key = `${rule.category}/${rule.severity}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
};

describe("built-in taxonomy policy", () => {
  it("classifies every built-in rule within the reviewed category bands", () => {
    for (const dictionary of [
      RUSSIAN_PROFANITY_DICTIONARY,
      englishProfanityDictionary,
    ]) {
      for (const rule of dictionary.rules) {
        expect(rule.id).toBeDefined();
        expect(rule.category).toBeDefined();
        expect(rule.severity).toBeDefined();
        expect(
          allowedSeveritiesByCategory[
            rule.category as keyof typeof allowedSeveritiesByCategory
          ],
        ).toContain(rule.severity);
      }
    }
  });

  it("locks the audited taxonomy distribution for every built-in rule", () => {
    expect(metadataCounts(RUSSIAN_PROFANITY_DICTIONARY.rules)).toEqual({
      "OBSCENE_MAT/high": 73,
      "STRONG_INSULT/high": 41,
      "STRONG_INSULT/medium": 27,
      "STRONG_INSULT/low": 1,
      "VULGAR/medium": 34,
      "VULGAR/low": 29,
      "EUPHEMISM/low": 12,
      "EUPHEMISM/soft": 3,
    });
    expect(metadataCounts(englishProfanityDictionary.rules)).toEqual({
      "OBSCENE_MAT/high": 1,
      "VULGAR/low": 2,
      "OBSCENE_MAT/medium": 2,
      "STRONG_INSULT/medium": 3,
      "STRONG_INSULT/high": 5,
      "STRONG_INSULT/low": 1,
    });
  });

  it.each([
    ["бля", "ru.obscene.blya", "OBSCENE_MAT", "high"],
    ["прихуел", "ru.vulgar.prihue.family", "VULGAR", "medium"],
    ["говно", "ru.vulgar.govno.family", "VULGAR", "low"],
    ["жопа", "ru.vulgar.zhopa.family", "VULGAR", "low"],
    ["сру", "ru.vulgar.sru.family", "VULGAR", "low"],
    ["дрочить", "ru.vulgar.droch.family", "VULGAR", "low"],
    ["хер", "ru.euphemism.her.base", "EUPHEMISM", "low"],
    ["нахрен", "ru.euphemism.hren.family", "EUPHEMISM", "low"],
    ["ёпт", "ru.euphemism.yopt.family", "EUPHEMISM", "soft"],
    ["лять", "ru.euphemism.lyat", "EUPHEMISM", "soft"],
    ["сука", "ru.insult.suka.family", "STRONG_INSULT", "medium"],
    ["гандон", "ru.insult.gandon.family", "STRONG_INSULT", "medium"],
    ["пиздец", "ru.obscene.pizdec.loose", "OBSCENE_MAT", "high"],
    ["хуйня", "ru.vulgar.huyn.family", "VULGAR", "medium"],
  ] as const)(
    "applies the reviewed Russian threshold to %s",
    (text, ruleId, category, severity) => {
      expect(filter.analyze(text)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ruleId, category, severity }),
        ]),
      );
      expect(filter.check(text, { minSeverity: severity })).toBe(true);

      const strongerSeverity = nextSeverity[severity];
      if (strongerSeverity !== undefined) {
        expect(filter.check(text, { minSeverity: strongerSeverity })).toBe(
          false,
        );
      }
    },
  );

  it.each([
    ["fuck", "en.obscene.fuck.family", "OBSCENE_MAT", "high"],
    ["shit", "en.vulgar.shit", "VULGAR", "low"],
    ["dick", "en.obscene.dick", "OBSCENE_MAT", "medium"],
    ["dickhead", "en.insult.dickhead", "STRONG_INSULT", "medium"],
    ["cock", "en.obscene.cock", "OBSCENE_MAT", "medium"],
    ["suck", "en.vulgar.suck", "VULGAR", "low"],
    ["asshole", "en.insult.asshole", "STRONG_INSULT", "medium"],
    ["bastard", "en.insult.bastard", "STRONG_INSULT", "low"],
  ] as const)(
    "applies the reviewed English threshold to %s",
    (text, ruleId, category, severity) => {
      expect(englishProfanityFilter.analyze(text)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ruleId, category, severity }),
        ]),
      );
      expect(
        englishProfanityFilter.check(text, { minSeverity: severity }),
      ).toBe(true);

      const strongerSeverity = nextSeverity[severity];
      if (strongerSeverity !== undefined) {
        expect(
          englishProfanityFilter.check(text, {
            minSeverity: strongerSeverity,
          }),
        ).toBe(false);
      }
    },
  );

  it.each(["бляд", "пиздец", "хуйня"])(
    "keeps overlapping metadata consistent for %s",
    (text) => {
      const metadataByRange = new Map<string, Set<string>>();

      for (const match of filter.analyze(text)) {
        const key = `${match[0]}:${match[1]}`;
        const metadata = `${match.category}/${match.severity}`;
        const values = metadataByRange.get(key) ?? new Set<string>();
        values.add(metadata);
        metadataByRange.set(key, values);
      }

      for (const values of metadataByRange.values()) {
        expect(values.size).toBe(1);
      }
    },
  );

  it("preserves default matching for reclassified terms", () => {
    for (const text of [
      "бля",
      "прихуел",
      "говно",
      "жопа",
      "сру",
      "дрочить",
      "хер",
      "ёпт",
      "лять",
      "сука",
      "гандон",
      "пиздец",
      "хуйня",
    ]) {
      expect(filter.check(text), text).toBe(true);
    }

    for (const text of [
      "shit",
      "dick",
      "dickhead",
      "cock",
      "suck",
      "asshole",
      "bastard",
    ]) {
      expect(englishProfanityFilter.check(text), text).toBe(true);
    }
  });
});
