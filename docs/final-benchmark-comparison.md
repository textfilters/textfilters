# Final Benchmark Comparison

## Summary

This report compares the combined `url + email + phone + profanity` benchmark
after the shared scanner contract work landed across the package repositories.
The run uses the control-plane benchmark harness and the dependency set pinned
in this repository.

The control-plane repository remains documentation, benchmark, and metadata
only. No package implementation code is added here.

## Package References

| Package | PR | Merge commit |
| --- | --- | --- |
| `@textfilters/core` | `textfilters/core#39` | `9e8a8bff18f4ca9e53c407d3dd4921beca996d1b` |
| `@textfilters/url` | `textfilters/url#27` | `4432cc73c22c46817e4053a7958ffc5aab9924c1` |
| `@textfilters/email` | `textfilters/email#36` | `a87c592fb5a97ef8241fcabda583a06dcf63c74a` |
| `@textfilters/phone` | `textfilters/phone#27` | `99c95d6c3fb1c429bfdc5e5036e7a4fb3f391792` |
| `@textfilters/profanity` | `textfilters/profanity#145` | `1abf767c695775233de6b4cb6fc59e50cabf879a` |
| `@textfilters/spam` | `textfilters/spam#31` | `0e3f54e842272322b10b6e055fd38fd2be1ae2a6` |

## Command

```sh
npm run benchmark -- combined
```

The dependency set exposes the scanner exports required by the combined harness,
so legacy sequential, range scanner, and shared-hints scanner rows all ran.

## Setup Rows

| Row | avg ms |
| --- | ---: |
| combined pipeline · create composed pipeline | 0.0532 |
| combined scanner ranges · create pipeline | 0.0576 |
| combined shared hints · create scanner set | 0.0689 |

Scanner setup is slightly higher than the legacy composed pipeline, but setup is
not the hot path for normal censor/check calls.

## Short And Clean Inputs

| Scenario | Legacy sequential censor | Range scanner scan | Range scanner censor | Shared-hints check | Shared-hints scan | Shared-hints censor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| short clean | 0.0763 | 0.0686 | 0.0709 | 0.0653 | 0.0683 | 0.0666 |
| long clean | 5.2407 | 5.1776 | 5.0040 | 5.0350 | 4.9394 | 4.9199 |
| cyrillic clean | 0.0781 | 0.0815 | 0.0824 | 0.0754 | 0.0778 | 0.0798 |

Clean text benefits from the shared scanner paths. The long clean case improves
because the scanner paths avoid repeated full censor passes through the legacy
pipeline.

## Positive Matches

| Scenario | Legacy sequential censor | Range scanner scan | Range scanner censor | Shared-hints check | Shared-hints scan | Shared-hints censor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| short all-match | 0.2361 | 0.3334 | 0.3258 | 0.0185 | 0.2978 | 0.2993 |
| long match late | 4.4535 | 6.1990 | 6.4022 | 0.3912 | 6.2651 | 6.4815 |
| mixed overlaps | 0.2183 | 0.2884 | 0.2888 | 0.0138 | 0.2869 | 0.2886 |
| obfuscated | 0.1388 | 0.2100 | 0.2102 | 0.1547 | 0.2104 | 0.2121 |

The shared-hints `check()` path is materially faster for positive direct-match
cases because it can stop after the first scanner hit instead of collecting and
masking every range. Full `scan()` and `censor()` remain more expensive than the
legacy sequential path for positive multi-match cases because they preserve
range metadata and run one combined masking pass after all scanners complete.

The obfuscated case is the exception for `check()`: loose profanity candidate
matching still does more work than direct URL, email, and phone checks, so the
shared-hints check path is slightly slower than legacy censor for that case.

## Interpretation

- Legacy sequential remains a strong default for direct `censor()` on positive
  short inputs.
- Range scanner paths are useful when callers need comparable range metadata or
  one coordinated mask pass across multiple scanners.
- Shared-hints `check()` is the fast path for boolean moderation decisions,
  especially direct positive matches and late matches.
- Shared-hints `scan()` and `censor()` should be evaluated row-by-row before
  replacing legacy censor flows in hot positive-match paths.
- Scanner rows are now available for the aligned package set instead of being
  skipped by missing exports.

## Follow-Up Budget Notes

No performance budget threshold needs to change. The existing budget already
requires row-by-row comparison and documented tradeoffs when a faster `check()`
path comes with slower `scan()` or `censor()` rows.
