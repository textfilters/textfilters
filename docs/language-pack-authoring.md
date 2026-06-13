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
`src/languages/profanity.ts`. The built-in Russian source dictionary follows
that shape in `src/languages/ru/profanity.json`.

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

Choose strict matching when a rule should only match clear token boundaries.
Choose loose matching when separator-obfuscated spelling is part of the intended
behavior. A rule may opt into both views when both behaviors are expected.

## Human-Maintained JSON

Source dictionaries should stay human-maintained JSON. They should describe
language-specific source rules, taxonomy, and intended strict or loose behavior.
They must not store generated matcher output or compiler bookkeeping.

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

The validator checks:

- the dictionary language and rules are present;
- every rule has a stable explicit semantic id;
- ids are unique;
- every rule has category and severity metadata;
- each rule opts into `strict`, `loose`, or both;
- `loose` options only use supported public options;
- source JSON does not contain generated matcher metadata;
- generated fallback ids such as `builtin:*` are not serialized into source
  JSON.

The validator checks the source dictionary contract. It does not prove
moderation quality, false-positive behavior, language coverage, taxonomy
judgment, or whether a rule should exist. Language packs should still keep
their own corpus, regression, and policy tests.

Conformance tests should also cover that
`createProfanityFilterFromDictionary(dictionary)` returns an isolated filter
that preserves rule ids, categories, and severities in `analyze()` output.

The package-level public boundary is
`createProfanityFilterFromDictionary(dictionary)`. External packs should avoid
depending on internal matcher modules or compiled matcher representations.

Runtime mutations on a dictionary-backed filter still use normalized literals.
Calls such as `setStrict`, `setLoose`, `addStrict`, and `addLoose` do not expose
the dictionary's internal rule compiler to caller-provided terms.

A minimal non-published template for a future external pack lives in
[`../examples/language-pack/`](../examples/language-pack/). It uses the fake
language code `zz`, validates its source dictionary, creates a dictionary-backed
filter, and exports both from a hypothetical package entrypoint.

## Currently Out Of Scope

The following work is intentionally out of scope for this milestone:

- creating `@textfilters/profanity-ru` or any other external language package;
- moving the Russian dictionary out of this package;
- adding another real language dictionary;
- broadening profanity coverage;
- changing Russian runtime behavior;
- adding generated matcher metadata to source dictionaries;
- publishing packages or changing package versions manually.
