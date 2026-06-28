import type { TextCodePointRange } from "@textfilters/core";
import {
  compileProfanityDictionary,
  createProfanityFilter,
  createProfanityFilterFromCompiledDictionary,
  createProfanityFilterFromDictionary,
  createProfanityScanner,
  filter,
  PROFANITY_FILTER_NAME,
  russianProfanityDictionary,
  type CompiledProfanityDictionary,
  validateProfanityLanguageDictionary,
  type ProfanityCategory,
  type ProfanityFilter,
  type ProfanityLanguageDictionary,
  type ProfanityLanguageDictionaryValidationIssue,
  type ProfanityLanguageRuleDefinition,
  type ProfanityMatchOptions,
  type ProfanityMatchRange,
  type ProfanityScanner,
  type ProfanityScannerMetadata,
  type ProfanityScannerOptions,
  type ProfanityScannerOutput,
  type ProfanitySeverity,
  type ProfanityTaxonomyMetadata,
  type ReadonlyProfanityFilter,
} from "../dist/index.js";

interface CoreRangeScannerLike {
  readonly name?: string;
  scan(input: {
    readonly text: string;
    readonly codePoints: readonly string[];
  }):
    | readonly TextCodePointRange[]
    | {
        readonly ranges: readonly TextCodePointRange[];
        readonly metadata?: Readonly<Record<string, unknown>>;
      };
}

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
const compiledDictionary: CompiledProfanityDictionary =
  compileProfanityDictionary(dictionary);
const dictionaryRule: ProfanityLanguageRuleDefinition | undefined =
  dictionary.rules[0];
const dictionaryValidationIssues: ProfanityLanguageDictionaryValidationIssue[] =
  validateProfanityLanguageDictionary(dictionary);
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
const compiledDictionaryFilter: ProfanityFilter =
  createProfanityFilterFromCompiledDictionary(compiledDictionary);
const sharedFilter: ReadonlyProfanityFilter = filter;
const scannerOptions: ProfanityScannerOptions = {
  filter: strict,
  matchOptions: options,
};
const scanner: ProfanityScanner = createProfanityScanner(scannerOptions);
const coreScanner: CoreRangeScannerLike = scanner;
const match: ProfanityMatchRange | undefined = strict.analyze(
  "alpha beta gamma delta",
  options,
)[0];
const scanResult: ProfanityScannerOutput = scanner.scan({
  text: "alpha beta gamma delta",
  codePoints: Array.from("alpha beta gamma delta"),
});
coreScanner.scan({
  text: "alpha beta gamma delta",
  codePoints: Array.from("alpha beta gamma delta"),
});
const scanMetadata: ProfanityScannerMetadata = scanResult.metadata;

filter.check("plain text");
sharedFilter.censor("plain text");
dictionaryFilter.check("plain text");
compiledDictionaryFilter.check("plain text");

// @ts-expect-error The shared default filter is read-only.
filter.addStrict("not-allowed");

if (PROFANITY_FILTER_NAME !== "profanity") {
  throw new Error("Unexpected filter name declaration.");
}

if (dictionaryRule?.source === undefined) {
  throw new Error("Unexpected dictionary rule declaration surface.");
}

if (dictionaryValidationIssues.length !== 0) {
  throw new Error("Unexpected dictionary validation issue surface.");
}

if (
  compiledDictionary.language !== "ru" ||
  compiledDictionary.strictRuleCount === 0 ||
  compiledDictionary.looseRuleCount === 0
) {
  throw new Error("Unexpected compiled dictionary declaration surface.");
}

if (match?.category !== category || match.severity !== severity) {
  throw new Error("Unexpected taxonomy declaration surface.");
}

if (
  scanMetadata.matches.length !== 1 ||
  scanResult.ranges.length !== scanMetadata.matches.length
) {
  throw new Error("Unexpected scanner declaration surface.");
}
