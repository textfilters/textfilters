# @textfilters/profanity

TypeScript profanity filter primitives for content moderation, chat moderation,
UGC moderation, censoring, redaction, and custom moderation pipelines.

Use `@textfilters/profanity` as a Russian profanity filter with built-in
dictionary support, obfuscation handling, taxonomy metadata, language-pack
validation, and composable APIs for a broader TypeScript text filtering library.

The built-in Russian dictionary covers reviewed obscene, vulgar, and insult
families, including common roots around `бля`, `еб`, `пизд`, `хуй`, `пидор`,
`мудак`, `сука`, `гандон`, `залупа`, `шлюха`, `хер`, `говно`, `дерьмо`,
`срать`, `засранец`, `обосрал`, `чмо`, and selected safe transliterations.
Coverage is paired with false-positive audit cases for neutral words, names,
toponyms, product-like tokens, Ukrainian `підор...` words, and Latin proper-name
contexts that overlap risky transliteration spellings.

## Installation

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires authentication for npm installs, including public packages.

```sh
npm install @textfilters/core @textfilters/profanity
```

## Use Cases

- Censor profanity in chat moderation and UGC moderation workflows.
- Analyze matched ranges when a moderation decision needs categories,
  severities, or rule ids.
- Use the shared built-in Russian filter for common read-only checks.
- Build isolated per-application, per-tenant, or per-test dictionaries when
  runtime terms need to be changed.
- Validate maintained language dictionaries before they are used in content
  moderation pipelines.

## Usage

### Quick Start

```ts
import { createProfanityFilter, filter } from "@textfilters/profanity";

const safeText = filter.censor("message text");
const hasProfanity = filter.check("message text");
const matches = filter.analyze("message text");

const tenantFilter = createProfanityFilter(["strict-term"], ["loose-term"]);
const tenantSafeText = tenantFilter.censor("message text");
```

The default shared instance is exported as `filter` and uses the built-in strict
and loose term lists. It is mutable through `setStrict`, `setLoose`,
`addStrict`, and `addLoose`, so changes affect later calls that use the same
shared instance.

Use `createProfanityFilter(...)` when per-request, per-tenant, or test-local
dictionaries must be isolated from the shared mutable `filter`.

### Shared Default Vs Isolated Filters

Use the exported `filter` for the package's shared built-in Russian behavior
when your code only calls `check`, `censor`, or `analyze`. It is a process-local
object: every module that imports `filter` receives the same mutable instance.

Do not call `setStrict`, `setLoose`, `addStrict`, or `addLoose` on the shared
`filter` for application-specific, tenant-specific, request-specific, or
test-local terms. Those calls intentionally mutate that shared instance and
therefore affect future checks performed through the same import.

Use `createProfanityFilter(...)`,
`createProfanityFilterFromDictionary(dictionary)`, or
`createProfanityFilterFromCompiledDictionary(compiled)` when runtime mutation is
part of the workflow. Each factory call returns an isolated mutable filter, so
its runtime dictionary changes do not affect the shared default filter or other
factory-created filters.

## API

### `filter.analyze(text, options?): ProfanityMatchRange[]`

Returns accepted match ranges as UTF-16 offsets into the original input. Each
range is an array-like `[start, end]` value with `mode` and optional rule
metadata:

```ts
const matches = filter.analyze("blocked text");

for (const match of matches) {
  console.log(match[0], match[1], match.mode);
  console.log(match.ruleId, match.category, match.severity);
}
```

`ruleId`, `category`, and `severity` are present when the matched rule has
taxonomy metadata. Built-in Russian dictionary rules include semantic rule ids
and taxonomy metadata. Runtime string terms remain unclassified and omit those
fields unless callers provide structured runtime rules with metadata.

Taxonomy options can narrow matches to rules with specific metadata:

```ts
const vulgarMatches = filter.analyze("blocked text", {
  categories: ["VULGAR"],
});

const highSeverityMatches = filter.analyze("blocked text", {
  severities: ["high"],
});

const mediumOrHigherMatches = filter.analyze("blocked text", {
  minSeverity: "medium",
});

const hasHighSeverityMatch = filter.check("blocked text", {
  severities: ["high"],
});

const censoredVulgarText = filter.censor("blocked text", {
  categories: ["VULGAR"],
  minSeverity: "low",
});
```

Severity thresholds use this package-defined order:
`soft < low < medium < high`. `minSeverity` matches rules whose severity is
equal to or stronger than the requested threshold, and applies only to
taxonomy-metadata-backed rules. When both `severities` and `minSeverity` are
provided, a match must satisfy the exact severity set and the threshold
intersection. When `categories` is combined with severity filters, a match must
satisfy every requested taxonomy filter.

Taxonomy metadata-backed filters only match rules where the requested metadata
is available. Omitting taxonomy options preserves the default matching behavior.

The taxonomy filtering contract is:

- `categories`, `severities`, and `minSeverity` are exposed on
  `ProfanityMatchOptions`.
- Calls without taxonomy options keep the same default `analyze()`, `check()`,
  and `censor()` behavior.
- Taxonomy filters exclude metadata-less string-backed matches.
- `categories` combined with `severities` is an intersection.
- `categories` combined with `minSeverity` is an intersection.
- `severities` combined with `minSeverity` is the intersection between the
  exact severity set and the threshold.
- The severity order is `soft < low < medium < high`.

For taxonomy-backed rules, runtime match output includes the available metadata:

```ts
const strict = createProfanityFilter(
  [{ source: "абв", category: "STRONG_INSULT", severity: "medium" }],
  [],
);

strict.analyze("абв ok");
// [Object.assign([0, 3], {
//   mode: "strict",
//   category: "STRONG_INSULT",
//   severity: "medium",
// })]
```

### `filter.censor(text, options?): string`

Returns a censored copy of `text`. Matching is performed on a normalized
same-length copy of the input, and mask ranges are applied back to the original
UTF-16 string. Taxonomy options censor only matching metadata-backed ranges.

### `filter.check(text, options?): boolean`

Returns `true` when the current filter instance would censor at least one range.
Use this when a boolean moderation decision is enough and the masked text is not
needed. Taxonomy options apply the same match narrowing as `analyze()`. The
boolean path checks compiled strict ranges before falling back to loose ranges,
so a clear strict hit does not require building the full public match list.

### `createProfanityFilter(strict?, loose?): ProfanityFilter`

Creates a new mutable filter instance. Without arguments it uses compiled views
of the built-in Russian dictionary. Passing arrays replaces that side with
runtime dictionary terms:

```ts
const strictOnly = createProfanityFilter(["blocked"], []);
const looseOnly = createProfanityFilter([], ["banned"]);
const builtIn = createProfanityFilter();
```

All filter instances expose stable `name: "profanity"` plus `check`, `censor`,
`analyze`, `setStrict`, `setLoose`, `addStrict`, and `addLoose`.
Runtime mutation methods affect only the instance they are called on. Calling
them on the shared `filter` mutates shared package state; calling them on a
factory-created filter mutates only that isolated instance.

### Language Dictionaries

The package exports a minimal language dictionary API for callers that need an
isolated filter built from a maintained language dictionary:

```ts
import {
  compileProfanityDictionary,
  createProfanityFilterFromDictionary,
  createProfanityFilterFromCompiledDictionary,
  russianProfanityDictionary,
  validateProfanityLanguageDictionary,
  type ProfanityLanguageDictionary,
} from "@textfilters/profanity";

const dictionary: ProfanityLanguageDictionary = russianProfanityDictionary;
const issues = validateProfanityLanguageDictionary(dictionary);
const russianFilter = createProfanityFilterFromDictionary(dictionary);
const compiledRussian = compileProfanityDictionary(dictionary);
const tenantFilter =
  createProfanityFilterFromCompiledDictionary(compiledRussian);

if (issues.length > 0) {
  throw new Error(JSON.stringify(issues, null, 2));
}

russianFilter.analyze("message text");
tenantFilter.addStrict("tenant-only-term");
```

`createProfanityFilterFromDictionary(dictionary)` compiles strict and loose
views from the dictionary and returns a mutable `ProfanityFilter` instance. The
instance is isolated from the shared `filter` export, so later calls to
`setStrict`, `setLoose`, `addStrict`, or `addLoose` affect only that instance.
For repeated server-side construction from the same dictionary, compile the
dictionary once with `compileProfanityDictionary(dictionary)` and pass the
result to `createProfanityFilterFromCompiledDictionary(compiled)`. This reuses
the dictionary rule and matcher compilation work while still returning an
isolated mutable filter each time. The compiled object is a snapshot of the
dictionary at compile time; mutating the source dictionary later only affects
future direct `createProfanityFilterFromDictionary(dictionary)` calls or a new
explicit compilation.

Dictionary-backed matches preserve semantic rule ids, categories, and
severities in `analyze()` output, and taxonomy filters apply to those metadata
fields. Runtime dictionary terms remain normalized literals; language
dictionaries are the supported boundary for maintained language-specific rule
data. Runtime calls such as `setStrict`, `setLoose`, `addStrict`, and `addLoose`
only mutate the returned filter instance; they do not change the compiled
dictionary object or other filters created from it. This release intentionally
does not add new languages or separate packages.

The Russian dictionary is maintained as split family data with an explicit rule
order. New high-risk family rules are expected to add nearby coverage and
false-positive tests. See [Russian dictionary policy](docs/russian-dictionary-policy.md)
for the built-in taxonomy, transliteration, and false-positive review policy,
and [Russian profanity coverage map](docs/russian-coverage-map.md) for covered,
partial, missing, and intentionally unsupported Russian family areas.

`validateProfanityLanguageDictionary(dictionary)` checks the source dictionary
contract and returns stable issues with `path`, `code`, and `message` fields.
Valid dictionaries return `[]`; ordinary validation errors are reported as
issues instead of thrown exceptions. The validator does not judge moderation
quality, false-positive behavior, language coverage, taxonomy choices, or
whether a rule should exist.

The package also includes a small CLI for validating a JSON source dictionary:

```sh
profanity-validate-language-dictionary path/to/profanity.json
```

The command exits `0` for valid dictionaries, `1` when validation issues are
found, and `2` for usage, file read, or JSON parse errors. Validation issue
output includes the same stable `path`, `code`, and `message` fields as the
programmatic validator.

Text output is the default:

```text
Dictionary validation failed:
- rules[0].source source_not_trimmed: Rule source must not include leading or trailing whitespace.
```

Machine-readable JSON output is available for CI and authoring tools:

```sh
profanity-validate-language-dictionary --format json --pretty path/to/profanity.json
```

The JSON report always includes `ok`, `file`, `issueCount`, `issues`, and
`summary`. Validation failures exit `1` and print the report to stdout with
stable issue objects:

```json
{
  "ok": false,
  "file": "path/to/profanity.json",
  "issueCount": 1,
  "issues": [
    {
      "path": "rules[0].source",
      "code": "source_not_trimmed",
      "message": "Rule source must not include leading or trailing whitespace."
    }
  ],
  "summary": {
    "status": "invalid",
    "message": "Dictionary validation failed with 1 issue."
  }
}
```

For future external language pack guidance, see
[the language pack authoring guide](docs/language-pack-authoring.md). It covers
source dictionary shape, stable ids, taxonomy metadata, strict and loose views,
human-maintained JSON, and conformance expectations.
The [external language pack policy](docs/external-language-pack-policy.md)
defines when the project is ready to create a real external package and keeps
the built-in Russian dictionary in this package for now.

## Related Textfilters Packages

- `@textfilters/core` for shared pipeline, normalization, and range masking
  primitives.
- `@textfilters/url` for URL detection, obfuscated links, and safe link
  censoring.
- `@textfilters/email` for email detection and contact redaction.
- `@textfilters/phone` for phone number detection and contact redaction.
- `@textfilters/spam` for actor-based anti-spam guard checks.

### Taxonomy Metadata Types

The package also exports type-only taxonomy metadata names for callers that need
to type local metadata alongside profanity filtering code:

```ts
import type {
  ProfanityCategory,
  ProfanityMatchRange,
  ProfanitySeverity,
  ProfanityTaxonomyMetadata,
} from "@textfilters/profanity";

const ranges: ProfanityMatchRange[] = filter.analyze("message text");
const category: ProfanityCategory = "VULGAR";
const severity: ProfanitySeverity = "high";

const metadata: ProfanityTaxonomyMetadata = {
  category,
  severity,
};
```

`filter.analyze()` exposes taxonomy metadata on match ranges when the matched
rule carries it. Taxonomy options are optional, so `check()` results,
`censor()` output, and mutable dictionary methods keep their existing behavior
when those options are omitted.

## Strict Vs Loose

| Mode   | Runtime term example | Matches                          | Does not match              |
| ------ | -------------------- | -------------------------------- | --------------------------- |
| Strict | `bad`                | `bad` as a full normalized token | `badminton`, `_bad`, `-bad` |
| Loose  | `bad`                | `bad`, `b-a-d`, `b a d`          | prefixes inside words       |

Strict matching is token-oriented. Loose matching allows separators between
letters, then still applies token-boundary checks before masking.

## Runtime Dictionary Terms

Runtime dictionary terms are normalized literals, not regular expressions. A
term such as `foo|bar` matches the literal text `foo|bar`, not `foo` or `bar`.
Escaped punctuation from older literal spellings is accepted, so `foo\\.bar`
matches the literal text `foo.bar`.

The built-in Russian dictionary is different: package-owned data may use
controlled internal rules to represent existing behavior compactly. The JSON
dictionary is the human-maintained source of truth; strict and loose entries are
compiled matcher views, not serialized matcher output. That internal rule syntax
is not part of the public API and is not applied to runtime dictionaries.

Built-in internal rules can also carry compact, meaningful compiler metadata,
such as loose stretch matching for repeated word-like atoms. Language-specific
roots, aliases, guards, morphology, taxonomy, loose behavior, and false-positive
protections belong in the Russian dictionary profile; generated rule ids and
matcher ordering are owned by the generic compilation layer.

Generated built-in rule ids are diagnostic metadata, not stable policy or
allowlist keys. They may change when the package-owned corpus is reorganized
into different compiled matcher views.

## Known Limitations And Behavior Notes

- Censored output preserves JavaScript string length, including astral code
  points.
- Ranges are UTF-16 offsets into the original source string.
- Runtime dictionaries do not support caller-provided regular expressions.
- Runtime string terms do not receive taxonomy metadata.
- The shared `filter` instance is mutable and process-local; reserve its
  mutation methods for deliberate global changes.
- Use factory-created filters for application-specific, tenant-specific,
  request-specific, or test-local runtime dictionary changes.
- Built-in corpus behavior is intentionally locked by compatibility tests.

## Compatibility And Intentional Changes

This package keeps the built-in corpus behavior covered by compatibility tests.

Intentional public-package changes:

- Runtime dictionary terms are treated as normalized literals, not arbitrary
  regular expressions.
- Built-in package-owned rules use an internal rule compiler that is not exposed
  to callers.
- The filter exposes stable `name: "profanity"`.
- The filter exposes `analyze(text): ProfanityMatchRange[]` for accepted match
  ranges and optional taxonomy metadata.
- The filter exposes `check(text): boolean` for boolean-only detection.
- `createProfanityFilter()` without arguments creates an instance with compiled
  views of the built-in Russian dictionary.
- The exported `filter` remains a shared mutable default for backward
  compatibility; factory-created filters are the recommended boundary for
  isolated runtime mutation.
- Masking preserves JavaScript string length for astral code points.

## Architecture

See [the architecture guide](docs/architecture.md) for the matching pipeline,
Mermaid diagrams, and the rationale behind the strict separation between
runtime literals and internal corpus rules.

See [the invariants guide](docs/invariants.md) for a short maintenance checklist
covering normalization, source ranges, boundaries, loose matching, false-positive
locks, and hyphen-tail behavior.

## Release

Releases are managed by Release Please from Conventional Commit history on
`main`. When a Release Please release is created, the workflow runs
`npm run check` and publishes the package to GitHub Packages. Release tags keep
the `v*` pattern.

The package is prepared for publication to GitHub Packages, not the public npm registry.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for pull request scope guidance.

## License

MIT
