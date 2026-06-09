# Changelog

## [0.1.1](https://github.com/textfilters/profanity/compare/v0.1.0...v0.1.1) (2026-06-09)


### Bug Fixes

* harden profanity matching and test layout ([73f8bfb](https://github.com/textfilters/profanity/commit/73f8bfb524af353deb217a7bfb18e1abdadb15af))

## 0.1.0 (2026-06-04)

Initial release of `@textfilters/profanity`.

- Profanity censor and boolean check package with a small `filter` export and configurable `createProfanityFilter(...)` factory.
- Built-in strict and loose dictionaries.
- Runtime dictionary terms treated as normalized literals, not regular expressions.
- Internal package-owned rule compiler for the bundled corpus.
- Length-preserving masking for JavaScript strings.
- Architecture documentation and GitHub Packages release flow.
