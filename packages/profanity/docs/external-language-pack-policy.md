# External Language Pack Policy

This decision document defines when `@textfilters/profanity` is ready to create
the first real external language pack. It complements the
[language pack authoring guide](language-pack-authoring.md) and the
[non-published example](../examples/language-pack/README.md); it does not create
or reserve any package.

## Decision

External language packs should only be created when there is a real maintained
dictionary, conformance coverage, and an ownership plan. The package naming
convention is:

```text
@textfilters/profanity-<language>
```

Use the lowercase language identifier that appears in the dictionary source.
For example, a future dictionary with `"language": "zz"` would use
`@textfilters/profanity-zz` if it were real, reviewed, and maintained.

The built-in Russian dictionary stays in `@textfilters/profanity` for now. A
separate Russian package, or any move of the current Russian dictionary, needs a
separate migration decision and compatibility plan.

## Readiness Criteria

A new external language pack is ready only when all of these are true:

- It contains a real human-maintained dictionary for a specific language.
- The dictionary follows the public `ProfanityLanguageDictionary` source shape.
- The dictionary selects a reviewed package-owned normalization strategy.
- Every rule has stable semantic ids, category metadata, severity metadata, and
  explicit strict or loose matching intent.
- The pack validates its dictionary with
  `validateProfanityLanguageDictionary()` in tests or CI.
- The pack has policy tests that cover expected matches, expected non-matches,
  metadata preservation, and representative false-positive risks.
- The pack exposes symmetric `dictionary`, `filter`, `createFilter`, and
  `profile` entrypoint names, with descriptive compatibility aliases when
  needed.
- The profile has a stable id, a language tag, and a ready-to-use read-only
  filter created from the maintained dictionary policy.
- The pack has a named maintainer or maintenance group that can review language
  changes, triage false positives, and make release decisions.
- The pack has documentation explaining its language scope, policy boundaries,
  and known limitations.

Do not create a package only to reserve a name or scaffold future work. A pack
without a real dictionary, meaningful tests, and a maintainer story should remain
an example, draft, or issue until those gaps are closed.

## Release And Versioning

External packs should be versioned independently from `@textfilters/profanity`.
Their releases should follow the impact of dictionary and API changes:

- Patch releases for corrections that preserve the intended public behavior.
- Minor releases for meaningful coverage additions, metadata additions, or
  policy expansions that can affect moderation results.
- Major releases for package API breaks, rule id migrations, or large policy
  shifts that downstream users must opt into deliberately.

External packs should declare their dependency on `@textfilters/profanity`
through normal package metadata and should not require manual edits to
versioning or release artifacts in this repository. Publishing a pack is a
separate release action, not part of adding policy documentation here.

## Ownership And Maintenance

Each external pack needs an owner before it is published. Ownership includes:

- reviewing proposed dictionary additions and removals;
- keeping rule ids stable after release;
- maintaining category and severity consistency;
- responding to false-positive and false-negative reports;
- keeping conformance tests current with the validator contract;
- deciding when dictionary changes justify patch, minor, or major releases.

If ownership is unclear, the project should not publish the pack. The safer
default is to keep the work in a non-published example or design discussion
until ongoing maintenance is credible.

## Current Boundaries

The main package contains a reviewed English dictionary under
`src/languages/en` and exposes it through the explicit
`@textfilters/profanity/en` entrypoint. The bundled Russian profile is available
from `@textfilters/profanity/ru`. These profiles can be composed without a
global language registry. The English profile is not a separately published
language package, does not change the built-in Russian dictionary, and does not
add English rules to the shared default filter.

A future separately published English package still requires a named maintainer
or maintenance group that satisfies the ownership criteria above. Shipping a
limited opt-in dictionary in the main package does not by itself satisfy those
external-package requirements.
