# Changelog

## [0.3.2](https://github.com/textfilters/spam/compare/v0.3.1...v0.3.2) (2026-07-14)


### Bug Fixes

* updated core dependency to 0.4.0 ([a8676ff](https://github.com/textfilters/spam/commit/a8676ffd75ada4f3a6d030cf6e885336dc228cc6))

## [0.3.1](https://github.com/textfilters/spam/compare/v0.3.0...v0.3.1) (2026-07-01)


### Bug Fixes

* preserve spam burst state compatibility ([0e3f54e](https://github.com/textfilters/spam/commit/0e3f54e842272322b10b6e055fd38fd2be1ae2a6))

## [0.3.0](https://github.com/textfilters/spam/compare/v0.2.1...v0.3.0) (2026-06-29)


### Features

* add spam policy controls ([#13](https://github.com/textfilters/spam/issues/13)) ([488ca36](https://github.com/textfilters/spam/commit/488ca3645fb7f5dc36a1d47d0a5e3506d02a2408))


### Bug Fixes

* added spam regression coverage ([0e6f99c](https://github.com/textfilters/spam/commit/0e6f99c966dc42e983e9491814d18ba2ad496fec))

## [0.2.1](https://github.com/textfilters/spam/compare/v0.2.0...v0.2.1) (2026-06-30)


### Bug Fixes

* align core dependency with supported line ([ce334e6](https://github.com/textfilters/spam/commit/ce334e618495461e26c0c9d394eb0c3bebd21098))
* bound memory spam state store ([553eebc](https://github.com/textfilters/spam/commit/553eebc40b905e215efb5a0588c6898511587463))
* fix nonmonotonic burst pruning ([b17cae0](https://github.com/textfilters/spam/commit/b17cae0770da0219bd879970f412519a4c4f8a64))


### Documentation

* document spam clock semantics ([4b8a752](https://github.com/textfilters/spam/commit/4b8a752cb87d50905c2fc1a9c0f99a24d9c7a71f))


### Performance Improvements

* reduce guard state pruning overhead ([14123d5](https://github.com/textfilters/spam/commit/14123d51eae17d29fe6691446ff53c28334b652d))

## [0.2.0](https://github.com/textfilters/spam/compare/v0.1.2...v0.2.0) (2026-06-22)


### Features

* add spam policy controls ([#13](https://github.com/textfilters/spam/issues/13)) ([488ca36](https://github.com/textfilters/spam/commit/488ca3645fb7f5dc36a1d47d0a5e3506d02a2408))

## [0.1.2](https://github.com/textfilters/spam/compare/v0.1.1...v0.1.2) (2026-06-08)


### Bug Fixes

* added spam regression coverage ([0e6f99c](https://github.com/textfilters/spam/commit/0e6f99c966dc42e983e9491814d18ba2ad496fec))

## [0.1.1](https://github.com/textfilters/spam/compare/v0.1.0...v0.1.1) (2026-06-08)


### Bug Fixes

* added spam regression coverage ([0e6f99c](https://github.com/textfilters/spam/commit/0e6f99c966dc42e983e9491814d18ba2ad496fec))

## 0.1.0 (2026-06-04)

Initial release of `@textfilters/spam`.

- In-memory spam guard with actor-based interval, duplicate, and burst checks.
- Stable block reasons for caller-owned moderation policy.
- Bounded actor state pruning for long-running processes.
- ESM runtime import smoke coverage for the built package entrypoint.
- Architecture documentation and GitHub Packages release flow.
