import { describe, expect, it } from "vitest";
import * as core from "../src/index.js";

describe("textfilters core public entrypoint", () => {
  it("keeps the runtime export surface stable", () => {
    expect(Object.keys(core).sort()).toEqual([
      "censorCodePointRanges",
      "checkTextRanges",
      "combineFilters",
      "createCachedTextProcessor",
      "createPreparedText",
      "createTextFilterFromScanner",
      "createTextHints",
      "createTextPipeline",
      "createTextRangePipeline",
      "createTextRangeScanResult",
      "createTextScanInput",
      "lowerNfkc",
      "maskCodePointRanges",
      "maskCodePointRangesPreservingLength",
      "maskRange",
      "maskRanges",
      "maskUtf16Ranges",
      "mergeCodePointRanges",
      "mergeRanges",
      "normalizeLengthPreservingMaskChar",
      "normalizeMaskChar",
      "normalizeTextInput",
      "normalizeVisibleMaskChar",
      "runTextRangeScanner",
      "scanPreparedTextRanges",
      "scanTextRanges",
      "stripZeroWidth",
      "toCodePoints",
    ]);
  });
});
