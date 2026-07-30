import { type TextCodePointRange } from "@textfilters/core";

import { type EmailTextMeta } from "../../normalization.js";
import { type EmailCandidate, type ScannerOptions } from "../core/types.js";
import {
  hasLeadingBoundary,
  hasTrailingBoundary,
  isValidDomain,
  isValidLocal,
} from "../rules/validators.js";
import { isExcludedAddress } from "../rules/exclusions.js";
import { nextContent, previousContent } from "./boundary.js";

export const isCandidateMatchable = (
  meta: EmailTextMeta,
  candidate: EmailCandidate,
  options: ScannerOptions,
): boolean => {
  if (!isValidLocal(candidate.local)) return false;
  if (!isValidDomain(candidate.labels, options)) return false;
  if (!hasLeadingBoundary(previousContent(meta, candidate.start - 1))) {
    return false;
  }
  if (!hasTrailingBoundary(nextContent(meta, candidate.end))) return false;
  return true;
};

export const isCandidateExcluded = (
  candidate: EmailCandidate,
  options: ScannerOptions,
): boolean => isExcludedAddress(candidate.local, candidate.labels, options);

export const collectCandidateRange = (
  meta: EmailTextMeta,
  candidate: EmailCandidate,
  options: ScannerOptions,
): TextCodePointRange | null => {
  if (!isCandidateMatchable(meta, candidate, options)) return null;
  if (isCandidateExcluded(candidate, options)) return null;
  return [candidate.start, candidate.end];
};
