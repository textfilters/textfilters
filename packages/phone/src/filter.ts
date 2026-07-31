import { censorCodePointRanges, normalizeTextInput } from "@textfilters/core";

import {
  PHONE_FILTER_NAME,
  type PhoneFilter,
  type PhoneFilterConfig,
} from "./contracts.js";
import { scanPhoneRanges } from "./public-scanner.js";

export function createPhoneFilter(config: PhoneFilterConfig = {}): PhoneFilter {
  const maskChar = config.maskChar ?? "*";

  return {
    name: PHONE_FILTER_NAME,
    censor(text) {
      const source = normalizeTextInput(text);
      if (!source) return source;
      const codePoints = Array.from(source);
      const ranges = scanPhoneRanges(source);
      return censorCodePointRanges(codePoints, ranges, maskChar);
    },
  };
}

export const phoneFilter = createPhoneFilter;
export const filter = createPhoneFilter();
