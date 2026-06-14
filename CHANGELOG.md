# Changelog

## [0.10.0](https://github.com/textfilters/profanity/compare/v0.9.0...v0.10.0) (2026-06-14)


### Features

* add language dictionary validator cli ([2c9707b](https://github.com/textfilters/profanity/commit/2c9707b993f61fdffcc07f061fcc0508a7a3ac67))

## [0.9.0](https://github.com/textfilters/profanity/compare/v0.8.0...v0.9.0) (2026-06-12)


### Features

* add language dictionary conformance validator ([eafef1a](https://github.com/textfilters/profanity/commit/eafef1a67363d28c7e2b42ff5913d208749d626b))

## [0.8.0](https://github.com/textfilters/profanity/compare/v0.7.0...v0.8.0) (2026-06-11)


### Features

* expose profanity language dictionary API ([a1f58ed](https://github.com/textfilters/profanity/commit/a1f58ede25d0a0b1a685af6ee6e02c228b46bb39))

## [0.7.0](https://github.com/textfilters/profanity/compare/v0.6.0...v0.7.0) (2026-06-11)


### Features

* add semantic metadata to Russian dictionary rules ([a93a529](https://github.com/textfilters/profanity/commit/a93a52907eaf3700188817e8e7680ad5dc4c7b3a))

## [0.6.0](https://github.com/textfilters/profanity/compare/v0.5.0...v0.6.0) (2026-06-11)


### Features

* improve aggressive profanity obfuscation coverage ([310402f](https://github.com/textfilters/profanity/commit/310402f42dfae438432b9089a9933c350a1417ea))

## [0.5.0](https://github.com/textfilters/profanity/compare/v0.4.0...v0.5.0) (2026-06-11)


### Features

* add min severity taxonomy filter ([#42](https://github.com/textfilters/profanity/issues/42)) ([e84f526](https://github.com/textfilters/profanity/commit/e84f52612e91ab80f3a2b6712ad3f938adc34afc))

## [0.4.0](https://github.com/textfilters/profanity/compare/v0.3.0...v0.4.0) (2026-06-11)


### Features

* add taxonomy filtering options ([2e7486c](https://github.com/textfilters/profanity/commit/2e7486ccba96b46560288cdf3a532493be99f56a))

## [0.3.0](https://github.com/textfilters/profanity/compare/v0.2.0...v0.3.0) (2026-06-10)


### Features

* expose taxonomy metadata on matches ([da19dce](https://github.com/textfilters/profanity/commit/da19dce74ec420844067bb49f833a9416dbb0a7e))

## [0.2.0](https://github.com/textfilters/profanity/compare/v0.1.2...v0.2.0) (2026-06-10)


### Features

* export taxonomy metadata types ([da612be](https://github.com/textfilters/profanity/commit/da612be785f510b679dbe593cc2c081121ac4795))

## [0.1.2](https://github.com/textfilters/profanity/compare/v0.1.1...v0.1.2) (2026-06-09)


### Bug Fixes

* load built-in corpus from JSON data files ([e746524](https://github.com/textfilters/profanity/commit/e74652405c41958e64c6c80b05b182bd5abb6419))

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
