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
};
const metadata: ProfanityTaxonomyMetadata = {
  category,
  severity,
};
const strict: ProfanityFilter = createProfanityFilter(
  [{ source: "alpha", ...metadata }],
  [],
);
const match: ProfanityMatchRange | undefined = strict.analyze(
  "alpha",
  options,
)[0];

filter.check("plain text");

if (PROFANITY_FILTER_NAME !== "profanity") {
  throw new Error("Unexpected filter name declaration.");
}

if (match?.category !== category || match.severity !== severity) {
  throw new Error("Unexpected taxonomy declaration surface.");
}
