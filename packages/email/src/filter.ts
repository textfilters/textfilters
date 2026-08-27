import { createTextFilterFromScanner } from "@textfilters/core";

import { createEmailScanner } from "./scanner.js";
import {
  EMAIL_FILTER_NAME,
  type EmailFilter,
  type EmailFilterOptions,
} from "./types.js";

export function createEmailFilter(
  options: EmailFilterOptions = {},
): EmailFilter {
  const scanner = createEmailScanner(options);
  return createTextFilterFromScanner(
    EMAIL_FILTER_NAME,
    scanner,
    options.maskChar,
  );
}

export function emailFilter(options?: EmailFilterOptions): EmailFilter {
  return createEmailFilter(options);
}

export const filter = createEmailFilter();
