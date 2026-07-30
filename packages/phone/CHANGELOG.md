# Changelog

## 0.2.2 (2026-07-22)


### Bug Fixes

* index numeric metadata validation (0e045ae)

## 0.2.1 (2026-07-14)


### Bug Fixes

* updated core dependency to 0.4.0 (f4c6bb0)

## 0.2.0 (2026-07-01)


### Features

* align phone scanner contract (99c95d6)

## 0.1.5 (2026-06-30)


### Performance Improvements

* align phone scanner with shared hints (1873e7e)
* introduce phone scanner prefilter (0dd7338)

## 0.1.4 (2026-06-25)


### Bug Fixes

* use shared public input normalization (b93f3d6)

## 0.1.3 (2026-06-21)


### Bug Fixes

* adopt core length-preserving masking (672ab6f)

## 0.1.2 (2026-06-08)


### Bug Fixes

* added phone regression coverage (a6745b7)

## 0.1.1 (2026-06-08)


### Bug Fixes

* added phone regression coverage (a6745b7)

## 0.1.0 (2026-06-04)

Initial release of `@textfilters/phone`.

- Phone-like sequence censor with a small `filter` export and configurable `createPhoneFilter(...)` factory.
- Unicode digit normalization for matching non-ASCII digit forms.
- RU and international phone-format coverage.
- False-positive guards for dates, times, coordinates, IP/server-like text, and balance-like numeric text.
- Architecture documentation and GitHub Packages release flow.
