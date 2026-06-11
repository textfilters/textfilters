import {
  createProfanityFilter,
  createProfanityFilterFromDictionary,
  filter,
  PROFANITY_FILTER_NAME,
  russianProfanityDictionary,
  type ProfanityCategory,
  type ProfanityFilter,
  type ProfanityLanguageDictionary,
  type ProfanityLanguageRuleDefinition,
  type ProfanityMatchOptions,
  type ProfanityMatchRange,
  type ProfanitySeverity,
  type ProfanityTaxonomyMetadata,
} from "../dist/index.js";

const category: ProfanityCategory = "OBSCENE_MAT";
const severity: ProfanitySeverity = "high";
const options: ProfanityMatchOptions = {
  categories: [category],
  severities: [severity],
  minSeverity: "medium",
};
const metadata: ProfanityTaxonomyMetadata = {
  category,
  severity,
};
const dictionary: ProfanityLanguageDictionary = russianProfanityDictionary;
const dictionaryRule: ProfanityLanguageRuleDefinition | undefined =
  dictionary.rules[0];
const strict: ProfanityFilter = createProfanityFilter(
  [
    { source: "alpha", ...metadata },
    { source: "beta", category: "VULGAR", severity: "low" },
    { source: "gamma", category: "VULGAR", severity: "medium" },
    "delta",
  ],
  [],
);
const dictionaryFilter: ProfanityFilter =
  createProfanityFilterFromDictionary(dictionary);
const match: ProfanityMatchRange | undefined = strict.analyze(
  "alpha beta gamma delta",
  options,
)[0];

filter.check("plain text");
dictionaryFilter.check("plain text");

if (PROFANITY_FILTER_NAME !== "profanity") {
  throw new Error("Unexpected filter name declaration.");
}

if (dictionaryRule?.source === undefined) {
  throw new Error("Unexpected dictionary rule declaration surface.");
}

if (match?.category !== category || match.severity !== severity) {
  throw new Error("Unexpected taxonomy declaration surface.");
}
