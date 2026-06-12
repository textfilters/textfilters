import { expect } from "vitest";

import type { ProfanityLanguageDictionary } from "../src/languages/profanity.js";
import { validateProfanityLanguageDictionary } from "../src/index.js";

export const assertLanguageDictionaryInvariants = (
  dictionary: ProfanityLanguageDictionary,
): void => {
  expect(validateProfanityLanguageDictionary(dictionary)).toEqual([]);
};

export const assertLanguagePackDictionaryContract = (
  dictionary: ProfanityLanguageDictionary,
): void => {
  expect(validateProfanityLanguageDictionary(dictionary)).toEqual([]);
};
