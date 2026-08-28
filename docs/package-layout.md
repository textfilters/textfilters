# Package Layout

Runtime packages live in explicit npm workspaces:

```text
packages/
  core/
  url/
  email/
  phone/
  profanity/
  profanity-ru/
  profanity-en/
  spam/
```

Each package releases independently while sharing the root lockfile, CI, and
release manifest.

## Preferred Public Surface

Each runtime package exposes its root public contract through `src/index.ts`.
That file contains or re-exports:

- focused factories such as `createUrlFilter()` or `createSpamGuard()`
- shared default instances only for stateless filters without per-instance state
- the common `TextFilter` methods for text-matching packages
- minimal public options and package instance types
- stable public constants only when callers compare their values

Parsers, low-level range collectors, dictionary compilers, and normalization
details stay internal.

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

URL, email, and phone are stateless text filters. URL and email expose shared
instances plus isolated factories. Phone has no options and exposes only its
shared filter. Parser and range contracts stay internal.

Profanity is a dictionary-independent runtime with structural inputs and one
compiled matcher implementation. The Russian and English language workspaces
contain only versioned source data and generated `dist/index.js` and
`dist/index.d.ts` outputs.

Spam is a stateful guard. Actor state, configuration normalization, text
normalization, and public contracts stay separate. Guard instances are not
shared across unrelated moderation scopes unless the caller intentionally
wants shared state.

Core owns shared contracts, filter combination, moderation orchestration, and
UTF-16 masking. Detector normalization and internal range conversion stay in
the detector workspace that needs them.

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

## Workspace Tooling

The root owns shared development dependencies and TypeScript defaults.
Workspace manifests contain only runtime dependencies and package-specific
scripts, while each workspace `tsconfig.json` extends `tsconfig.base.json`.

Root package commands run workspaces sequentially in the declared order through
`scripts/run-workspace-script.mjs`. Keeping `core` first ensures dependent
workspace tests resolve a freshly built local package without repeating the
workspace list in every script.

## Alignment Rules

- Prefer additive public exports unless an issue explicitly scopes a breaking
  contract replacement.
- Do not retain compatibility layers for an explicitly breaking replacement.
- Keep shared defaults stable.
- Add isolated factory options instead of changing default behavior.
- Keep package runtime ownership inside its workspace.
- Document package-specific layout exceptions beside the package.
