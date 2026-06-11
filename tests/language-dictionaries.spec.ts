import { describe, it } from "vitest";

import { RUSSIAN_PROFANITY_DICTIONARY } from "../src/languages/ru/index.js";
import { assertLanguageDictionaryInvariants } from "./language-dictionary-helpers.js";

const LANGUAGE_DICTIONARIES = [RUSSIAN_PROFANITY_DICTIONARY] as const;

describe("language dictionaries", () => {
  it.each(LANGUAGE_DICTIONARIES)(
    "keeps the $language dictionary human-maintained and schema-valid",
    (dictionary) => {
      assertLanguageDictionaryInvariants(dictionary);
    },
  );
});
