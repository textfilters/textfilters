# Performance Budget

## Purpose

The benchmark suite is a comparison tool for the same machine, Node.js version,
package set, and command shape. Absolute numbers are not portable. Use this
budget to decide whether a performance change needs investigation before a PR is
merged in a package repository.

## Command

```sh
npm run benchmark -- combined
```

Run the full benchmark suite when a change affects more than combined scanner
coordination:

```sh
npm run benchmark
```

## Baseline Capture

Record these fields in PRs that change performance-sensitive code:

| Field | Required value |
| --- | --- |
| Package refs | Published versions or local checkout branches used for the run |
| Runtime | Node.js major version and npm package manager version |
| Command | Exact benchmark command |
| Scope | Suites and scenarios compared |
| Result | Before/after `avg ms` or a concise summary for changed rows |
| Caveat | Known local noise, skipped rows, or unavailable scanner exports |

## Regression Rules

Treat a row as actionable when the same regression repeats across at least three
runs on the same setup:

| Row type | Budget |
| --- | --- |
| Setup rows | Up to 15% slower unless creation happens on a hot path |
| Short clean checks | Up to 10% slower |
| Long clean checks | Up to 10% slower |
| Positive match scan/censor rows | Up to 15% slower |
| Late-match rows | Up to 15% slower |
| Dictionary compilation rows | Up to 20% slower |
| Spam state pruning rows | Up to 15% slower |

Any larger repeated regression should be explained in the PR body or fixed
before merge. A faster shared-hints `check()` path does not justify a slower
`scan()` or `censor()` path unless the tradeoff is documented and intentional.

## Combined Scanner Rows

The combined benchmark compares three paths when the installed package set
exposes the required public APIs:

| Path | Measures |
| --- | --- |
| `combined legacy sequential` | Existing wrapper pipeline that calls package censors in order |
| `combined scanner ranges` | Existing range scanner pipeline using scan/censor flows |
| `combined shared hints` | Shared-hints scanner set using `check()`, `scan()`, and `censor()` flows |

Rows are skipped when the installed published packages do not expose the
required scanner APIs yet. That skip is expected while shared scanner work is in
flight. For unpublished package work, link or install local package builds and
record the package refs in the PR body.

## Current Baseline

The current published package set exposes the legacy wrapper path only. Scanner
range and shared-hints rows are expected to be skipped until the corresponding
package PRs are released or locally linked for benchmark runs.
