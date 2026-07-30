import { mergeRanges, type TextCodePointRange } from "@textfilters/core";
import {
  analyzePreparedProfanity,
  canStreamProfanityMatches,
  checkPreparedProfanity,
  createPreparedProfanityInput,
  filter as sharedProfanityFilter,
  streamPreparedProfanityMatches,
  type PreparedProfanityInput,
} from "./filter.js";
import { PROFANITY_FILTER_NAME } from "./types.js";
import type {
  ProfanityScanInput,
  ProfanityRangeMatchSink,
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
  const allocationAware = canStreamProfanityMatches(activeFilter);

  function scan(input: ProfanityScanInput): ProfanityScannerOutput;
  function scan(
    input: ProfanityScanInput,
    sink: ProfanityRangeMatchSink,
  ): boolean;
  function scan(input: ProfanityScanInput, sink?: ProfanityRangeMatchSink) {
    const prepared = createPreparedProfanityInput(input.text, input);
    if (sink === undefined) {
      return scanProfanity(activeFilter, input, prepared, matchOptions);
    }

    return scanProfanityMatches(
      activeFilter,
      input,
      prepared,
      matchOptions,
      sink,
    );
  }

  const scanner: ProfanityScanner = {
    name: PROFANITY_FILTER_NAME,
    check: (input) => {
      if (
        allocationAware &&
        input.text.length === 0 &&
        input.hints?.textLength === 0
      ) {
        return false;
      }

      const prepared = createPreparedProfanityInput(input.text, input);
      return (
        checkPreparedProfanity(activeFilter, prepared, matchOptions) ??
        activeFilter.check(input.text, matchOptions)
      );
    },
    scan,
  };

  if (allocationAware) {
    return { ...scanner, allocationAware: true };
  }

  return scanner;
}

function scanProfanity(
  filter: ReadonlyProfanityFilter,
  input: ProfanityScanInput,
  prepared: PreparedProfanityInput,
  matchOptions: ProfanityScannerOptions["matchOptions"],
): ProfanityScannerOutput {
  const matches =
    analyzePreparedProfanity(filter, prepared, matchOptions) ??
    filter.analyze(input.text, matchOptions);
  const codePointIndexByUtf16Offset = createCodePointIndexByUtf16Offset(
    input.codePoints,
  );
  const codePointIndexForUtf16Offset = (offset: number) =>
    codePointIndexByUtf16Offset[offset] ?? input.codePoints.length;
  const ranges = mergeRanges(
    matches.map(
      (match): TextCodePointRange => [
        codePointIndexForUtf16Offset(match[0]),
        codePointIndexForUtf16Offset(match[1]),
      ],
    ),
  );

  return {
    ranges,
    metadata: {
      matches,
    },
  };
}

function scanProfanityMatches(
  filter: ReadonlyProfanityFilter,
  input: ProfanityScanInput,
  prepared: PreparedProfanityInput,
  matchOptions: ProfanityScannerOptions["matchOptions"],
  sink: ProfanityRangeMatchSink,
): boolean {
  const codePointIndexByUtf16Offset = createUtf16OffsetToCodePointIndex(
    input.codePoints,
  );
  const streamed = streamPreparedProfanityMatches(
    filter,
    prepared,
    matchOptions,
    (match) => {
      const range = matchToCodePointRange(match, codePointIndexByUtf16Offset);
      return sink({ range, match });
    },
  );

  if (streamed !== undefined) return streamed;

  const matches = filter.analyze(input.text, matchOptions);

  for (const match of matches) {
    const range = matchToCodePointRange(match, codePointIndexByUtf16Offset);
    if (sink({ range, match }) === false) return false;
  }

  return true;
}

function matchToCodePointRange(
  match: readonly [number, number],
  codePointIndexByUtf16Offset: (offset: number) => number,
): TextCodePointRange {
  return [
    codePointIndexByUtf16Offset(match[0]),
    codePointIndexByUtf16Offset(match[1]),
  ];
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

function createUtf16OffsetToCodePointIndex(
  codePoints: readonly string[],
): (offset: number) => number {
  const codePointIndexByUtf16Offset: number[] = [0];
  let codePointIndex = 0;
  let utf16Offset = 0;

  return (offset) => {
    const cached = codePointIndexByUtf16Offset[offset];
    if (cached !== undefined) return cached;

    while (utf16Offset < offset && codePointIndex < codePoints.length) {
      utf16Offset += codePoints[codePointIndex].length;
      codePointIndex++;
      codePointIndexByUtf16Offset[utf16Offset] = codePointIndex;
    }

    return utf16Offset === offset ? codePointIndex : codePoints.length;
  };
}
