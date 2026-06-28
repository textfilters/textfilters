import type { TextCodePointRange } from "@textfilters/core";
import { filter as sharedProfanityFilter } from "./filter.js";
import { PROFANITY_FILTER_NAME } from "./types.js";
import type {
  ProfanityScanInput,
  ProfanityScanner,
  ProfanityScannerOptions,
  ProfanityScannerOutput,
  ReadonlyProfanityFilter,
} from "./types.js";

export function createProfanityScanner(
  options: ProfanityScannerOptions = {},
): ProfanityScanner {
  const activeFilter = options.filter ?? sharedProfanityFilter;
  const matchOptions = options.matchOptions;

  return {
    name: PROFANITY_FILTER_NAME,
    scan: (input) => scanProfanity(activeFilter, input, matchOptions),
  };
}

function scanProfanity(
  filter: ReadonlyProfanityFilter,
  input: ProfanityScanInput,
  matchOptions: ProfanityScannerOptions["matchOptions"],
): ProfanityScannerOutput {
  const matches = filter.analyze(input.text, matchOptions);
  const codePointIndexByUtf16Offset = createCodePointIndexByUtf16Offset(
    input.codePoints,
  );
  const ranges = matches.map(
    (match): TextCodePointRange => [
      codePointIndexByUtf16Offset[match[0]] ?? input.codePoints.length,
      codePointIndexByUtf16Offset[match[1]] ?? input.codePoints.length,
    ],
  );

  return {
    ranges,
    metadata: {
      matches,
    },
  };
}

function createCodePointIndexByUtf16Offset(
  codePoints: readonly string[],
): readonly number[] {
  const codePointIndexByUtf16Offset: number[] = [];
  let utf16Offset = 0;

  for (const [index, codePoint] of codePoints.entries()) {
    codePointIndexByUtf16Offset[utf16Offset] = index;
    utf16Offset += codePoint.length;
  }

  codePointIndexByUtf16Offset[utf16Offset] = codePoints.length;

  return codePointIndexByUtf16Offset;
}
