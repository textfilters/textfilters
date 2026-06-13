import {
  createProfanityFilterFromDictionary,
  validateProfanityLanguageDictionary,
} from "@textfilters/profanity";

import { zzProfanityDictionary } from "./dictionary.js";

const validationIssues = validateProfanityLanguageDictionary(
  zzProfanityDictionary,
);

if (validationIssues.length > 0) {
  throw new Error(JSON.stringify(validationIssues, null, 2));
}

export { zzProfanityDictionary };
export const zzProfanityFilter = createProfanityFilterFromDictionary(
  zzProfanityDictionary,
);
