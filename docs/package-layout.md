# Package Layout

Runtime packages live in explicit npm workspaces:

```text
packages/
  core/
  url/
  email/
  phone/
  profanity/
  spam/
```

Each package releases independently while sharing the root lockfile, CI, and
release manifest.

## Preferred Public Surface

Each runtime package exposes its root public contract through `src/index.ts`.
That file contains or re-exports:

- package factories such as `createUrlFilter()` or `createSpamFilter()`
- backwards-compatible aliases where already public
- shared default instances only for stateless or intentionally shared behavior
- scanner factories when range pipeline integration is public
- public options, results, metadata, and filter instance types
- stable public constants

Parsers, low-level range collectors, dictionary compilers, and normalization
details stay internal unless a package documents a public contract for them.

## Preferred Source Layout

```text
packages/<name>/
  src/
    index.ts
    config.ts
    normalize.ts
    filter.ts
    contracts.ts
    ranges/
    matchers/
    languages/
  tests/
    index.spec.ts
    curated-regression.spec.ts
  docs/
  package.json
  README.md
```

Small packages do not need every file or directory. Extract helpers only when
the additional boundary clarifies ownership or removes real duplication.

## Package Families

URL, email, and phone are stateless text censors. Their root exports preserve
the existing shared `filter`, isolated factory functions, scanner factories,
options, and public types.

Profanity is dictionary-backed and intentionally larger. Dictionary validation,
matcher compilation, range collection, taxonomy, and language data remain
separate internal areas while the current public entrypoints remain stable.

Spam is a stateful guard. Actor state, configuration normalization, text
normalization, and public contracts stay separate. Guard instances are not
shared across unrelated moderation scopes unless the caller intentionally
wants shared state.

Core owns shared contracts and helpers. Other workspaces depend on core instead
of copying pipeline contracts, guard result shapes, normalization primitives,
range merging, or masking helpers.

## Metadata Contract

Every publishable workspace keeps:

- `type: "module"`
- root `exports` with `types` and `import` pointing at `dist/index.*`
- `main: "./dist/index.js"`
- `types: "./dist/index.d.ts"`
- package-specific `files`
- `sideEffects: false` when imports have no side effects
- `prepack: npm run build`
- `check` covering lint, tests, build, dist smoke, and dry pack
- the shared repository URL with `directory: "packages/<name>"`
- the shared issues URL and a package-specific homepage

The root `package.json` is private and is never published.

## Alignment Rules

- Prefer additive public exports.
- Do not remove or rename existing exports without an explicit breaking change.
- Keep shared defaults stable.
- Add isolated factory options instead of changing default behavior.
- Keep package runtime ownership inside its workspace.
- Document package-specific layout exceptions beside the package.
