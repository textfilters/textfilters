# Language Pack Authoring

This guide defines the current authoring and conformance expectations for
future external language packs that want to build on `@textfilters/profanity`.
It is intentionally scoped to the contract that exists in this repository
today; no external language package is created by this guide.

For the decision criteria that determine when a real external package should be
created, see the
[external language pack policy](external-language-pack-policy.md).

## Source Shape

The public dictionary shape is defined by the exported
`ProfanityLanguageDictionary` and `ProfanityLanguageRuleDefinition` types in
`src/languages/profanity.ts`. External language packs should author this public
shape directly, normally as JSON source dictionaries. The built-in Russian
dictionary also exports that shape, but some package-owned Russian family files
use internal TypeScript helpers to reduce repeated boilerplate.

A dictionary has a language code and a list of rules:

```json
{
  "language": "zz",
  "rules": [
    {
      "id": "zz.vulgar.example",
      "category": "VULGAR",
      "severity": "low",
      "source": "example",
      "match": {
        "strict": {},
        "loose": {
          "stretch": true
        }
      }
    }
  ]
}
```

Each rule needs:

- `id`: a stable semantic dotted id, for example
  `zz.vulgar.example`. Treat ids as public policy keys once released.
- `category`: one of the exported `ProfanityCategory` values.
- `severity`: one of the exported `ProfanitySeverity` values.
- `source`: the human-maintained source pattern for the rule.
- `match`: at least one of `strict` or `loose`.

`source` may be a single string or an array of string fragments. Fragmented
sources are joined without separators before validation and compilation. Use
fragments only to keep a long reviewed regular expression readable in JSON:

```json
{
  "id": "zz.vulgar.fragmented",
  "category": "VULGAR",
  "severity": "low",
  "source": ["q", "[._-]?", "w", "[._-]?", "r"],
  "match": {
    "loose": {}
  }
}
```

Each fragment must be non-empty and trimmed. The joined source still needs to be
unique within the dictionary and compile as a Unicode regular expression.

The language code is a lowercase two-letter ISO 639-1 code. Rule ids use the
same language prefix and a category segment before the stable term segment:

```text
<language>.<category-segment>.<stable-rule-name>
```

The category segments are:

| Category        | Id Segment  |
| --------------- | ----------- |
| `OBSCENE_MAT`   | `obscene`   |
| `STRONG_INSULT` | `insult`    |
| `VULGAR`        | `vulgar`    |
| `EUPHEMISM`     | `euphemism` |

The validator reports `suspicious_id` when the id segment does not match the
rule category. That is an authoring signal: either the taxonomy is wrong, the id
was copied from another rule, or the rule needs a deliberate rename before it is
released.

## Composed Source Dictionaries

Large language dictionaries may be maintained as multiple smaller JSON source
files. Each source file should still use the normal dictionary shape with the
same `language` value and a focused `rules` list. A package entrypoint can import
those files and assemble one exported `ProfanityLanguageDictionary` for runtime
use.

Validate both the assembled dictionary and each source file. Per-file validation
catches local authoring mistakes, while assembled validation catches cross-file
issues such as duplicate rule ids or duplicate source patterns.

When composition preserves a specific matcher order, keep that order as explicit
source data and add regression coverage for assembled rule ids, matcher order,
and representative metadata.

## Categories And Severities

Language packs should classify every rule with both `category` and `severity`.
The current categories are:

- `OBSCENE_MAT`
- `STRONG_INSULT`
- `VULGAR`
- `EUPHEMISM`

The current severity order is `soft < low < medium < high`. Use the weakest
severity that still describes the rule's expected moderation impact. Do not use
severity as a proxy for implementation confidence, word frequency, or matching
complexity.

## Strict And Loose Views

`strict` and `loose` are authored views of the same language dictionary, not
serialized matcher output.

- `strict: {}` means the source should match as a strict normalized token or
  phrase according to the package's strict matching rules.
- `loose: {}` means the source can match across supported separators according
  to the package's loose matching rules.
- `loose: { "stretch": true }` additionally allows repeated word-like atoms in
  the controlled internal rule compiler.
- `loose: { "hyphenTail": true }` marks a maintained dictionary rule whose
  hyphenated compound tail should be trimmed unless the tail is itself profane.
  Use it only for reviewed source rules with explicit false-positive locks.
- `loose: { "hyphenTail": true, "hyphenTailMin": 5 }` can set the minimum
  compact prefix length required before trimming a hyphenated tail. The
  `hyphenTailMin` option is only valid together with `hyphenTail: true`.

Choose strict matching when a rule should only match clear token boundaries.
Choose loose matching when separator-obfuscated spelling is part of the intended
behavior. A rule may opt into both views when both behaviors are expected. Full
transliteration coverage should be authored as explicit reviewed dictionary
rules with taxonomy metadata and false-positive tests, not as a global runtime
normalization switch.

English dictionaries preserve Latin letters during matching so maintained
English sources remain readable and do not pass through the built-in Russian
homoglyph folding step. Other language dictionaries retain the existing
normalization behavior for compatibility. Filters created from an English
dictionary apply the same Latin-preserving normalization to later runtime
literal mutations.

## Human-Maintained JSON

Source dictionaries should stay human-maintained JSON. They should describe
language-specific source rules, taxonomy, and intended strict or loose behavior.
They must not store generated matcher output or compiler bookkeeping.

The internal Russian authoring helper is not part of this public contract. It is
reserved for the bundled Russian dictionary because those rules ship, test, and
release with this package. External language packs should not depend on
`src/languages/ru/profanity/authoring.ts`, should not expect arbitrary-regex
runtime APIs, and should not serialize helper-generated matcher output.

Keep each `source` trimmed, non-empty, unique within the dictionary, and
compilable as a Unicode regular expression. Duplicate source checks normalize
Unicode to NFC after trimming so accidental copy differences are caught before
runtime matcher views are compiled.

Do not store these generated or matcher-only fields in source JSON:

- `builtin:*` ids or any generated fallback id.
- `ruleId`.
- `order`.
- compiled regex strings generated from strict or loose views.
- generated pattern metadata, range metadata, or matcher ordering.

Generated ids are diagnostic fallback metadata owned by the compiler. Language
packs need explicit semantic ids so downstream policy, allowlists, analytics,
and tests can remain stable when matcher internals change.

## Conformance Tests

A future external language package should validate its dictionary before
publishing. The package exports a framework-independent validator for that
source dictionary contract:

```ts
import { validateProfanityLanguageDictionary } from "@textfilters/profanity";
import dictionary from "./profanity.json" with { type: "json" };

const issues = validateProfanityLanguageDictionary(dictionary);

if (issues.length > 0) {
  throw new Error(JSON.stringify(issues, null, 2));
}
```

`validateProfanityLanguageDictionary(dictionary)` returns an array of issues.
Valid source dictionaries return `[]`. Validation issues use stable `path`,
`code`, and `message` fields so language packs can print them in tests or CI
without depending on this repository's test helpers.

Packages that keep the dictionary as JSON can validate it directly with the
included CLI:

```sh
profanity-validate-language-dictionary path/to/profanity.json
```

The command exits `0` for valid dictionaries, `1` when validation issues are
found, and `2` for usage, file read, or JSON parse errors. Validation output
prints each issue with its stable `path`, `code`, and `message`.

Use `--format json` when CI or an authoring tool needs a stable report:

```sh
profanity-validate-language-dictionary --format json path/to/profanity.json
```

Add `--pretty` for readable local output:

```sh
profanity-validate-language-dictionary --format json --pretty path/to/profanity.json
```

JSON reports are printed to stdout and have this shape:

```json
{
  "ok": false,
  "file": "path/to/profanity.json",
  "issueCount": 1,
  "issues": [
    {
      "path": "rules[0].id",
      "code": "suspicious_id",
      "message": "Rule id category segment should match the rule category."
    }
  ],
  "summary": {
    "status": "invalid",
    "message": "Dictionary validation failed with 1 issue."
  }
}
```

Usage, read, and JSON parse failures exit `2`. In JSON mode those failures use
the same top-level shape with `ok: false`, `issueCount: 0`, an empty `issues`
array, and `summary.status: "error"`.

In package CI, run the CLI before build or test steps that import the
dictionary:

```sh
profanity-validate-language-dictionary --format json path/to/profanity.json
```

The validator checks:

- the dictionary language and rules are present;
- every rule has a stable explicit semantic id;
- id language prefixes match the dictionary language;
- id category segments match the rule category;
- ids are unique;
- sources are trimmed, non-empty, valid Unicode regular expression patterns,
  and unique within the dictionary;
- every rule has category and severity metadata;
- each rule opts into `strict`, `loose`, or both;
- `loose` options only use supported public options;
- rule and match objects do not contain unsupported authoring keys;
- source JSON does not contain generated matcher metadata;
- generated fallback ids such as `builtin:*` are not serialized into source
  JSON.

The validator checks the source dictionary contract. It does not prove
moderation quality, false-positive behavior, language coverage, taxonomy
judgment, or whether a rule should exist. Language packs should still keep
their own corpus, regression, and policy tests.

Common fixes:

| Code                     | Fix                                                                  |
| ------------------------ | -------------------------------------------------------------------- |
| `invalid_language`       | Use a lowercase two-letter language code such as `zz`.               |
| `invalid_id`             | Rename the rule to a semantic dotted id such as `zz.vulgar.example`. |
| `suspicious_id`          | Align the id category segment with the `category` field.             |
| `source_not_trimmed`     | Remove leading or trailing whitespace from `source`.                 |
| `invalid_source_pattern` | Fix the source so it compiles as a Unicode regular expression.       |
| `duplicate_source`       | Merge the duplicate rule or give each rule a distinct source.        |

Conformance tests should also cover that
`createProfanityFilterFromDictionary(dictionary)` returns an isolated filter
that preserves rule ids, categories, and severities in `analyze()` output.

The package-level public boundary is
`createProfanityFilterFromDictionary(dictionary)`. Services that construct many
filters from the same dictionary can use
`compileProfanityDictionary(dictionary)` once and pass the result to
`createProfanityFilterFromCompiledDictionary(compiled)`. The compiled dictionary
is a snapshot of the source dictionary at compile time, and each created filter
receives isolated mutable state. External packs should avoid depending on
internal matcher modules or private matcher representations.

Runtime mutations on a dictionary-backed filter still use normalized literals.
Calls such as `setStrict`, `setLoose`, `addStrict`, and `addLoose` do not expose
the dictionary's internal rule compiler to caller-provided terms, and they do
not mutate a compiled dictionary reused by other filters.

A minimal non-published template for a future external pack lives in
[`../examples/language-pack/`](../examples/language-pack/). It uses the fake
language code `zz`, validates its source dictionary, creates a dictionary-backed
filter, and exports both from a hypothetical package entrypoint.

## Currently Out Of Scope

The following work is intentionally out of scope for this milestone:

- creating `@textfilters/profanity-ru` or any other external language package;
- moving the Russian dictionary out of this package;
- adding another real language dictionary beyond the private reviewed English
  pack;
- broadening profanity coverage beyond the reviewed English vocabulary;
- changing Russian runtime behavior;
- adding generated matcher metadata to source dictionaries;
- publishing packages or changing package versions manually.
