# Profanity Taxonomy Metadata Plan

This document records the planned taxonomy metadata work for issue #3 before any
corpus, schema, or public API changes are made.

It is documentation and design only. It does not change the built-in corpus,
matcher behavior, public exports, package version, or release contents.

## Current Internal State

After PRs #17 through #19, the package has the internal groundwork needed to add
taxonomy metadata without changing the current public behavior:

- accepted match ranges carry the matcher mode that found them;
- built-in rules have deterministic internal rule ids;
- internal match ranges can carry the originating rule id;
- shared helpers collect profanity ranges for `check()` and `censor()`;
- the public API remains limited to the existing boolean, censoring, and mutable
  dictionary methods.

The current internal metadata answers where a match was found, how it was found,
and which internal rule produced it. It does not yet classify what kind of
profanity the rule represents.

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

The category list should remain internal until a later public API defines stable
names and compatibility expectations.

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

The project needs to choose whether runtime literals receive conservative
defaults, remain unclassified internally, or eventually accept caller-provided
metadata through a separate API. This decision should be made before public
analysis results expose taxonomy fields as always present.

## Migration Plan

1. Introduce internal taxonomy types for category and severity without exporting
   them publicly.
2. Support object-based built-in rule definitions internally while preserving the
   existing generated match behavior.
3. Classify a small representative subset of built-in rules to validate naming,
   review process, fixture shape, and tests.
4. Preserve the default behavior of `check()` and `censor()` so existing callers
   receive the same boolean and masking results.
5. Add public `analyze()` only later, in a separate `feat:` pull request after
   taxonomy shape, runtime literal behavior, sorting, overlap handling, and
   compatibility expectations are settled.

## Relationship To Match Metadata

The broader match metadata direction is described in
[Match Metadata Design](match-metadata-design.md). This taxonomy plan narrows
that future work to the category and severity metadata needed before corpus or
schema changes.
