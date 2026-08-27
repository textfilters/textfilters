# Performance Budget

## Purpose

The benchmark suite is a comparison tool for the same machine, Node.js version,
workspace state, and command shape. Absolute numbers are not portable. Use this
budget to decide whether a performance change needs investigation before a pull
request is merged.

## Command

```sh
npm run benchmark -- combined
```

Run the full benchmark suite when a change affects more than combined filter
coordination:

```sh
npm run benchmark
```

## Baseline Capture

Record these fields in PRs that change performance-sensitive code:

| Field        | Required value                                                  |
| ------------ | --------------------------------------------------------------- |
| Package refs | Baseline and branch commits used for the run                    |
| Runtime      | Node.js major version and npm package manager version           |
| Command      | Exact benchmark command                                         |
| Scope        | Suites and scenarios compared                                   |
| Result       | Before/after `avg ms` or a concise summary for changed rows     |
| Caveat       | Known local noise, skipped rows, or unavailable package exports |

## Regression Rules

Treat a row as actionable when the same regression repeats across at least three
runs on the same setup:

| Row type                                | Budget                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| Setup rows                              | Up to 15% slower unless creation happens on a hot path |
| Short clean checks                      | Up to 10% slower                                       |
| Long clean checks                       | Up to 10% slower                                       |
| Positive match find/censor/process rows | Up to 15% slower                                       |
| Late-match rows                         | Up to 15% slower                                       |
| Dictionary compilation rows             | Up to 20% slower                                       |
| Spam state pruning rows                 | Up to 15% slower                                       |

Any larger repeated regression should be explained in the PR body or fixed
before merge. A faster `check()` path does not justify slower `find()`,
`censor()`, or `process()` paths unless the tradeoff is documented and
intentional.

## Combined Filter Rows

The combined benchmark runs URL, email, phone, and profanity filters against the
same original input through `combineFilters()`:

| Operation   | Measures                                                       |
| ----------- | -------------------------------------------------------------- |
| `check()`   | Boolean early exit without creating the full public match list |
| `find()`    | Source-ordered child matches on the original input             |
| `censor()`  | Merged UTF-16 ranges and one masking pass                      |
| `process()` | Censored text and the collected matches from one call          |

The eight current workspaces expose the required public APIs. A skipped combined
row is therefore a validation failure unless the pull request intentionally
changes that public contract.

## Current Baseline

The current workspace set exposes the common `TextFilter` contract and
`combineFilters()`. Benchmark rows must run after `npm run build`.
