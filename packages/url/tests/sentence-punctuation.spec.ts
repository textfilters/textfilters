import { describe, expect, it } from "vitest";

import { isClosedSentenceBoundary } from "../src/dots.js";
import { createMeta, type TextMeta } from "../src/meta.js";

describe("sentence punctuation contract", () => {
  it("depends on punctuation rather than the preceding label spelling", () => {
    for (const label of ["b", "b-", "e\u0301", "x_", "Ω+="]) {
      for (const left of ["", ")", " \u200b〉", "]", " > "]) {
        for (const dots of [
          ".",
          "..",
          "...",
          "‥",
          "…",
          "．。",
          ".\u200b.\ufe0f.",
        ]) {
          for (const right of ["", ")", "]", ">", "」"]) {
            for (const space of [
              "",
              " ",
              "\t",
              "\n",
              "\u00a0",
              "\u200b \ufe0f",
            ]) {
              const text = `${label}${left}${dots}${right}${space}tail`;
              const start = Array.from(label + left).length;
              expect(
                isClosedSentenceBoundary(createMeta(text), {
                  start,
                  end: start + 1,
                  pos: start + 1,
                }),
                text,
              ).toBe(space !== "" && (left !== "" || right !== ""));
            }
          }
        }
      }
    }
  });

  it.each([
    ["", ""],
    [")", ""],
    [" > \u200b", ""],
    ["", ")"],
  ])(
    "bounds repeated inspection of long punctuation runs between %j and %j",
    (leftCloser, rightCloser) => {
      const measure = (length: number): number => {
        const prefix = `b${leftCloser}`;
        const unit = ".\u200b \ufe0f";
        const meta = createMeta(
          `${prefix}${unit.repeat(length)}${rightCloser}tail`,
        );
        let reads = 0;
        const track = <T>(values: readonly T[]): readonly T[] =>
          new Proxy(values, {
            get(target, key, receiver) {
              if (typeof key === "string" && /^\d+$/.test(key)) reads++;
              return Reflect.get(target, key, receiver);
            },
          });
        const tracked: TextMeta = {
          ...meta,
          codePoints: track(meta.codePoints),
          raw: track(meta.raw),
          symbol: track(meta.symbol),
          whitespace: track(meta.whitespace),
          zeroWidth: track(meta.zeroWidth),
        };
        const start = Array.from(prefix).length;
        let boundaries = 0;
        for (let i = 0; i < length; i++) {
          const pos = start + i * Array.from(unit).length;
          if (
            isClosedSentenceBoundary(tracked, {
              start: pos,
              end: pos + 1,
              pos: pos + 1,
            })
          )
            boundaries++;
        }
        expect(boundaries).toBe(
          leftCloser === "" && rightCloser === "" ? 0 : 1,
        );
        return reads;
      };
      const small = measure(512);
      const large = measure(1024);
      expect(large).toBeLessThan(small * 2.1);
    },
  );
});
