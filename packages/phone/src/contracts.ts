import type { TextFilter } from "@textfilters/core";

export interface PhoneFilter extends TextFilter {
  readonly name: "phone";
}

export type CodePointRange = readonly [start: number, end: number];
