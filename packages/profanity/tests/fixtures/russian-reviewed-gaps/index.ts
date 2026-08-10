import {
  drochCoverageMetadataCases,
  drochExpectedCoveredCases,
  drochNeutralCollisionCases,
} from "./droch";
import { huyloCoverageMetadataCases, huyloExpectedCoveredCases } from "./huylo";
import {
  mandaCoverageMetadataCases,
  mandaExpectedCoveredCases,
  mandaNeutralCollisionCases,
} from "./manda";
import {
  sosCoverageMetadataCases,
  sosExpectedCoveredCases,
  sosNeutralCollisionCases,
} from "./sos";
import {
  yoptCoverageMetadataCases,
  yoptExpectedCoveredCases,
  yoptNeutralCollisionCases,
} from "./yopt";
import {
  zhopaCoverageMetadataCases,
  zhopaExpectedCoveredCases,
  zhopaNeutralCollisionCases,
} from "./zhopa";

import type { ReviewedGapAuditCase, ReviewedGapMetadataCase } from "./types";

export const expectedCoveredCases: readonly ReviewedGapAuditCase[] = [
  ...drochExpectedCoveredCases,
  ...sosExpectedCoveredCases,
  ...huyloExpectedCoveredCases,
  ...yoptExpectedCoveredCases,
  ...zhopaExpectedCoveredCases,
  ...mandaExpectedCoveredCases,
];

export const neutralCollisionCases: readonly ReviewedGapAuditCase[] = [
  ...sosNeutralCollisionCases,
  ...drochNeutralCollisionCases,
  ...yoptNeutralCollisionCases,
  ...zhopaNeutralCollisionCases,
  ...mandaNeutralCollisionCases,
];

export const coverageMetadataCases: readonly ReviewedGapMetadataCase[] = [
  ...drochCoverageMetadataCases,
  ...sosCoverageMetadataCases,
  ...huyloCoverageMetadataCases,
  ...yoptCoverageMetadataCases,
  ...zhopaCoverageMetadataCases,
  ...mandaCoverageMetadataCases,
];
