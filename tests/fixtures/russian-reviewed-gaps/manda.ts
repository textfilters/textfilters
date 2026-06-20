import type { ReviewedGapAuditCase, ReviewedGapMetadataCase } from "./types";

export const mandaExpectedCoveredCases: readonly ReviewedGapAuditCase[] = [
  {
    family: "manda",
    input: "манда",
    note: "reviewed anatomical form is covered",
  },
  {
    family: "manda",
    input: "манду",
    note: "reviewed anatomical case form is covered",
  },
  {
    family: "manda",
    input: "мандой",
    note: "reviewed anatomical case form is covered",
  },
  {
    family: "mandavosh",
    input: "мандовошь",
    note: "nearby reviewed insult remains covered with wider manda forms",
  },
];

export const mandaIntentionallyUnsupportedCases: readonly ReviewedGapAuditCase[] =
  [
    {
      family: "manda false-positive locks",
      input: "к о м а н д а",
      note: "separated neutral command word must not loose-match manda",
    },
    {
      family: "manda false-positive locks",
      input: "м а н д а т",
      note: "separated neutral mandate word must not loose-match manda",
    },
  ];

export const mandaCoverageMetadataCases: readonly ReviewedGapMetadataCase[] = [
  {
    input: "манда",
    expected: {
      ruleId: "ru.obscene.manda.family",
      category: "OBSCENE_MAT",
      severity: "high",
    },
  },
  {
    input: "мандовошь",
    expected: {
      ruleId: "ru.insult.mandavosh.family",
      category: "STRONG_INSULT",
      severity: "high",
    },
  },
];
