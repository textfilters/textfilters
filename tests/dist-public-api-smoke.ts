import {
  createProfanityFilter,
  filter,
  PROFANITY_FILTER_NAME,
  type ProfanityCategory,
  type ProfanityFilter,
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
const strict: ProfanityFilter = createProfanityFilter(
  [
    { source: "alpha", ...metadata },
    { source: "beta", category: "VULGAR", severity: "low" },
    { source: "gamma", category: "VULGAR", severity: "medium" },
    "delta",
  ],
  [],
);
const match: ProfanityMatchRange | undefined = strict.analyze(
  "alpha beta gamma delta",
  options,
)[0];

filter.check("plain text");

if (PROFANITY_FILTER_NAME !== "profanity") {
  throw new Error("Unexpected filter name declaration.");
}

if (match?.category !== category || match.severity !== severity) {
  throw new Error("Unexpected taxonomy declaration surface.");
}
