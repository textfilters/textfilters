import { describe, expect, it } from "vitest";

import { filter } from "../src";

import { mask } from "./helpers";
import { expectUnchanged } from "./russian-audit-helpers";

type GapAuditStatus =
  | "expected-covered"
  | "expected-missing"
  | "intentionally-unsupported";

interface GapAuditCase {
  readonly family: string;
  readonly input: string;
  readonly status: GapAuditStatus;
  readonly note: string;
}

interface CoverageMetadataCase {
  readonly input: string;
  readonly expected: {
    readonly ruleId: string;
    readonly category: string;
    readonly severity: string;
  };
}

const expectedMissingCases: readonly GapAuditCase[] = [
  {
    family: "huylo",
    input: "хуйло",
    status: "expected-missing",
    note: "whole-token political insult form is not owned by current huy rules",
  },
  {
    family: "huylo",
    input: "хуило",
    status: "expected-missing",
    note: "alternate spelling is not owned by current huy rules",
  },
  {
    family: "huylo",
    input: "хуила",
    status: "expected-missing",
    note: "inflected alternate spelling is not owned by current huy rules",
  },
  {
    family: "droch",
    input: "дрочить",
    status: "expected-missing",
    note: "sexual vulgarity pending high-risk false-positive review",
  },
  {
    family: "droch",
    input: "дрочу",
    status: "expected-missing",
    note: "sexual vulgarity pending high-risk false-positive review",
  },
  {
    family: "droch",
    input: "дрочер",
    status: "expected-missing",
    note: "sexual vulgarity pending high-risk false-positive review",
  },
  {
    family: "droch",
    input: "дрочила",
    status: "expected-missing",
    note: "sexual vulgarity pending high-risk false-positive review",
  },
  {
    family: "sos",
    input: "соси",
    status: "expected-missing",
    note: "short risky form pending narrow reviewed matching",
  },
  {
    family: "sos",
    input: "отсоси",
    status: "expected-missing",
    note: "prefixed risky form pending narrow reviewed matching",
  },
  {
    family: "sos",
    input: "сосать",
    status: "expected-missing",
    note: "verb form pending narrow reviewed matching",
  },
];

const expectedCoveredCases: readonly GapAuditCase[] = [
  {
    family: "yopt",
    input: "ёпт",
    status: "expected-covered",
    note: "reviewed short expletive-like form is covered",
  },
  {
    family: "yopt",
    input: "епт",
    status: "expected-covered",
    note: "reviewed yo/e variant is covered",
  },
  {
    family: "yopt",
    input: "ёпта",
    status: "expected-covered",
    note: "reviewed inflected expletive-like form is covered",
  },
  {
    family: "yopt",
    input: "епта",
    status: "expected-covered",
    note: "reviewed yo/e inflected form is covered",
  },
  {
    family: "yopt",
    input: "ептваю",
    status: "expected-covered",
    note: "reviewed phrase-like form is covered",
  },
  {
    family: "yopt",
    input: "ёптваю",
    status: "expected-covered",
    note: "reviewed yo/e phrase-like form is covered",
  },
  {
    family: "zhopa",
    input: "жопа",
    status: "expected-covered",
    note: "reviewed vulgar bodily term is covered",
  },
  {
    family: "zhopa",
    input: "жопу",
    status: "expected-covered",
    note: "reviewed case form is covered",
  },
  {
    family: "zhopa",
    input: "жопой",
    status: "expected-covered",
    note: "reviewed case form is covered",
  },
  {
    family: "zhopa",
    input: "жопный",
    status: "expected-covered",
    note: "reviewed adjective form is covered",
  },
  {
    family: "manda",
    input: "манда",
    status: "expected-covered",
    note: "reviewed anatomical form is covered",
  },
  {
    family: "manda",
    input: "манду",
    status: "expected-covered",
    note: "reviewed anatomical case form is covered",
  },
  {
    family: "manda",
    input: "мандой",
    status: "expected-covered",
    note: "reviewed anatomical case form is covered",
  },
  {
    family: "mandavosh",
    input: "мандовошь",
    status: "expected-covered",
    note: "nearby reviewed insult remains covered with wider manda forms",
  },
];

const intentionallyUnsupportedCases: readonly GapAuditCase[] = [
  {
    family: "sos false-positive locks",
    input: "сосна",
    status: "intentionally-unsupported",
    note: "neutral Russian word overlapping the short sos root",
  },
  {
    family: "sos false-positive locks",
    input: "насос",
    status: "intentionally-unsupported",
    note: "neutral Russian word overlapping the short sos root",
  },
  {
    family: "sos false-positive locks",
    input: "сосед",
    status: "intentionally-unsupported",
    note: "neutral Russian word overlapping the short sos root",
  },
  {
    family: "sos false-positive locks",
    input: "SOS",
    status: "intentionally-unsupported",
    note: "Latin acronym collision for future sos review",
  },
  {
    family: "sos false-positive locks",
    input: "Sosa",
    status: "intentionally-unsupported",
    note: "Latin name collision for future sos review",
  },
  {
    family: "droch false-positive locks",
    input: "дрожь",
    status: "intentionally-unsupported",
    note: "neutral Russian word near the droch family surface",
  },
  {
    family: "droch false-positive locks",
    input: "дрожать",
    status: "intentionally-unsupported",
    note: "neutral Russian verb near the droch family surface",
  },
  {
    family: "droch false-positive locks",
    input: "Droid",
    status: "intentionally-unsupported",
    note: "Latin technical token collision for future transliteration review",
  },
];

const coverageMetadataCases: readonly CoverageMetadataCase[] = [
  {
    input: "ёпт",
    expected: {
      ruleId: "ru.vulgar.yopt.family",
      category: "VULGAR",
      severity: "medium",
    },
  },
  {
    input: "жопа",
    expected: {
      ruleId: "ru.vulgar.zhopa.family",
      category: "VULGAR",
      severity: "medium",
    },
  },
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

describe("Russian coverage gap audit", () => {
  it("keeps candidate gap families explicitly expected missing", () => {
    for (const testCase of expectedMissingCases) {
      expect(testCase.status).toBe("expected-missing");
      expectUnchanged(testCase.input);
      expect(filter.analyze(testCase.input), testCase.note).toEqual([]);
    }
  });

  it("keeps nearby reviewed families explicitly expected covered", () => {
    for (const testCase of expectedCoveredCases) {
      expect(testCase.status).toBe("expected-covered");
      expect(filter.censor(testCase.input), testCase.note).toBe(
        mask(testCase.input),
      );
    }
  });

  it("preserves metadata for reviewed gap coverage", () => {
    for (const { input, expected } of coverageMetadataCases) {
      expect(filter.analyze(input), input).toEqual(
        expect.arrayContaining([expect.objectContaining(expected)]),
      );
    }
  });

  it("keeps high-risk neutral collisions intentionally unsupported", () => {
    for (const testCase of intentionallyUnsupportedCases) {
      expect(testCase.status).toBe("intentionally-unsupported");
      expectUnchanged(testCase.input);
      expect(filter.analyze(testCase.input), testCase.note).toEqual([]);
    }
  });
});
