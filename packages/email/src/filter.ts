import { censorCodePointRanges, normalizeTextInput } from "@textfilters/core";

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
  const maskChar = options.maskChar ?? "*";

  return {
    name: EMAIL_FILTER_NAME,
    censor(text) {
      const source = normalizeTextInput(text);
      if (!source) return source;
      const codePoints = Array.from(source);
      const ranges = scanner.scan({ text: source, codePoints }).ranges;
      return censorCodePointRanges(codePoints, ranges, maskChar);
    },
  };
}

export function emailFilter(options?: EmailFilterOptions): EmailFilter {
  return createEmailFilter(options);
}

export const filter = createEmailFilter();
