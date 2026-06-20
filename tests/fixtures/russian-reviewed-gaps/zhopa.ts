import type { ReviewedGapAuditCase, ReviewedGapMetadataCase } from "./types";

export const zhopaExpectedCoveredCases: readonly ReviewedGapAuditCase[] = [
  {
    family: "zhopa",
    input: "жопа",
    note: "reviewed vulgar bodily term is covered",
  },
  {
    family: "zhopa",
    input: "жопу",
    note: "reviewed case form is covered",
  },
  {
    family: "zhopa",
    input: "жопой",
    note: "reviewed case form is covered",
  },
  {
    family: "zhopa",
    input: "жопный",
    note: "reviewed adjective form is covered",
  },
];

export const zhopaCoverageMetadataCases: readonly ReviewedGapMetadataCase[] = [
  {
    input: "жопа",
    expected: {
      ruleId: "ru.vulgar.zhopa.family",
      category: "VULGAR",
      severity: "medium",
    },
  },
];
