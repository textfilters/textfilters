import { validateProfanityLanguageDictionary } from "../../../src/index.js";

import { englishProfanityDictionary } from "./dictionary.js";
import { createEnglishProfanityFilter } from "./filter.js";

const validationIssues = validateProfanityLanguageDictionary(
  englishProfanityDictionary,
);

if (validationIssues.length > 0) {
  throw new Error(JSON.stringify(validationIssues, null, 2));
}

export { englishProfanityDictionary };
export { createEnglishProfanityFilter };
export const englishProfanityFilter = createEnglishProfanityFilter();
