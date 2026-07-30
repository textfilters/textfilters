import type { ReviewedGapAuditCase, ReviewedGapMetadataCase } from "./types";

export const huyloExpectedCoveredCases: readonly ReviewedGapAuditCase[] = [
  {
    family: "huylo",
    input: "хуйло",
    note: "reviewed strong-insult form is covered",
  },
  {
    family: "huylo",
    input: "хуило",
    note: "reviewed alternate spelling is covered",
  },
  {
    family: "huylo",
    input: "хуила",
    note: "reviewed alternate spelling inflection is covered",
  },
  {
    family: "huylo",
    input: "хуйлу",
    note: "reviewed case form is covered",
  },
  {
    family: "huylo",
    input: "хуилом",
    note: "reviewed alternate spelling case form is covered",
  },
  {
    family: "huylo",
    input: "хуйлах",
    note: "reviewed plural case form is covered",
  },
];

export const huyloCoverageMetadataCases: readonly ReviewedGapMetadataCase[] = [
  {
    input: "хуйло",
    expected: {
      ruleId: "ru.insult.huylo.family",
      category: "STRONG_INSULT",
      severity: "high",
    },
  },
];
