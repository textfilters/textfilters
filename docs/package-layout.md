# Package Layout

Textfilters packages release independently, but new packages and substantial
refactors should converge on the same public layout where practical. The goal is
to keep package entrypoints predictable without forcing behavior changes into
existing stable APIs.

## Preferred Public Surface

Each runtime package should expose a single root export through `src/index.ts`.
That file is the package's public contract and should contain or re-export:

- package factory functions such as `createUrlFilter()` or `createSpamFilter()`
- backwards-compatible aliases such as `urlFilter()` where already public
- shared default instances such as `filter` only for stateless or intentionally
  shared package behavior
- public scanner factories when range pipeline integration is part of the
  package contract
- public options, result, scanner metadata, and filter instance types
- public constants such as stable block reasons or filter names

Parsers, low-level range collectors, dictionary compilers, and normalization
details should stay behind the root export unless a package has a documented
reason to expose them.

## Preferred Source Layout

Use this layout as the default for new package work:

```text
src/
  index.ts              # public exports and root factories
  config.ts             # option defaults and validation
  normalize.ts          # package-specific text normalization
  filter.ts             # factory implementation for censor/check/analyze APIs
  contracts.ts          # package-specific public types, if large enough
  ranges/               # range collection and masking helpers
  matchers/             # scanners, parsers, compiled patterns, dictionaries
  languages/            # language-specific dictionaries or rule sources
tests/
  index.spec.ts         # public API behavior
  curated-regression.spec.ts
docs/                   # package-specific operational or release docs
```

Small packages do not need every file or directory. Keep a helper inline until
extracting it makes ownership clearer or removes real duplication.

## Package Families

URL, email, and phone packages are stateless text censors. Their preferred
layout is:

- `src/index.ts` exports `filter`, `create*Filter`, `*Filter` alias, options,
  documented `create*Scanner` factories, and public filter/scanner types
- parser internals and low-level range collectors remain package-private
- scanner output uses code point ranges that can feed the core range pipeline
- censor factories delegate final masking to `@textfilters/core`
- README documents masking, scanner range output, and option behavior rather
  than parser internals

Profanity is dictionary-backed and intentionally larger. Its preferred layout
keeps dictionary validation, matcher compilation, range collection, and language
data in separate internal modules while preserving public factories, scanner
integration, analyzer output, and dictionary types from `src/index.ts`.

Spam is a stateful guard package. Its preferred layout keeps actor state,
config normalization, text normalization, and public contracts separate. Do not
share spam guard instances across unrelated moderation scopes unless the caller
intentionally wants shared actor state.

Core owns shared contracts and helpers. Other packages should depend on core for
pipeline contracts, guard result shapes, normalization primitives, range
merging, and masking helpers instead of copying them.

## Package Metadata Contract

Every publishable package should keep these package metadata fields aligned:

- `type: "module"`
- root `exports` with `types` and `import` pointing at `dist/index.*`
- `main: "./dist/index.js"`
- `types: "./dist/index.d.ts"`
- `files` limited to `dist`, `README.md`, `LICENSE`, and package docs where
  applicable
- `sideEffects: false` when the package has no import-time side effects
- `prepack: npm run build`
- `check` running formatting, tests, build, dist smoke, and dry pack

The ecosystem benchmark repository may stay documentation-only and does not need
the runtime package source layout.

## Alignment Rules

- Prefer additive public exports; do not remove or rename existing exports
  without a package-specific breaking-change issue.
- Keep shared defaults stable. Add isolated factory options instead of changing
  the default shared instance behavior.
- Keep stateful guards out of generic caching helpers and stateless censor
  assumptions.
- Use internal modules for scanners/parsers so public API review stays focused
  on `src/index.ts`.
- Document any package-specific layout exception in that package repository.
