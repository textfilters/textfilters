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

```ts
import { filter } from "@textfilters/profanity";

const safeText = filter.censor("message text");
```

```ts
import { createProfanityFilter } from "@textfilters/profanity";

const profanity = createProfanityFilter(["strict-term"], ["loose-term"]);
const safeText = profanity.censor("message text");
```

The default shared instance is exported as `filter` and uses the built-in strict and loose term lists. It is mutable through `setStrict`, `setLoose`, `addStrict`, and `addLoose`, so create an isolated instance with `createProfanityFilter(...)` when per-request or per-tenant dictionaries are needed. All instances have stable `name: "profanity"`.

Use `filter.check(text)` or `createProfanityFilter(...).check(text)` when only a boolean profanity result is needed.

Runtime dictionary terms are normalized literals, not regular expressions. The built-in corpus may use controlled internal rules, but tenant or request-level dictionaries should pass the exact terms they want to match.

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

## Release

Releases are managed by release-please. When a release is created from `main`, the workflow runs `npm run check` and publishes the package to GitHub Packages.

The package is prepared for publication to GitHub Packages, not the public npm registry.

## License

MIT
