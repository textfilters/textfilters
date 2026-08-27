# Benchmarks

## Overview

The benchmark suite measures the runtime cost of the current `@textfilters/*`
workspaces on representative inputs. Use it for **before/after comparisons on
the same machine**. Absolute numbers depend on hardware, OS scheduling, Node.js
version, and local load. See [ecosystem policy](ecosystem-policy.md) for the
performance comparison expectations that PRs should follow, and see
[performance budget](performance-budget.md) for regression thresholds and PR
reporting expectations.

## Setup

Install and build the monorepo from the repository root:

```sh
npm ci
npm run build
npm run benchmark
```

The runner uses Node.js built-in modules and the built public exports of the eight
local workspaces. It does not import package internals.

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

| Column     | Meaning                               |
| ---------- | ------------------------------------- |
| `iter`     | Iteration count                       |
| `total ms` | Total elapsed time for all iterations |
| `avg ms`   | Average time per iteration            |
| `ops/sec`  | Approximate operations per second     |

## Coverage

### `core` pipeline

| Case                             | Measures                             |
| -------------------------------- | ------------------------------------ |
| create single-filter pipeline    | Setup cost for a one-filter pipeline |
| create multi-filter pipeline     | Setup cost for a chained pipeline    |
| single filter · short/long clean | `censor()` overhead with no match    |
| single filter · short/long match | URL detection and masking cost       |
| multi filter · short/long        | Chained censor overhead              |

### `url`, `email`, and `phone`

Each censor runs these scenarios plus one custom `maskChar` case:

- **short no-match**: baseline cost on short clean text
- **long no-match**: baseline cost on long clean text, about 2 KB
- **short positive-match**: detection and masking on short text
- **long text with match late**: match near the end of long text
- **custom maskChar**: option overhead for a non-default mask character

### `profanity`

| Case                                  | Measures                                                 |
| ------------------------------------- | -------------------------------------------------------- |
| full RU, EN, and RU+EN construction   | One-time structural dictionary indexing cost             |
| retained RU+EN filters                | Approximate same-process heap growth per reusable filter |
| `check()` short/long clean            | No-match detection                                       |
| `check()` early/late match            | Early-exit and late-match detection                      |
| phrase and obfuscated inputs          | Multi-token and normalized matching paths                |
| `find()`, `censor()`, and `process()` | Source ranges, masking, and combined result creation     |

The dedicated package benchmark runs with the complete maintained Russian and
English dictionaries. Memory output is an approximate local comparison, not a
portable allocation claim.

### `spam`

The spam guard is stateful, so every benchmark case creates its own guard and
uses explicit `nowMs` values instead of wall-clock time.

| Case                            | Measures                                        |
| ------------------------------- | ----------------------------------------------- |
| `createSpamFilter()`            | Guard creation cost                             |
| check · allowed                 | Happy path through all checks                   |
| check · tooFast block           | Early exit on interval violation                |
| check · duplicate block         | Duplicate detection within the duplicate window |
| check · burst block             | Burst threshold rejection                       |
| many messages · same actor      | Repeated checks and state growth for one actor  |
| many actors · maxActors pruning | Actor-map pruning under churn                   |

### Combined Pipeline

The combined suite measures one `combineFilters()` instance containing URL,
email, phone, and full RU+EN profanity filters. Each child receives the same
original input. `censor()` and `process()` merge all accepted UTF-16 ranges and
apply one masking pass.

Setup rows are printed separately from steady-state rows. The steady-state
matrix covers:

- short clean text
- long clean text
- short text with all match types
- long text with matches near the end
- mixed URL/email/phone/profanity inputs
- Cyrillic clean text
- obfuscated profanity candidates

Every scenario records `check()`, `find()`, `censor()`, and `process()` so the
boolean early-exit path stays distinct from full match collection and masking.

## Interpreting Results

- Compare runs on the same machine before and after a change.
- Treat a regression as meaningful only when it repeats across several runs.
- `ops/sec` is derived from `avg ms`; prefer `avg ms` for precise comparisons.
- For combined benchmark work, compare rows with the same operation and input
  suffix between the baseline and branch.
- Compare combined `check()` with `find()`, `censor()`, and `process()` on the
  same input to confirm boolean checks avoid unnecessary full-match work.
- Profanity construction is a setup operation. Create selected filters once and
  reuse them when measuring hot paths.
