# Changelog

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
