# Benchmarks

## Overview

The benchmark suite measures the runtime cost of the current `@textfilters/*`
package set on representative inputs. Use it for **before/after comparisons on
the same machine**. Absolute numbers depend on hardware, OS scheduling, Node.js
version, and local load.

## Setup

Packages are published on GitHub Packages, so npm must use the GitHub Packages
registry for the `@textfilters` scope and must be authenticated before install.
This repository commits the scope registry in `.npmrc`; provide authentication
with your normal GitHub Packages npm setup, for example a user-level npm token
or `NODE_AUTH_TOKEN`.

```sh
npm install
npm run benchmark
```

No build step is required. The runner uses Node.js built-in modules and public
package exports only.

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
| many messages · same actor | Actor state growth and pruning pressure |

### Combined Pipeline

`url + email + phone + profanity` in one `TextPipeline`:

- short clean text
- long clean text
- short text with all match types
- long text with matches near the end

## Interpreting Results

- Compare runs on the same machine before and after a change.
- Treat a regression as meaningful only when it repeats across several runs.
- `ops/sec` is derived from `avg ms`; prefer `avg ms` for precise comparisons.
- `profanity · compileProfanityDictionary()` is expected to be slower than
  runtime calls because it is a setup operation. Reuse the compiled result with
  `createProfanityFilterFromCompiledDictionary()` when measuring hot paths.
