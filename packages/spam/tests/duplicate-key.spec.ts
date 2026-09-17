import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createDuplicateKey } from "../src/duplicate-key.js";

describe("bounded duplicate keys", () => {
  it("matches standard SHA-256 of exact UTF-16LE across block boundaries", () => {
    for (const length of [
      513, 539, 540, 543, 544, 571, 572, 575, 576, 1023, 1024, 1025, 65_537,
    ]) {
      for (const suffix of ["", "😀", "\ud800", "\ud801", "\udc00", "\ufffd"]) {
        const text = "x".repeat(length) + suffix;
        expect(createDuplicateKey(text)).toBe(
          "sha256:" +
            createHash("sha256").update(text, "utf16le").digest("hex"),
        );
      }
    }
  });

  it("separates literal and digest keys and bounds both representations", () => {
    const digest = createDuplicateKey("x".repeat(100_000));
    expect(digest.length).toBe(71);
    expect(createDuplicateKey(digest)).not.toBe(digest);
    expect(createDuplicateKey("x".repeat(512)).length).toBe(517);
    expect(
      new Set(
        ["\ud800", "\ud801", "\udc00", "\ufffd"].map((suffix) =>
          createDuplicateKey("x".repeat(512) + suffix),
        ),
      ).size,
    ).toBe(4);
  });
});
