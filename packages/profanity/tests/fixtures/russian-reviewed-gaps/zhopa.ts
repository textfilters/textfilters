import type { ReviewedGapAuditCase, ReviewedGapMetadataCase } from "./types";

export const zhopaExpectedCoveredCases: readonly ReviewedGapAuditCase[] = [
  {
    family: "zhopa",
    input: "жоп",
    note: "reviewed plural case form is covered",
  },
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
    input: "жопе",
    note: "reviewed case form is covered",
  },
  {
    family: "zhopa",
    input: "жопы",
    note: "reviewed case form is covered",
  },
  {
    family: "zhopa",
    input: "жопой",
    note: "reviewed case form is covered",
  },
  {
    family: "zhopa",
    input: "жопам",
    note: "reviewed case form is covered",
  },
  {
    family: "zhopa",
    input: "жопами",
    note: "reviewed case form is covered",
  },
  {
    family: "zhopa",
    input: "жопах",
    note: "reviewed case form is covered",
  },
  {
    family: "zhopa",
    input: "жопный",
    note: "reviewed adjective form is covered",
  },
];

export const zhopaIntentionallyUnsupportedCases: readonly ReviewedGapAuditCase[] =
  [
    {
      family: "zhopa",
      input: "zhopa",
      note: "transliteration stays unsupported for the narrow Cyrillic review",
    },
    {
      family: "zhopa",
      input: "ж о п а",
      note: "split forms stay unsupported for the narrow Cyrillic review",
    },
  ];

export const zhopaCoverageMetadataCases: readonly ReviewedGapMetadataCase[] = [
  {
    input: "жопа",
    expected: {
      ruleId: "ru.vulgar.zhopa.family",
      category: "VULGAR",
      severity: "low",
    },
  },
  {
    input: "жопами",
    expected: {
      ruleId: "ru.vulgar.zhopa.family",
      category: "VULGAR",
      severity: "low",
    },
  },
];
