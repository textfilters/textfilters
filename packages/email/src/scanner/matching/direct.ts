import { type TextCodePointRange } from "@textfilters/core";

import {
  isAsciiAlphaNumeric,
  type EmailTextMeta,
} from "../../normalization.js";
import {
  SCANNER_PUNCTUATION,
  TOKEN_VALUE,
  type ScannerOptions,
} from "../core/types.js";
import { isLocalChar } from "../rules/validators.js";
import { collectCandidateRange } from "./candidate.js";

export const collectDirectEmailRange = (
  meta: EmailTextMeta,
  atIndex: number,
  options: ScannerOptions,
): TextCodePointRange | null => {
  // Literal addresses stay independent from tokenization so direct
  // `user@example.com` matching remains the small scanner path.
  let localStart = atIndex - 1;
  while (
    localStart >= 0 &&
    !meta.zeroWidth[localStart] &&
    isLocalChar(meta.normalized[localStart])
  ) {
    localStart--;
  }
  localStart++;

  let domainEnd = atIndex + 1;
  while (
    domainEnd < meta.normalized.length &&
    !meta.zeroWidth[domainEnd] &&
    (isAsciiAlphaNumeric(meta.normalized[domainEnd]) ||
      meta.normalized[domainEnd] === SCANNER_PUNCTUATION.hyphen ||
      meta.normalized[domainEnd] === TOKEN_VALUE.dotSymbol)
  ) {
    domainEnd++;
  }
  while (
    domainEnd > atIndex + 1 &&
    meta.normalized[domainEnd - 1] === TOKEN_VALUE.dotSymbol
  ) {
    domainEnd--;
  }

  const local = meta.normalized.slice(localStart, atIndex).join("");
  const domain = meta.normalized.slice(atIndex + 1, domainEnd).join("");
  const labels = domain.split(TOKEN_VALUE.dotSymbol);

  return collectCandidateRange(
    meta,
    {
      kind: "direct",
      local,
      labels,
      start: localStart,
      end: domainEnd,
    },
    options,
  );
};
