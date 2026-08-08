# Severity Ordering Design

This document records the design audit and implementation decision for the
`minSeverity` option on the taxonomy filtering API. It does not add corpus
metadata, package version changes, or release changes.

## Current State

The public severity vocabulary is defined by `ProfanitySeverity`:

```ts
type ProfanitySeverity = "high" | "medium" | "low" | "soft";
```

The public match options expose exact-match and minimum-severity filtering:

```ts
type ProfanityMatchOptions = {
  categories?: readonly ProfanityCategory[];
  severities?: readonly ProfanitySeverity[];
  minSeverity?: ProfanitySeverity;
};
```

`severities` is implemented as a caller-provided set. `minSeverity` is
implemented as a package-defined threshold using the order
`soft < low < medium < high`. A match is included only when it has taxonomy
metadata required by the requested filter. Empty arrays intentionally act as
empty filters.

Runtime string terms remain unclassified and omit taxonomy metadata. Object
terms can carry `category` and `severity`. Every built-in Russian and English
rule attaches reviewed taxonomy metadata.

## Audit Findings

Severity values are present in four places:

- `src/types.ts` defines the public `ProfanitySeverity` union.
- `src/match-options.ts` applies exact and minimum-severity filtering.
- [Built-in Taxonomy And Severity Policy](severity-policy.md) defines how every
  built-in rule uses the scale.
- `README.md`, [Match Metadata Design](match-metadata-design.md), and
  [Profanity Taxonomy Metadata Plan](profanity-taxonomy-plan.md) describe
  severity as rule metadata, not as final moderation policy.
- API, internal-rule, runtime-literal, and dist smoke tests cover metadata
  propagation, allowed values, and exact-match option behavior.

Runtime code centralizes numeric severity ranks for threshold filtering. The
public order is `soft`, `low`, `medium`, then `high`.

The existing taxonomy plan describes the values as a compact scale:

- `high`: strongest terms that most default policies are likely to treat as
  severe.
- `medium`: clearly problematic terms that are less severe than the highest
  group.
- `low`: mild vulgarity or weak insults.
- `soft`: euphemisms, softened forms, or terms that are useful for analysis but
  should be easy to treat differently from direct profanity.

That prose supports the ordered scale now made observable by `minSeverity`.

## Why Exact-Match Filtering Exists

Exact-match `severities` filtering is stable without defining a global ordering.
It lets callers include only the explicitly requested metadata values and keeps
product policy outside the matcher.

This behavior also avoids ambiguity for callers who need a non-threshold policy.
For example, a product can include `high` and `soft` while excluding `medium` and
`low` if it treats euphemisms as a separate review bucket.

Because exact-match filtering does not compare values, it could be shipped before
the package committed to a public severity order.

## Why `minSeverity` Commits To Ordering

`minSeverity` makes ordering observable. Once released, callers can depend on
which values are included by a threshold. Reordering the scale later would be a
breaking behavior change.

The current vocabulary uses this ascending order:

```ts
const PROFANITY_SEVERITY_ORDER = ["soft", "low", "medium", "high"] as const;
```

Under this model, `minSeverity: "low"` includes `low`, `medium`, and `high`, but
not `soft`.

This model is coherent with the existing descriptions, and it carries these
compatibility constraints:

- `soft` is semantically different from mild direct profanity, not just "less
  severe";
- category and severity are related but separate dimensions;
- future corpus review may discover terms whose category default and severity
  exception do not fit a simple category-derived rank;
- runtime string terms have no severity and must remain excluded from
  taxonomy-backed threshold filters.

## Ordering Model

The implementation defines severity as an ascending ordered scale:

1. `soft`
2. `low`
3. `medium`
4. `high`

The public API describes `minSeverity` as including matches whose package
default severity is equal to or stronger than the requested threshold. The API
avoids saying that this is a final moderation policy; it is a package
classification threshold only.

The implementation centralizes the order in one internal helper and does not
rely on declaration order in the TypeScript union.

## API Shape

The options shape is:

```ts
type ProfanityMatchOptions = {
  categories?: readonly ProfanityCategory[];
  severities?: readonly ProfanitySeverity[];
  minSeverity?: ProfanitySeverity;
};
```

`minSeverity` is additive and optional. Omitting it must preserve current
default behavior.

If both `severities` and `minSeverity` are provided, the rule is intersection: a
match must satisfy the exact severity set and the threshold. This keeps the
current meaning of `severities` intact while allowing callers to narrow further.

`composeProfanityProfiles()` uses the same intersection rule between a
profile selection's `matchOptions` and options passed to `analyze()`, `check()`,
or `censor()`. Category and exact-severity arrays are intersected, and the
stronger of two `minSeverity` thresholds wins. A call cannot broaden policy
already attached to a selected profile.

## Compatibility Constraints

Threshold filtering must preserve these constraints:

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

## Testing Coverage

Focused coverage includes:

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

- Should `soft` always be part of the same ordered scale, or should future API
  design allow callers to treat euphemisms as a separate dimension?
- Should future docs expose a named severity order constant, or keep ordering as
  behavior documented through `minSeverity` only?
