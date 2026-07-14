# Changelog

## [0.2.1](https://github.com/textfilters/url/compare/v0.2.0...v0.2.1) (2026-07-14)


### Bug Fixes

* updated core dependency to 0.4.0 ([b57f4fd](https://github.com/textfilters/url/commit/b57f4fd6b83296fd761e0ecbb0291316b8418486))

## [0.2.0](https://github.com/textfilters/url/compare/v0.1.6...v0.2.0) (2026-07-01)


### Features

* align URL scanner contract ([4432cc7](https://github.com/textfilters/url/commit/4432cc73c22c46817e4053a7958ffc5aab9924c1))

## [0.1.6](https://github.com/textfilters/url/compare/v0.1.5...v0.1.6) (2026-06-29)


### Bug Fixes

* adopt core length-preserving masking ([f6a8a41](https://github.com/textfilters/url/commit/f6a8a417f20c49070b14cc1f79ac1b6b6218256e))
* expanded URL coverage ([43973f0](https://github.com/textfilters/url/commit/43973f00bfbf44c68ba13c4ef3fa02be7e93e3e1))
* use shared public input normalization ([bb0e9df](https://github.com/textfilters/url/commit/bb0e9df008f13b59f661e7b60b01498203a43b69))

## [0.1.5](https://github.com/textfilters/url/compare/v0.1.4...v0.1.5) (2026-06-30)


### Performance Improvements

* add URL scanner prefilter ([66d74bd](https://github.com/textfilters/url/commit/66d74bd702445ef66033c877bbd424c6c5e4207c))
* align URL scanner with shared hints ([16dc6d4](https://github.com/textfilters/url/commit/16dc6d4eef88c274cc01ef253342a7eb6c4bdd06))

## [0.1.4](https://github.com/textfilters/url/compare/v0.1.3...v0.1.4) (2026-06-25)


### Bug Fixes

* use shared public input normalization ([bb0e9df](https://github.com/textfilters/url/commit/bb0e9df008f13b59f661e7b60b01498203a43b69))

## [0.1.3](https://github.com/textfilters/url/compare/v0.1.2...v0.1.3) (2026-06-21)


### Bug Fixes

* adopt core length-preserving masking ([f6a8a41](https://github.com/textfilters/url/commit/f6a8a417f20c49070b14cc1f79ac1b6b6218256e))

## [0.1.2](https://github.com/textfilters/url/compare/v0.1.1...v0.1.2) (2026-06-09)


### Bug Fixes

* expanded URL coverage ([43973f0](https://github.com/textfilters/url/commit/43973f00bfbf44c68ba13c4ef3fa02be7e93e3e1))

## [0.1.1](https://github.com/textfilters/url/compare/v0.1.0...v0.1.1) (2026-06-08)


### Bug Fixes

* expanded URL coverage ([43973f0](https://github.com/textfilters/url/commit/43973f00bfbf44c68ba13c4ef3fa02be7e93e3e1))

## 0.1.0 (2026-06-04)

Initial release of `@textfilters/url`.

- URL and obfuscated-link censor with a small `filter` export and configurable `createUrlFilter(...)` factory.
- Bare domain filtering with configured TLDs.
- Explicit-scheme authority support for localhost, ports, IPv6, userinfo, IDN/emoji hosts, and unknown TLDs.
- Defanged dot, `hxxp`, and split-scheme handling.
- Length-preserving masking for JavaScript strings.
- Architecture documentation and GitHub Packages release flow.
