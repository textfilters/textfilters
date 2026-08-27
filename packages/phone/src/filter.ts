import { createTextFilterFromScanner } from "@textfilters/core";

import {
  PHONE_FILTER_NAME,
  type PhoneFilter,
  type PhoneFilterConfig,
} from "./contracts.js";
import { createPhoneScanner } from "./public-scanner.js";

export function createPhoneFilter(config: PhoneFilterConfig = {}): PhoneFilter {
  return createTextFilterFromScanner(
    PHONE_FILTER_NAME,
    createPhoneScanner(),
    config.maskChar,
  );
}

export const phoneFilter = createPhoneFilter;
export const filter = createPhoneFilter();
