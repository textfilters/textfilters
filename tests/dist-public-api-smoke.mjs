import {
  createProfanityFilter,
  filter,
  PROFANITY_FILTER_NAME,
} from "../dist/index.js";

const strict = createProfanityFilter(
  [{ source: "alpha", category: "OBSCENE_MAT", severity: "high" }],
  [],
);
const input = "alpha beta";

if (PROFANITY_FILTER_NAME !== "profanity") {
  throw new Error("Unexpected filter name export.");
}

if (!filter.check("привет блядь")) {
  throw new Error("Default dist filter did not detect a built-in match.");
}

if (strict.censor(input, { categories: ["OBSCENE_MAT"] }) !== "***** beta") {
  throw new Error("Dist taxonomy category filtering failed.");
}

if (strict.check(input, { severities: ["low"] })) {
  throw new Error("Dist taxonomy severity filtering failed.");
}

if (strict.censor(input, { minSeverity: "high" }) !== "***** beta") {
  throw new Error("Dist minimum taxonomy severity filtering failed.");
}

if (strict.analyze(input, { categories: [] }).length !== 0) {
  throw new Error("Dist empty taxonomy filter handling failed.");
}
