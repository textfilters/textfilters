import { filter } from "../../filter.js";
import { defineProfanityLanguageProfile } from "../profile.js";

export const russianProfanityProfile = defineProfanityLanguageProfile({
  id: "ru:default",
  languageTag: "ru",
  filter,
});
