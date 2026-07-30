import { describe, expect, it } from "vitest";
import { mergeCodePointRanges, mergeRanges } from "../src/index.js";

describe("textfilters core range helpers", () => {
  it("sorts and merges overlapping or adjacent ranges", () => {
    expect(
      mergeRanges([
        [5, 8],
        [1, 3],
        [3, 5],
        [20, 21],
      ]),
    ).toEqual([
      [1, 8],
      [20, 21],
    ]);
  });

  it("ignores invalid ranges", () => {
    expect(
      mergeRanges([
        [3, 3],
        [5, 1],
        [1, 2],
      ]),
    ).toEqual([[1, 2]]);
  });

  it("sorts and merges code point ranges", () => {
    expect(
      mergeCodePointRanges([
        [5, 7],
        [1, 3],
        [3, 4],
        [10.8, 10.2],
      ]),
    ).toEqual([
      [1, 4],
      [5, 7],
    ]);
  });
});
