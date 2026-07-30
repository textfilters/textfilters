import { expect } from "vitest";

import { filter } from "../src";

import { mask } from "./helpers";

export const ZERO_WIDTH = "\u200B";
export const ZWNJ = "\u200C";
export const ZWJ = "\u200D";
export const WORD_JOINER = "\u2060";
export const BOM = "\uFEFF";
export const COMBINING_ACUTE = "\u0301";
export const COMBINING_LONG_STROKE = "\u0336";
export const COMBINING_TILDE_OVERLAY = "\u0334";

export const expectFullyMasked = (input: string): void => {
  expect(filter.censor(input), input).toBe(mask(input));
};

export const expectUnchanged = (input: string): void => {
  expect(filter.censor(input), input).toBe(input);
};
