import {
  compileProfanityDictionary,
  composeProfanityProfiles,
  createCustomProfanityFilter,
  createEnglishProfanityFilter,
  createProfanityFilter,
  createProfanityFilterFromCompiledDictionary,
  createProfanityFilterFromDictionary,
  createProfanityScanner,
  englishProfanityDictionary,
  englishProfanityFilter,
  filter,
  PROFANITY_FILTER_NAME,
  russianProfanityDictionary,
} from "../dist/index.js";
import {
  createFilter as createEnglishFilter,
  dictionary as englishDictionaryFromEntrypoint,
  filter as englishFilterFromEntrypoint,
  profile as englishProfile,
} from "@textfilters/profanity/en";
import {
  createFilter as createRussianFilter,
  dictionary as russianDictionaryFromEntrypoint,
  filter as russianFilterFromEntrypoint,
  profile as russianProfile,
} from "@textfilters/profanity/ru";

const strict = createProfanityFilter(
  [
    { source: "alpha", category: "OBSCENE_MAT", severity: "high" },
    { source: "beta", category: "VULGAR", severity: "low" },
    { source: "gamma", category: "VULGAR", severity: "medium" },
    "delta",
  ],
  [],
);
const dictionaryFilter = createProfanityFilterFromDictionary(
  russianProfanityDictionary,
);
const compiledDictionary = compileProfanityDictionary(
  russianProfanityDictionary,
);
const compiledDictionaryFilter =
  createProfanityFilterFromCompiledDictionary(compiledDictionary);
const input = "alpha beta gamma delta";
const configuredFilter = composeProfanityProfiles([
  russianProfile,
  englishProfile,
]);
const customFilter = createCustomProfanityFilter({ strict: ["custom"] });

if (PROFANITY_FILTER_NAME !== "profanity") {
  throw new Error("Unexpected filter name export.");
}

if (!filter.check("привет блядь")) {
  throw new Error("Default dist filter did not detect a built-in match.");
}

if (configuredFilter.censor("бля shit") !== "*** ****") {
  throw new Error("Dist configured language profiles did not compose.");
}

if (
  configuredFilter.analyze("shit")[0]?.profileId !== "en:default" ||
  createProfanityScanner({ filter: configuredFilter }).allocationAware !== true
) {
  throw new Error("Dist profile provenance or streaming was not exported.");
}

if (
  !customFilter.check("custom") ||
  englishDictionaryFromEntrypoint !== englishProfanityDictionary ||
  englishFilterFromEntrypoint !== englishProfanityFilter ||
  !createEnglishFilter().check("shit") ||
  russianDictionaryFromEntrypoint !== russianProfanityDictionary ||
  russianFilterFromEntrypoint !== filter ||
  !createRussianFilter().check("бля")
) {
  throw new Error("Dist language entrypoints were not exported symmetrically.");
}

if (
  englishProfanityDictionary.language !== "en" ||
  !englishProfanityFilter.check("fucking") ||
  "addStrict" in englishProfanityFilter
) {
  throw new Error("Dist English language pack was not exported read-only.");
}

if (
  englishProfanityFilter.analyze("shit")[0]?.ruleId !== "en.vulgar.shit" ||
  englishProfanityFilter.analyze("shit")[0]?.category !== "VULGAR" ||
  englishProfanityFilter.analyze("shit")[0]?.severity !== "low" ||
  englishProfanityFilter.analyze("dickhead")[0]?.ruleId !== "en.insult.dickhead"
) {
  throw new Error("Dist English taxonomy metadata failed.");
}

const mutableEnglishFilter = createEnglishProfanityFilter();
mutableEnglishFilter.addStrict("tenant-only-term");

if (!mutableEnglishFilter.check("tenant-only-term")) {
  throw new Error(
    "Dist English filter factory did not return a mutable filter.",
  );
}

if (!dictionaryFilter.check("привет блядь")) {
  throw new Error("Dist dictionary filter did not detect a built-in match.");
}

if (!compiledDictionaryFilter.check("привет блядь")) {
  throw new Error(
    "Dist compiled dictionary filter did not detect a built-in match.",
  );
}

if (
  compiledDictionary.language !== "ru" ||
  compiledDictionary.normalization !== "cyrillic-homoglyphs" ||
  compiledDictionary.strictRuleCount === 0 ||
  compiledDictionary.looseRuleCount === 0
) {
  throw new Error("Dist compiled dictionary metadata was not exported.");
}

if (
  dictionaryFilter.analyze("бля")[0]?.ruleId !== "ru.obscene.blya" ||
  dictionaryFilter.analyze("бля")[0]?.category !== "OBSCENE_MAT" ||
  dictionaryFilter.analyze("бля")[0]?.severity !== "high"
) {
  throw new Error("Dist dictionary filter did not preserve metadata.");
}

if (
  strict.censor(input, { categories: ["OBSCENE_MAT"] }) !==
  "***** beta gamma delta"
) {
  throw new Error("Dist taxonomy category filtering failed.");
}

if (strict.check(input, { categories: ["OBSCENE_MAT"], severities: ["low"] })) {
  throw new Error("Dist taxonomy category and severity intersection failed.");
}

if (strict.check(input, { severities: ["soft"] })) {
  throw new Error("Dist taxonomy severity filtering failed.");
}

if (
  strict.censor(input, { minSeverity: "high" }) !== "***** beta gamma delta"
) {
  throw new Error("Dist minimum taxonomy severity filtering failed.");
}

if (
  strict.censor(input, {
    categories: ["VULGAR"],
    minSeverity: "medium",
  }) !== "alpha beta ***** delta"
) {
  throw new Error(
    "Dist taxonomy category and minimum severity intersection failed.",
  );
}

if (
  strict.censor(input, {
    severities: ["low", "medium"],
    minSeverity: "medium",
  }) !== "alpha beta ***** delta"
) {
  throw new Error(
    "Dist taxonomy severity set and minimum severity intersection failed.",
  );
}

if (strict.analyze(input, { categories: [] }).length !== 0) {
  throw new Error("Dist empty taxonomy filter handling failed.");
}
