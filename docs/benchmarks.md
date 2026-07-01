# Benchmarks

## Overview

The benchmark suite measures the runtime cost of the current `@textfilters/*`
package set on representative inputs. Use it for **before/after comparisons on
the same machine**. Absolute numbers depend on hardware, OS scheduling, Node.js
version, and local load. See [ecosystem policy](ecosystem-policy.md) for the
performance comparison expectations that PRs should follow, and see
[performance budget](performance-budget.md) for regression thresholds and PR
reporting expectations.

## Setup

Packages are published on GitHub Packages, so npm must use the GitHub Packages
registry for the `@textfilters` scope and must be authenticated before install.
This repository commits the scope registry in `.npmrc`, matching the package
repositories. Keep authentication outside the project file so user-level npm
config and CI-generated auth are not overridden.

```sh
export NODE_AUTH_TOKEN=<github-token-with-read-packages>
npm config set //npm.pkg.github.com/:_authToken "$NODE_AUTH_TOKEN" --location=user
npm install
npm run benchmark
```

No build step is required for published packages. The runner uses Node.js
built-in modules and public package exports only. The combined scanner rows are
printed when the installed or locally linked package set exposes the public
range scanner exports.

## Running a Subset

Pass one or more suite names after `--` to run only part of the benchmark set:

```sh
npm run benchmark -- profanity
npm run benchmark -- url email phone
npm run benchmark -- spam combined
```

Supported suite names are:

- `core`
- `url`
- `email`
- `phone`
- `profanity`
- `spam`
- `combined`

Use `npm run benchmark -- --help` to print the suite list in the terminal.

## Output Format

Each row contains four measurements:

| Column | Meaning |
|---|---|
| `iter` | Iteration count |
| `total ms` | Total elapsed time for all iterations |
| `avg ms` | Average time per iteration |
| `ops/sec` | Approximate operations per second |

## Coverage

### `core` pipeline

| Case | Measures |
|---|---|
| create single-filter pipeline | Setup cost for a one-filter pipeline |
| create multi-filter pipeline | Setup cost for a chained pipeline |
| single filter · short/long clean | `censor()` overhead with no match |
| single filter · short/long match | URL detection and masking cost |
| multi filter · short/long | Chained censor overhead |

### `url`, `email`, and `phone`

Each censor runs these scenarios plus one custom `maskChar` case:

- **short no-match**: baseline cost on short clean text
- **long no-match**: baseline cost on long clean text, about 2 KB
- **short positive-match**: detection and masking on short text
- **long text with match late**: match near the end of long text
- **custom maskChar**: option overhead for a non-default mask character

### `profanity`

| Case | Measures |
|---|---|
| `compileProfanityDictionary()` | One-time dictionary compilation cost |
| `createProfanityFilterFromDictionary()` | Filter creation from a raw dictionary |
| `createProfanityFilterFromCompiledDictionary()` | Filter creation from a reused compiled dictionary |
| `check()` short/long clean | No-match detection |
| `check()` short/long match | Positive-match detection |
| `censor()` short/long | Detection plus masking |
| `analyze()` short/match/long | Full analysis result creation |
| compiled reuse · `censor()` | Runtime censoring with a reused compiled dictionary |

### `spam`

The spam guard is stateful, so every benchmark case creates its own guard and
uses explicit `nowMs` values instead of wall-clock time.

| Case | Measures |
|---|---|
| `createSpamFilter()` | Guard creation cost |
| check · allowed | Happy path through all checks |
| check · tooFast block | Early exit on interval violation |
| check · duplicate block | Duplicate detection within the duplicate window |
| check · burst block | Burst threshold rejection |
| many messages · same actor | Repeated checks and state growth for one actor |
| many actors · maxActors pruning | Actor-map pruning under churn |

### Combined Pipeline

`url + email + phone + profanity` in three comparable paths when scanner exports
are available:

- `combined legacy sequential`: the existing `TextPipeline` that censors through
  each package in registration order
- `combined scanner ranges`: the range scanner pipeline that collects URL,
  email, phone, and profanity ranges before applying one mask pass
- `combined shared hints`: the shared-hints scanner set that measures `check()`,
  `scan()`, and `censor()` separately when the installed packages expose the
  allocation-aware scanner contract

Setup rows are printed separately from steady-state rows. The steady-state
matrix covers:

- short clean text
- long clean text
- short text with all match types
- long text with matches near the end
- mixed URL/email/phone/profanity inputs
- Cyrillic clean text
- obfuscated profanity candidates

If the installed package set does not expose scanner exports yet, the benchmark
prints a skip message for scanner rows and still runs the legacy sequential
rows. Link or install local package builds to compare unpublished scanner work
before release.

## Interpreting Results

- Compare runs on the same machine before and after a change.
- Treat a regression as meaningful only when it repeats across several runs.
- `ops/sec` is derived from `avg ms`; prefer `avg ms` for precise comparisons.
- For combined benchmark work, compare rows with the same input suffix, such as
  `combined legacy sequential · censor · long clean` against
  `combined scanner ranges · censor · long clean`.
- Compare `combined shared hints · check` against `scan` and `censor` rows to
  confirm boolean checks avoid unnecessary full-match work.
- `profanity · compileProfanityDictionary()` is expected to be slower than
  runtime calls because it is a setup operation. Reuse the compiled result with
  `createProfanityFilterFromCompiledDictionary()` when measuring hot paths.
