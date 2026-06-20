import {
  compileProfanityDictionary,
  createProfanityFilter,
  createProfanityFilterFromCompiledDictionary,
  createProfanityFilterFromDictionary,
  filter,
  PROFANITY_FILTER_NAME,
  russianProfanityDictionary,
} from "../dist/index.js";

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

if (PROFANITY_FILTER_NAME !== "profanity") {
  throw new Error("Unexpected filter name export.");
}

if (!filter.check("привет блядь")) {
  throw new Error("Default dist filter did not detect a built-in match.");
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
  compiledDictionary.strictRuleCount === 0 ||
  compiledDictionary.looseRuleCount === 0
) {
  throw new Error("Dist compiled dictionary metadata was not exported.");
}

if (
  dictionaryFilter.analyze("бля")[0]?.ruleId !== "ru.obscene.blya" ||
  dictionaryFilter.analyze("бля")[0]?.category !== "OBSCENE_MAT"
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
