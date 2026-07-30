# Changelog

## [0.2.2](https://github.com/textfilters/phone/compare/v0.2.1...v0.2.2) (2026-07-22)


### Bug Fixes

* index numeric metadata validation ([0e045ae](https://github.com/textfilters/phone/commit/0e045aebb75cd20872aeab19173fc927cf03502d))

## [0.2.1](https://github.com/textfilters/phone/compare/v0.2.0...v0.2.1) (2026-07-14)


### Bug Fixes

* updated core dependency to 0.4.0 ([f4c6bb0](https://github.com/textfilters/phone/commit/f4c6bb019a63ced27341e858e0b7288e88853a9e))

## [0.2.0](https://github.com/textfilters/phone/compare/v0.1.5...v0.2.0) (2026-07-01)


### Features

* align phone scanner contract ([99c95d6](https://github.com/textfilters/phone/commit/99c95d6c3fb1c429bfdc5e5036e7a4fb3f391792))

## [0.1.5](https://github.com/textfilters/phone/compare/v0.1.4...v0.1.5) (2026-06-30)


### Performance Improvements

* align phone scanner with shared hints ([1873e7e](https://github.com/textfilters/phone/commit/1873e7e91f5ca9cec5ef548f9fa086ac890f9a1a))
* introduce phone scanner prefilter ([0dd7338](https://github.com/textfilters/phone/commit/0dd7338eed4b5d1e27fcb443783a148338389929))

## [0.1.4](https://github.com/textfilters/phone/compare/v0.1.3...v0.1.4) (2026-06-25)


### Bug Fixes

* use shared public input normalization ([b93f3d6](https://github.com/textfilters/phone/commit/b93f3d6958ed230a556b9857ca4594825011b4af))

## [0.1.3](https://github.com/textfilters/phone/compare/v0.1.2...v0.1.3) (2026-06-21)


### Bug Fixes

* adopt core length-preserving masking ([672ab6f](https://github.com/textfilters/phone/commit/672ab6faf7169ef01502bae62776ad040d72a1e1))

## [0.1.2](https://github.com/textfilters/phone/compare/v0.1.1...v0.1.2) (2026-06-08)


### Bug Fixes

* added phone regression coverage ([a6745b7](https://github.com/textfilters/phone/commit/a6745b78fc2a051296f4bcbac8ea308da69c63b6))

## [0.1.1](https://github.com/textfilters/phone/compare/v0.1.0...v0.1.1) (2026-06-08)


### Bug Fixes

* added phone regression coverage ([a6745b7](https://github.com/textfilters/phone/commit/a6745b78fc2a051296f4bcbac8ea308da69c63b6))

## 0.1.0 (2026-06-04)

Initial release of `@textfilters/phone`.

- Phone-like sequence censor with a small `filter` export and configurable `createPhoneFilter(...)` factory.
- Unicode digit normalization for matching non-ASCII digit forms.
- RU and international phone-format coverage.
- False-positive guards for dates, times, coordinates, IP/server-like text, and balance-like numeric text.
- Architecture documentation and GitHub Packages release flow.
