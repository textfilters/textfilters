# Severity Ordering Design

This document records the design audit for a future `minSeverity` option on the
taxonomy filtering API. It is design documentation only. It does not add runtime
behavior, public exports, corpus metadata, package version changes, or release
changes.

## Current State

The public severity vocabulary is defined by `ProfanitySeverity`:

```ts
type ProfanitySeverity = "high" | "medium" | "low" | "soft";
```

The public match options currently expose exact-match filtering only:

```ts
type ProfanityMatchOptions = {
  categories?: readonly ProfanityCategory[];
  severities?: readonly ProfanitySeverity[];
};
```

`severities` is implemented as a caller-provided set. A match is included only
when the match has taxonomy metadata and its severity is one of the requested
values. Empty arrays intentionally act as empty filters.

Runtime string terms remain unclassified and omit taxonomy metadata. Object
terms can carry `category` and `severity`, and built-in JSON corpora are still
string-backed through the generated term modules.

## Audit Findings

Severity values are present in four places:

- `src/types.ts` defines the public `ProfanitySeverity` union.
- `src/filter.ts` applies exact-match filtering for `options.severities`.
- `README.md`, [Match Metadata Design](match-metadata-design.md), and
  [Profanity Taxonomy Metadata Plan](profanity-taxonomy-plan.md) describe
  severity as rule metadata, not as final moderation policy.
- API, internal-rule, runtime-literal, and dist smoke tests cover metadata
  propagation, allowed values, and exact-match option behavior.

No runtime code currently assigns numeric ranks, compares severities, or exposes
threshold filtering. The only implicit order appears in documentation prose and
test fixture arrays that list the values as `high`, `medium`, `low`, then
`soft`.

The existing taxonomy plan describes the values as a compact scale:

- `high`: strongest terms that most default policies are likely to treat as
  severe.
- `medium`: clearly problematic terms that are less severe than the highest
  group.
- `low`: mild vulgarity or weak insults.
- `soft`: euphemisms, softened forms, or terms that are useful for analysis but
  should be easy to treat differently from direct profanity.

That prose supports an ordered scale, but the current public API has not yet made
ordering a compatibility promise.

## Why Exact-Match Filtering Exists

Exact-match `severities` filtering is stable without defining a global ordering.
It lets callers include only the explicitly requested metadata values and keeps
product policy outside the matcher.

This behavior also avoids ambiguity for callers who need a non-threshold policy.
For example, a product can include `high` and `soft` while excluding `medium` and
`low` if it treats euphemisms as a separate review bucket.

Because exact-match filtering does not compare values, it could be shipped before
the package committed to a public severity order.

## Why `minSeverity` Is Not Exposed Yet

`minSeverity` would make ordering observable. Once released, callers could depend
on which values are included by a threshold. Reordering the scale later would be
a breaking behavior change.

The current vocabulary suggests this ascending order:

```ts
const PROFANITY_SEVERITY_ORDER = ["soft", "low", "medium", "high"] as const;
```

Under that model, `minSeverity: "low"` would include `low`, `medium`, and
`high`, but not `soft`.

This model is coherent with the existing descriptions, but it still needs an
explicit compatibility decision because:

- `soft` is semantically different from mild direct profanity, not just "less
  severe";
- category and severity are related but separate dimensions;
- future corpus review may discover terms whose category default and severity
  exception do not fit a simple category-derived rank;
- runtime string terms have no severity and must remain excluded from
  taxonomy-backed threshold filters.

## Recommended Ordering Model

The future implementation should define severity as an ascending ordered scale:

1. `soft`
2. `low`
3. `medium`
4. `high`

The public API should describe `minSeverity` as including matches whose package
default severity is equal to or stronger than the requested threshold. The API
should avoid saying that this is a final moderation policy; it is a package
classification threshold only.

The implementation should centralize the order in one internal helper and should
not rely on declaration order in the TypeScript union.

## Future API Shape

A future implementation PR can extend the existing options shape:

```ts
type ProfanityMatchOptions = {
  categories?: readonly ProfanityCategory[];
  severities?: readonly ProfanitySeverity[];
  minSeverity?: ProfanitySeverity;
};
```

`minSeverity` should be additive and optional. Omitting it must preserve current
default behavior.

If both `severities` and `minSeverity` are provided, the safest rule is
intersection: a match must satisfy the exact severity set and the threshold. This
keeps the current meaning of `severities` intact while allowing callers to narrow
further.

An alternative is to reject combined `severities` and `minSeverity` as
ambiguous. That would make invalid configurations explicit but add runtime error
semantics to an options object that currently only narrows results.

The recommended option is intersection unless product requirements show callers
would commonly pass both by mistake.

## Compatibility Constraints

Future threshold filtering must preserve these constraints:

- calls without taxonomy options keep current `analyze()`, `check()`, and
  `censor()` behavior;
- existing `categories` and `severities` exact-match semantics remain unchanged;
- empty `severities` stays an empty filter even when other options are present;
- runtime string terms remain excluded from taxonomy-backed filters when they do
  not have metadata;
- public severity names remain stable;
- the package version and release process remain managed by the normal release
  workflow.

Changing the order after `minSeverity` is released should be treated as a
breaking change because callers may depend on threshold inclusion.

## Testing Requirements

A future implementation PR should add focused coverage for:

- public type exposure of `minSeverity`;
- threshold inclusion for each severity value;
- exact-match `severities` behavior unchanged;
- combined `categories`, `severities`, and `minSeverity` behavior;
- empty array behavior with `minSeverity`;
- string-backed runtime terms remaining unclassified under threshold filters;
- `check()` and `censor()` using the same threshold narrowing as `analyze()`;
- dist smoke coverage for the built package entrypoint;
- a runtime import smoke after build if the implementation moves ESM files or
  relative imports.

## Open Questions

- Should combined `severities` and `minSeverity` use intersection or be rejected
  as invalid input?
- Should `soft` always be part of the same ordered scale, or should future API
  design allow callers to treat euphemisms as a separate dimension?
- Should future docs expose a named severity order constant, or keep ordering as
  behavior documented through `minSeverity` only?
