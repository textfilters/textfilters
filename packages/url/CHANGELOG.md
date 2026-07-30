# Changelog

## 0.3.0 (2026-07-20)


### Features

* add configurable URL domain allowlist (#33) (c3bfc7b)

## 0.2.1 (2026-07-14)


### Bug Fixes

* updated core dependency to 0.4.0 (b57f4fd)

## 0.2.0 (2026-07-01)


### Features

* align URL scanner contract (4432cc7)

## 0.1.6 (2026-06-29)


### Bug Fixes

* adopt core length-preserving masking (f6a8a41)
* expanded URL coverage (43973f0)
* use shared public input normalization (bb0e9df)

## 0.1.5 (2026-06-30)


### Performance Improvements

* add URL scanner prefilter (66d74bd)
* align URL scanner with shared hints (16dc6d4)

## 0.1.4 (2026-06-25)


### Bug Fixes

* use shared public input normalization (bb0e9df)

## 0.1.3 (2026-06-21)


### Bug Fixes

* adopt core length-preserving masking (f6a8a41)

## 0.1.2 (2026-06-09)


### Bug Fixes

* expanded URL coverage (43973f0)

## 0.1.1 (2026-06-08)


### Bug Fixes

* expanded URL coverage (43973f0)

## 0.1.0 (2026-06-04)

Initial release of `@textfilters/url`.

- URL and obfuscated-link censor with a small `filter` export and configurable `createUrlFilter(...)` factory.
- Bare domain filtering with configured TLDs.
- Explicit-scheme authority support for localhost, ports, IPv6, userinfo, IDN/emoji hosts, and unknown TLDs.
- Defanged dot, `hxxp`, and split-scheme handling.
- Length-preserving masking for JavaScript strings.
- Architecture documentation and GitHub Packages release flow.
