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
    input: "дрочево",
    note: "reviewed sexual vulgarity noun is covered",
  },
  {
    family: "droch",
    input: "дрочевом",
    note: "reviewed sexual vulgarity noun inflection is covered",
  },
  {
    family: "droch",
    input: "дрочерами",
    note: "reviewed sexual vulgarity noun inflection is covered",
  },
  {
    family: "droch",
    input: "дрочун",
    note: "reviewed sexual vulgarity noun is covered",
  },
  {
    family: "droch",
    input: "дрочунами",
    note: "reviewed sexual vulgarity noun inflection is covered",
  },
  {
    family: "droch",
    input: "дрочунья",
    note: "reviewed sexual vulgarity feminine noun is covered",
  },
  {
    family: "droch",
    input: "дрочунью",
    note: "reviewed sexual vulgarity feminine noun inflection is covered",
  },
  {
    family: "droch",
    input: "дрочуньей",
    note: "reviewed sexual vulgarity feminine noun inflection is covered",
  },
  {
    family: "droch",
    input: "подрочить",
    note: "reviewed prefixed sexual vulgarity verb is covered",
  },
  {
    family: "droch",
    input: "подрочи",
    note: "reviewed prefixed sexual vulgarity imperative is covered",
  },
  {
    family: "droch",
    input: "подрочили",
    note: "reviewed prefixed sexual vulgarity verb form is covered",
  },
  {
    family: "droch",
    input: "надроченный",
    note: "reviewed prefixed sexual vulgarity adjective is covered",
  },
  {
    family: "droch",
    input: "надроченную",
    note: "reviewed prefixed sexual vulgarity adjective inflection is covered",
  },
  {
    family: "droch",
    input: "надроченном",
    note: "reviewed prefixed sexual vulgarity adjective inflection is covered",
  },
  {
    family: "droch",
    input: "надроченными",
    note: "reviewed prefixed sexual vulgarity adjective inflection is covered",
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
      input: "дрожжи",
      note: "neutral Russian noun near the droch family surface",
    },
    {
      family: "droch false-positive locks",
      input: "Android",
      note: "Latin technical token collision for future transliteration review",
    },
    {
      family: "droch false-positive locks",
      input: "Droid",
      note: "Latin technical token collision for future transliteration review",
    },
    {
      family: "droch unsupported forms",
      input: "droch",
      note: "transliteration stays unsupported for the narrow Cyrillic review",
    },
    {
      family: "droch unsupported forms",
      input: "д р о ч и т ь",
      note: "split forms stay unsupported for the narrow Cyrillic review",
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
  {
    input: "надроченными",
    expected: {
      ruleId: "ru.vulgar.droch.family",
      category: "VULGAR",
      severity: "medium",
    },
  },
];
