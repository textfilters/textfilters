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

const expectedMissingCases: readonly GapAuditCase[] = [
  {
    family: "yopt",
    input: "ёпт",
    status: "expected-missing",
    note: "short expletive-like form pending reviewed taxonomy and neutral collision checks",
  },
  {
    family: "yopt",
    input: "епт",
    status: "expected-missing",
    note: "yo/e variant pending reviewed taxonomy and neutral collision checks",
  },
  {
    family: "yopt",
    input: "ёпта",
    status: "expected-missing",
    note: "inflected expletive-like form pending reviewed coverage",
  },
  {
    family: "yopt",
    input: "епта",
    status: "expected-missing",
    note: "yo/e inflected form pending reviewed coverage",
  },
  {
    family: "yopt",
    input: "ептваю",
    status: "expected-missing",
    note: "phrase-like form pending reviewed coverage",
  },
  {
    family: "yopt",
    input: "ёптваю",
    status: "expected-missing",
    note: "yo/e phrase-like form pending reviewed coverage",
  },
  {
    family: "zhopa",
    input: "жопа",
    status: "expected-missing",
    note: "vulgar bodily term pending positive tests and neutral-word locks",
  },
  {
    family: "zhopa",
    input: "жопу",
    status: "expected-missing",
    note: "case form pending positive tests and neutral-word locks",
  },
  {
    family: "zhopa",
    input: "жопой",
    status: "expected-missing",
    note: "case form pending positive tests and neutral-word locks",
  },
  {
    family: "zhopa",
    input: "жопный",
    status: "expected-missing",
    note: "adjective form pending positive tests and neutral-word locks",
  },
  {
    family: "manda",
    input: "манда",
    status: "expected-missing",
    note: "wider anatomical form pending separate reviewed coverage",
  },
  {
    family: "manda",
    input: "манду",
    status: "expected-missing",
    note: "wider anatomical case form pending separate reviewed coverage",
  },
  {
    family: "manda",
    input: "мандой",
    status: "expected-missing",
    note: "wider anatomical case form pending separate reviewed coverage",
  },
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
    family: "mandavosh",
    input: "мандовошь",
    status: "expected-covered",
    note: "nearby reviewed insult remains covered while wider manda forms stay missing",
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
      expect(filter.analyze(testCase.input)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: "ru.insult.mandavosh.family",
            category: "STRONG_INSULT",
            severity: "high",
          }),
        ]),
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
