import {
  drochCoverageMetadataCases,
  drochExpectedCoveredCases,
  drochIntentionallyUnsupportedCases,
} from "./droch";
import { huyloCoverageMetadataCases, huyloExpectedCoveredCases } from "./huylo";
import {
  mandaCoverageMetadataCases,
  mandaExpectedCoveredCases,
  mandaIntentionallyUnsupportedCases,
} from "./manda";
import {
  sosCoverageMetadataCases,
  sosExpectedCoveredCases,
  sosIntentionallyUnsupportedCases,
} from "./sos";
import {
  yoptCoverageMetadataCases,
  yoptExpectedCoveredCases,
  yoptIntentionallyUnsupportedCases,
} from "./yopt";
import { zhopaCoverageMetadataCases, zhopaExpectedCoveredCases } from "./zhopa";

import type { ReviewedGapAuditCase, ReviewedGapMetadataCase } from "./types";

export const expectedCoveredCases: readonly ReviewedGapAuditCase[] = [
  ...drochExpectedCoveredCases,
  ...sosExpectedCoveredCases,
  ...huyloExpectedCoveredCases,
  ...yoptExpectedCoveredCases,
  ...zhopaExpectedCoveredCases,
  ...mandaExpectedCoveredCases,
];

export const intentionallyUnsupportedCases: readonly ReviewedGapAuditCase[] = [
  ...sosIntentionallyUnsupportedCases,
  ...drochIntentionallyUnsupportedCases,
  ...yoptIntentionallyUnsupportedCases,
  ...mandaIntentionallyUnsupportedCases,
];

export const coverageMetadataCases: readonly ReviewedGapMetadataCase[] = [
  ...drochCoverageMetadataCases,
  ...sosCoverageMetadataCases,
  ...huyloCoverageMetadataCases,
  ...yoptCoverageMetadataCases,
  ...zhopaCoverageMetadataCases,
  ...mandaCoverageMetadataCases,
];
