# Profanity Taxonomy Metadata Plan

This document records the planned taxonomy metadata work for issue #3 and the
public-facing exposure step that made taxonomy metadata available through the
public match output contract.

It is documentation and design status only. It does not change the built-in
corpus, matcher behavior, public exports, package version, or release contents.

## Completion Status

The taxonomy metadata exposure work is complete for the current public contract:

- internal rule metadata can carry category and severity;
- `ProfanityCategory`, `ProfanitySeverity`, and
  `ProfanityTaxonomyMetadata` are exported from the public entrypoint;
- `ProfanityMatchRange` exposes optional `category` and `severity` fields;
- `filter.analyze()` returns taxonomy metadata when the matched rule has it;
- runtime string terms remain backward-compatible and omit taxonomy metadata;
- `check()` and `censor()` behavior remains unchanged;
- README and API tests document the public metadata contract.

The package version is still managed by Release Please from Conventional Commit
history. This plan does not require a manual version bump or manual release.

## Current Metadata State

The package has the internal and public groundwork needed to carry taxonomy
metadata without changing the existing boolean or censoring behavior:

- accepted match ranges carry the matcher mode that found them;
- built-in rules have deterministic internal rule ids;
- internal match ranges can carry the originating rule id;
- public taxonomy types define the current category and severity vocabulary;
- built-in rules can be represented as object definitions with internal
  taxonomy metadata;
- compile, collect, and match range helpers preserve rule identity and taxonomy
  metadata where it is present;
- internal metadata access is centralized so callers do not need to know the
  physical rule shape;
- invariant tests cover the allowed taxonomy values, metadata propagation, and
  mixed string/object internal rule definitions;
- shared helpers collect profanity ranges for `check()` and `censor()`;
- the public API includes `analyze()` for match ranges with optional taxonomy
  metadata.

The metadata answers where a match was found, how it was found, which internal
rule produced it, and what taxonomy metadata is attached to that rule. Category
and severity are part of the public match range contract, while internal rule
identity and corpus representation remain implementation details.

## Public-Facing Contract

The public-facing contract exposes the smallest stable taxonomy surface needed
for callers to inspect metadata without changing default filtering behavior.

Metadata is available through `filter.analyze()` while `check()` and `censor()`
behavior remains unchanged. Public exposure describes facts about accepted
matches, not final moderation policy.

The current public scope includes:

- exported metadata types for category, severity, and match mode;
- documented match range metadata that can carry category and severity for
  built-in rules;
- examples showing how callers can inspect taxonomy metadata while preserving
  their own policy decisions;
- guidance that runtime string terms remain unclassified and omit taxonomy
  metadata.

Public exposure remains separate from corpus conversion. The current
implementation proves the API shape and compatibility behavior without moving
all built-in terms to public corpus metadata.

## Why Category And Severity Are Needed

`category` and `severity` allow callers and future internal policy code to
separate content classification from matching mechanics.

`category` should describe the kind of term represented by a rule, such as an
obscene term, a strong insult, a vulgar word, or a euphemism. This lets future
analysis expose a stable reason for a match without forcing every caller to infer
meaning from raw strings or rule ids.

`severity` should describe the default moderation weight of the rule. This gives
future consumers a simple way to distinguish high-impact terms from milder or
softened terms while preserving product-specific policy decisions outside the
matcher.

Both fields should belong to rule definitions, not to raw input text. A term does
not become a different category because it was matched strictly, matched loosely,
or typed with separators.

## Separate Dimensions

`mode`, `ruleId`, `category`, and `severity` are related metadata, but they
answer different questions:

- `mode` answers how the matcher accepted the input range.
- `ruleId` answers which internal rule produced the match.
- `category` answers what kind of profanity the rule represents.
- `severity` answers how strongly the package classifies the rule by default.

Keeping these dimensions separate avoids accidental policy coupling. A loose
match is not automatically higher severity than a strict match. A rule id is not
a category. A category may have a common default severity, but that does not
settle whether severity should always be derived from category.

## Initial Categories

The initial taxonomy should be small enough to classify consistently:

- `OBSCENE_MAT`: explicit obscene terms from the current built-in set.
- `STRONG_INSULT`: strong insults that are not modeled as a separate slur
  category yet.
- `VULGAR`: vulgar or rude terms with lower default impact than the strongest
  obscene or insulting terms.
- `EUPHEMISM`: softened, masked, or euphemistic forms that should remain
  distinguishable from direct terms.

The category list is public and should be treated as a stable compatibility
surface.

## Initial Severities

The initial severity scale should also stay compact:

- `high`: strongest terms that most default policies are likely to treat as
  severe.
- `medium`: clearly problematic terms that are less severe than the highest
  group.
- `low`: mild vulgarity or weak insults.
- `soft`: euphemisms, softened forms, or terms that are useful for analysis but
  should be easy to treat differently from direct profanity.

The severity scale should describe default package classification only. It
should not encode final product moderation policy.

## Open Decisions

### Derived Or Explicit Severity

One option is to derive `severity` from `category`, keeping rule definitions
smaller and making the taxonomy easier to audit. The tradeoff is that every term
in a category would share the same severity unless an override system is added.

The other option is to store `severity` explicitly on each rule. This gives the
corpus more flexibility and makes exceptions visible, but it increases review
surface and creates a risk of inconsistent classifications.

The first implementation should choose one approach before corpus objects are
introduced, because the decision affects schema shape and tests.

### Slurs Versus Strong Insults

The initial plan keeps `STRONG_INSULT` broad and does not introduce a dedicated
slur category yet. Before public exposure, the project must decide whether slurs
need a separate internal category for policy, reporting, or caller ergonomics.

Keeping slurs inside `STRONG_INSULT` is simpler for the first taxonomy pass.
Separating them may be necessary if consumers need materially different handling
or if the corpus review process requires stronger guarantees for protected-class
abuse.

### Runtime Literals Metadata

Existing mutable dictionary methods let callers add literal terms at runtime.
Those terms do not have built-in rule metadata.

Runtime string terms remain unclassified and omit taxonomy metadata. Object
terms can carry metadata. Any future taxonomy-driven filtering or options API
should preserve that compatibility rule unless it intentionally defines new
caller-provided metadata semantics.

## Migration Plan

1. Introduce internal taxonomy types for category and severity without exporting
   them publicly.
2. Support object-based built-in rule definitions internally while preserving the
   existing generated match behavior.
3. Classify a small representative subset of built-in rules to validate naming,
   review process, fixture shape, and tests.
4. Preserve the default behavior of `check()` and `censor()` so existing callers
   receive the same boolean and masking results.
5. Add public `analyze()` with match ranges that carry optional taxonomy
   metadata.
6. Document public type exports and runtime metadata behavior in the README and
   API tests.

## Compatibility Rules

- Existing `check()` and `censor()` calls must keep their current default
  behavior and return types.
- Existing mutable dictionary methods must keep accepting the same string term
  inputs.
- Taxonomy metadata must stay additive on public match ranges.
- Public names must be stable once exported. Renaming categories, severities, or
  match metadata fields after export should be treated as a breaking change.
- Match ranges exposed publicly must continue to use UTF-16 offsets into the
  caller's original input.
- Runtime literal terms must not be silently assigned misleading taxonomy
  metadata. If metadata is unavailable, the public contract should say so
  explicitly.

## Semver And Release Implications

This documentation-only status update does not require a package version change,
lockfile update, or release.

Release Please should decide the next release from Conventional Commit history
after this work reaches `main`. No manual release is needed for this plan.

Any implementation that changes existing return types, narrows default matching,
changes `censor()` output, renames already exported metadata values, or requires
callers to pass new options for current behavior would be a breaking change.

## Non-Goals For Follow-Up Work

Follow-up taxonomy work should not:

- change `check()` or `censor()` runtime behavior;
- change the existing public mutable dictionary methods;
- convert the corpus JSON to public metadata objects;
- change package version, lockfile, or release configuration;
- expose package internals that are not part of the intended public contract;
- solve final policy decisions for slurs, ambiguous terms, or product-specific
  moderation thresholds;
- make release or publication changes.

The next meaningful milestone is a separate taxonomy-driven filtering/options
API. That work should define option names, default behavior, runtime term
metadata semantics, sorting, and overlap handling before implementation.

Severity threshold filtering has a separate design audit in
[Severity Ordering Design](severity-ordering-design.md). That document records
why current `severities` filtering is exact-match only and what compatibility
questions a future `minSeverity` implementation must settle.

## Relationship To Match Metadata

The broader match metadata direction is described in
[Match Metadata Design](match-metadata-design.md). This taxonomy plan narrows
that work to the category and severity metadata exposed before corpus or schema
changes.
