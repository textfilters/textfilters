import {
  PROFANITY_FILTER_NAME,
  type ProfanityFilter,
  type ProfanityMatchOptions,
  type ReadonlyProfanityFilter,
} from "../../types.js";

import { englishProfanityDictionary } from "./dictionary.js";
import { createEnglishProfanityFilter } from "./filter.js";

let sharedEnglishFilter: ProfanityFilter | undefined;

function getSharedEnglishFilter(): ProfanityFilter {
  sharedEnglishFilter ??= createEnglishProfanityFilter();
  return sharedEnglishFilter;
}

export { englishProfanityDictionary };
export { createEnglishProfanityFilter };

export const englishProfanityFilter: ReadonlyProfanityFilter = Object.freeze({
  name: PROFANITY_FILTER_NAME,
  analyze: (text: unknown, options?: ProfanityMatchOptions) =>
    getSharedEnglishFilter().analyze(text, options),
  check: (text: unknown, options?: ProfanityMatchOptions) =>
    getSharedEnglishFilter().check(text, options),
  censor: (text: unknown, options?: ProfanityMatchOptions) =>
    getSharedEnglishFilter().censor(text, options),
});
