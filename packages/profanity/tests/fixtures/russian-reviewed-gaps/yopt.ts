import type { ReviewedGapAuditCase, ReviewedGapMetadataCase } from "./types";

export const yoptExpectedCoveredCases: readonly ReviewedGapAuditCase[] = [
  {
    family: "yopt",
    input: "ёпт",
    note: "reviewed short expletive-like form is covered",
  },
  {
    family: "yopt",
    input: "епт",
    note: "reviewed yo/e variant is covered",
  },
  {
    family: "yopt",
    input: "ёпта",
    note: "reviewed inflected expletive-like form is covered",
  },
  {
    family: "yopt",
    input: "епта",
    note: "reviewed yo/e inflected form is covered",
  },
  {
    family: "yopt",
    input: "ептваю",
    note: "reviewed phrase-like form is covered",
  },
  {
    family: "yopt",
    input: "ёптваю",
    note: "reviewed yo/e phrase-like form is covered",
  },
];

export const yoptIntentionallyUnsupportedCases: readonly ReviewedGapAuditCase[] =
  [
    {
      family: "yopt false-positive locks",
      input: "Е. П. Т.",
      note: "initial-like separated Cyrillic letters must not loose-match yopt",
    },
    {
      family: "yopt false-positive locks",
      input: "е п т",
      note: "separated Cyrillic letters must not loose-match yopt",
    },
  ];

export const yoptCoverageMetadataCases: readonly ReviewedGapMetadataCase[] = [
  {
    input: "ёпт",
    expected: {
      ruleId: "ru.euphemism.yopt.family",
      category: "EUPHEMISM",
      severity: "soft",
    },
  },
];
