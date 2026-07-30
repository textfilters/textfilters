import { describe, expect, it } from "vitest";
import * as core from "../src/index.js";

describe("textfilters core public entrypoint", () => {
  it("keeps the runtime export surface stable", () => {
    expect(Object.keys(core).sort()).toEqual([
      "censorCodePointRanges",
      "checkTextRanges",
      "createCachedTextProcessor",
      "createPreparedText",
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
