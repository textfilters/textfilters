import type { ReviewedGapAuditCase, ReviewedGapMetadataCase } from "./types";

export const drochExpectedCoveredCases: readonly ReviewedGapAuditCase[] = [
  {
    family: "droch",
    input: "дрочить",
    note: "reviewed sexual vulgarity verb is covered",
  },
  {
    family: "droch",
    input: "дрочу",
    note: "reviewed sexual vulgarity verb form is covered",
  },
  {
    family: "droch",
    input: "дрочер",
    note: "reviewed sexual vulgarity noun is covered",
  },
  {
    family: "droch",
    input: "дрочила",
    note: "reviewed sexual vulgarity form is covered",
  },
  {
    family: "droch",
    input: "дрочерами",
    note: "reviewed sexual vulgarity noun inflection is covered",
  },
];

export const drochIntentionallyUnsupportedCases: readonly ReviewedGapAuditCase[] =
  [
    {
      family: "droch false-positive locks",
      input: "дрожь",
      note: "neutral Russian word near the droch family surface",
    },
    {
      family: "droch false-positive locks",
      input: "дрожать",
      note: "neutral Russian verb near the droch family surface",
    },
    {
      family: "droch false-positive locks",
      input: "Droid",
      note: "Latin technical token collision for future transliteration review",
    },
  ];

export const drochCoverageMetadataCases: readonly ReviewedGapMetadataCase[] = [
  {
    input: "дрочить",
    expected: {
      ruleId: "ru.vulgar.droch.family",
      category: "VULGAR",
      severity: "medium",
    },
  },
];
