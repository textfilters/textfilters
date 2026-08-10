import type { ReviewedGapAuditCase, ReviewedGapMetadataCase } from "./types";

export const sosExpectedCoveredCases: readonly ReviewedGapAuditCase[] = [
  {
    family: "sos",
    input: "соси",
    note: "reviewed narrow short form is covered",
  },
  {
    family: "sos",
    input: "отсоси",
    note: "reviewed narrow prefixed form is covered",
  },
];

export const sosNeutralCollisionCases: readonly ReviewedGapAuditCase[] = [
  {
    family: "sos false-positive locks",
    input: "сосна",
    note: "neutral Russian word overlapping the short sos root",
  },
  {
    family: "sos false-positive locks",
    input: "насос",
    note: "neutral Russian word overlapping the short sos root",
  },
  {
    family: "sos false-positive locks",
    input: "сосед",
    note: "neutral Russian word overlapping the short sos root",
  },
  {
    family: "sos false-positive locks",
    input: "СОС И помощь",
    note: "Cyrillic distress acronym followed by a conjunction must not loose-match sos forms",
  },
  {
    family: "sos false-positive locks",
    input: "сосать леденец",
    note: "context-only neutral usage is unsupported without a reviewed contextual rule",
  },
  {
    family: "sos false-positive locks",
    input: "сосать палец",
    note: "context-only neutral usage is unsupported without a reviewed contextual rule",
  },
  {
    family: "sos false-positive locks",
    input: "SOS",
    note: "Latin acronym collision for future sos review",
  },
  {
    family: "sos false-positive locks",
    input: "Sosa",
    note: "Latin name collision for future sos review",
  },
];

export const sosCoverageMetadataCases: readonly ReviewedGapMetadataCase[] = [
  {
    input: "соси",
    expected: {
      ruleId: "ru.vulgar.sos.narrow",
      category: "VULGAR",
      severity: "medium",
    },
  },
];
