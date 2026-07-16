import { defineProfanityLanguageProfile } from "../profile.js";

import { englishProfanityFilter } from "./index.js";

export const englishProfanityProfile = defineProfanityLanguageProfile({
  id: "en:default",
  languageTag: "en",
  filter: englishProfanityFilter,
});
