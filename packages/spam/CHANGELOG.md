# Changelog

## 0.3.2 (2026-07-14)


### Bug Fixes

* updated core dependency to 0.4.0 (a8676ff)

## 0.3.1 (2026-07-01)


### Bug Fixes

* preserve spam burst state compatibility (0e3f54e)

## 0.3.0 (2026-06-29)


### Features

* add spam policy controls (#13) (488ca36)


### Bug Fixes

* added spam regression coverage (0e6f99c)

## 0.2.1 (2026-06-30)


### Bug Fixes

* align core dependency with supported line (ce334e6)
* bound memory spam state store (553eebc)
* fix nonmonotonic burst pruning (b17cae0)


### Documentation

* document spam clock semantics (4b8a752)


### Performance Improvements

* reduce guard state pruning overhead (14123d5)

## 0.2.0 (2026-06-22)


### Features

* add spam policy controls (#13) (488ca36)

## 0.1.2 (2026-06-08)


### Bug Fixes

* added spam regression coverage (0e6f99c)

## 0.1.1 (2026-06-08)


### Bug Fixes

* added spam regression coverage (0e6f99c)

## 0.1.0 (2026-06-04)

Initial release of `@textfilters/spam`.

- In-memory spam guard with actor-based interval, duplicate, and burst checks.
- Stable block reasons for caller-owned moderation policy.
- Bounded actor state pruning for long-running processes.
- ESM runtime import smoke coverage for the built package entrypoint.
- Architecture documentation and GitHub Packages release flow.
