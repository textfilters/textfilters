# @textfilters/profanity

Profanity filtering primitives for composable text moderation.

## Installation

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires authentication for npm installs, including public packages.

```sh
npm install @textfilters/core @textfilters/profanity
```

## Usage

### Quick Start

```ts
import { createProfanityFilter, filter } from "@textfilters/profanity";

const safeText = filter.censor("message text");
const hasProfanity = filter.check("message text");

const tenantFilter = createProfanityFilter(["strict-term"], ["loose-term"]);
const tenantSafeText = tenantFilter.censor("message text");
```

The default shared instance is exported as `filter` and uses the built-in strict
and loose term lists. It is mutable through `setStrict`, `setLoose`,
`addStrict`, and `addLoose`, so changes affect later calls that use the same
shared instance.

Use `createProfanityFilter(...)` when per-request, per-tenant, or test-local
dictionaries must be isolated from the shared mutable `filter`.

## API

### `filter.censor(text): string`

Returns a censored copy of `text`. Matching is performed on a normalized
same-length copy of the input, and mask ranges are applied back to the original
UTF-16 string.

### `filter.check(text): boolean`

Returns `true` when the current filter instance would censor at least one range.
Use this when a boolean moderation decision is enough and the masked text is not
needed.

### `createProfanityFilter(strict?, loose?): ProfanityFilter`

Creates a new mutable filter instance. Without arguments it uses the built-in
strict and loose dictionaries. Passing arrays replaces that side with runtime
dictionary terms:

```ts
const strictOnly = createProfanityFilter(["blocked"], []);
const looseOnly = createProfanityFilter([], ["banned"]);
const builtIn = createProfanityFilter();
```

All filter instances expose stable `name: "profanity"` plus `check`, `censor`,
`setStrict`, `setLoose`, `addStrict`, and `addLoose`.

### Taxonomy Metadata Types

The package also exports type-only taxonomy metadata names for callers that need
to type local metadata alongside profanity filtering code:

```ts
import type {
  ProfanityCategory,
  ProfanitySeverity,
  ProfanityTaxonomyMetadata,
} from "@textfilters/profanity";

const category: ProfanityCategory = "VULGAR";
const severity: ProfanitySeverity = "high";

const metadata: ProfanityTaxonomyMetadata = {
  category,
  severity,
};
```

This is currently a type-only taxonomy metadata surface. It does not add runtime
taxonomy metadata to `check()` results, `censor()` output, or mutable dictionary
methods.

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

The built-in corpus is different: package-owned data may use controlled internal
rules to represent existing behavior compactly. That internal rule syntax is not
part of the public API and is not applied to runtime dictionaries.

## Known Limitations And Behavior Notes

- Censored output preserves JavaScript string length, including astral code
  points.
- Ranges are UTF-16 offsets into the original source string.
- Runtime dictionaries do not support caller-provided regular expressions.
- The shared `filter` instance is mutable; use `createProfanityFilter()` for
  isolated state.
- Built-in corpus behavior is intentionally locked by compatibility tests.

## Compatibility And Intentional Changes

This package keeps the built-in corpus behavior covered by compatibility tests.

Intentional public-package changes:

- Runtime dictionary terms are treated as normalized literals, not arbitrary regular expressions.
- Built-in package-owned rules use an internal rule compiler that is not exposed to callers.
- The filter exposes stable `name: "profanity"`.
- The filter exposes `check(text): boolean` for boolean-only detection.
- `createProfanityFilter()` without arguments creates an instance with the built-in package dictionaries.
- Masking preserves JavaScript string length for astral code points.

## Architecture

See [the architecture guide](docs/architecture.md) for the matching pipeline, Mermaid diagrams, and the rationale behind the strict separation between runtime literals and internal corpus rules.

See [the invariants guide](docs/invariants.md) for a short maintenance checklist
covering normalization, source ranges, boundaries, loose matching, false-positive
locks, and hyphen-tail behavior.

## Release

Releases are managed by Release Please from Conventional Commit history on `main`. When a Release Please release is created, the workflow runs `npm run check` and publishes the package to GitHub Packages. Release tags keep the `v*` pattern.

The package is prepared for publication to GitHub Packages, not the public npm registry.

## License

MIT
