import { createProfanityFilterFromDictionary, filter } from "../filter.js";
import { russianProfanityDictionary } from "../languages/ru/index.js";

export { russianProfanityDictionary };
export { russianProfanityDictionary as dictionary };
export { filter as russianProfanityFilter };
export { filter };

export const createRussianProfanityFilter = () =>
  createProfanityFilterFromDictionary(russianProfanityDictionary);
export const createFilter = createRussianProfanityFilter;
export {
  russianProfanityProfile,
  russianProfanityProfile as profile,
} from "../languages/ru/profile.js";
