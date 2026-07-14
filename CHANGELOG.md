# Changelog

## [0.15.2](https://github.com/textfilters/profanity/compare/v0.15.1...v0.15.2) (2026-07-14)


### Bug Fixes

* updated core dependency to 0.4.0 ([8a839d3](https://github.com/textfilters/profanity/commit/8a839d37b5655a191102d0462393978e9b083a2e))

## [0.15.1](https://github.com/textfilters/profanity/compare/v0.15.0...v0.15.1) (2026-07-13)


### Bug Fixes

* expose English language pack ([455ce27](https://github.com/textfilters/profanity/commit/455ce27de25fb640b4d6602fb70f8714a869867e))

## [0.15.0](https://github.com/textfilters/profanity/compare/v0.14.2...v0.15.0) (2026-07-13)


### Features

* add reviewed English profanity pack ([1361734](https://github.com/textfilters/profanity/commit/13617346a9b93a5b82ba0ce7786b03ba2457e033))

## [0.14.2](https://github.com/textfilters/profanity/compare/v0.14.1...v0.14.2) (2026-07-12)


### Bug Fixes

* cover reviewed Russian profanity gaps ([#150](https://github.com/textfilters/profanity/issues/150)) ([94ad4ef](https://github.com/textfilters/profanity/commit/94ad4eff5e866985119d996dc4937bdfaba6ce36))

## [0.14.1](https://github.com/textfilters/profanity/compare/v0.14.0...v0.14.1) (2026-07-01)


### Bug Fixes

* keep Russian root match from absorbing conjunctions ([#146](https://github.com/textfilters/profanity/issues/146)) ([0b67a55](https://github.com/textfilters/profanity/commit/0b67a556961fadd6782a032258378bf25ff6e16c))
* preserve profanity scanner check fast path ([1abf767](https://github.com/textfilters/profanity/commit/1abf767c695775233de6b4cb6fc59e50cabf879a))

## [0.14.0](https://github.com/textfilters/profanity/compare/v0.13.5...v0.14.0) (2026-06-29)


### Features

* add language dictionary conformance validator ([eafef1a](https://github.com/textfilters/profanity/commit/eafef1a67363d28c7e2b42ff5913d208749d626b))
* add language dictionary validator cli ([2c9707b](https://github.com/textfilters/profanity/commit/2c9707b993f61fdffcc07f061fcc0508a7a3ac67))
* add min severity taxonomy filter ([#42](https://github.com/textfilters/profanity/issues/42)) ([e84f526](https://github.com/textfilters/profanity/commit/e84f52612e91ab80f3a2b6712ad3f938adc34afc))
* add reviewed Russian gap coverage ([#85](https://github.com/textfilters/profanity/issues/85)) ([21d5858](https://github.com/textfilters/profanity/commit/21d58588238d4d2e7a45caab3d4a48c5ee1c093a))
* add reviewed Russian huylo coverage ([#87](https://github.com/textfilters/profanity/issues/87)) ([75464f6](https://github.com/textfilters/profanity/commit/75464f60ddae1aeb590b1fc756e35bb6d7cf6992))
* add reviewed Russian sexual vulgarity coverage ([#88](https://github.com/textfilters/profanity/issues/88)) ([547d01a](https://github.com/textfilters/profanity/commit/547d01a92819595fc9742a030805367b99431de1))
* add semantic metadata to Russian dictionary rules ([a93a529](https://github.com/textfilters/profanity/commit/a93a52907eaf3700188817e8e7680ad5dc4c7b3a))
* add taxonomy filtering options ([2e7486c](https://github.com/textfilters/profanity/commit/2e7486ccba96b46560288cdf3a532493be99f56a))
* establish language dictionary authoring platform ([6118e29](https://github.com/textfilters/profanity/commit/6118e299a28eadc3e560e563932aa0ad02176ea0))
* export taxonomy metadata types ([da612be](https://github.com/textfilters/profanity/commit/da612be785f510b679dbe593cc2c081121ac4795))
* expose profanity language dictionary API ([a1f58ed](https://github.com/textfilters/profanity/commit/a1f58ede25d0a0b1a685af6ee6e02c228b46bb39))
* expose taxonomy metadata on matches ([da19dce](https://github.com/textfilters/profanity/commit/da19dce74ec420844067bb49f833a9416dbb0a7e))
* improve aggressive profanity obfuscation coverage ([310402f](https://github.com/textfilters/profanity/commit/310402f42dfae438432b9089a9933c350a1417ea))
* split Russian profanity dictionary files ([e02d70f](https://github.com/textfilters/profanity/commit/e02d70f83d3eefca749d3139f21f14d1d4079981))


### Bug Fixes

* clarify runtime literal semantics ([#117](https://github.com/textfilters/profanity/issues/117)) ([a98743f](https://github.com/textfilters/profanity/commit/a98743f546f2795ca8f9cfa16d943e193242f584))
* harden profanity matching and test layout ([73f8bfb](https://github.com/textfilters/profanity/commit/73f8bfb524af353deb217a7bfb18e1abdadb15af))
* keep reviewed Russian gaps strict-only ([#89](https://github.com/textfilters/profanity/issues/89)) ([9dbd759](https://github.com/textfilters/profanity/commit/9dbd7597505a4f76e25c47d07ca4f34655f3be50))
* load built-in corpus from JSON data files ([e746524](https://github.com/textfilters/profanity/commit/e74652405c41958e64c6c80b05b182bd5abb6419))
* make default filter read-only ([#119](https://github.com/textfilters/profanity/issues/119)) ([6055bb1](https://github.com/textfilters/profanity/commit/6055bb1943b7bbe069d8618e880b1da681ec5ae9))
* use shared public input normalization ([e6c194e](https://github.com/textfilters/profanity/commit/e6c194e67438c8a5455c826af7d86bd69644078d))
* validate language dictionaries before compile ([54d5173](https://github.com/textfilters/profanity/commit/54d5173457d8c55de25b82e4e36007db97095423)), closes [#122](https://github.com/textfilters/profanity/issues/122)

## [0.13.5](https://github.com/textfilters/profanity/compare/v0.13.4...v0.13.5) (2026-06-30)


### Performance Improvements

* add allocation-aware profanity scanner ([c90027d](https://github.com/textfilters/profanity/commit/c90027d6ccf46949709269233af37cb1e42cdb2e))
* add fast profanity check path ([0cec027](https://github.com/textfilters/profanity/commit/0cec02720bdaa17b5deb3f40af3613855365dee4))
* add profanity candidate prefilter ([a306b2d](https://github.com/textfilters/profanity/commit/a306b2d42d9ab3a0c9bc2a0610d4fe5fd0ce4875))
* expose profanity scanner adapter ([79bc093](https://github.com/textfilters/profanity/commit/79bc09368d628978ba970dd668f1d740ecea61d4))

## [0.13.4](https://github.com/textfilters/profanity/compare/v0.13.3...v0.13.4) (2026-06-25)


### Bug Fixes

* use shared public input normalization ([e6c194e](https://github.com/textfilters/profanity/commit/e6c194e67438c8a5455c826af7d86bd69644078d))
* validate language dictionaries before compile ([54d5173](https://github.com/textfilters/profanity/commit/54d5173457d8c55de25b82e4e36007db97095423)), closes [#122](https://github.com/textfilters/profanity/issues/122)

## [0.13.3](https://github.com/textfilters/profanity/compare/v0.13.2...v0.13.3) (2026-06-22)


### Bug Fixes

* make default filter read-only ([#119](https://github.com/textfilters/profanity/issues/119)) ([6055bb1](https://github.com/textfilters/profanity/commit/6055bb1943b7bbe069d8618e880b1da681ec5ae9))

## [0.13.2](https://github.com/textfilters/profanity/compare/v0.13.1...v0.13.2) (2026-06-22)


### Bug Fixes

* clarify runtime literal semantics ([#117](https://github.com/textfilters/profanity/issues/117)) ([a98743f](https://github.com/textfilters/profanity/commit/a98743f546f2795ca8f9cfa16d943e193242f584))

## [0.13.1](https://github.com/textfilters/profanity/compare/v0.13.0...v0.13.1) (2026-06-20)


### Bug Fixes

* keep reviewed Russian gaps strict-only ([#89](https://github.com/textfilters/profanity/issues/89)) ([9dbd759](https://github.com/textfilters/profanity/commit/9dbd7597505a4f76e25c47d07ca4f34655f3be50))

## [0.13.0](https://github.com/textfilters/profanity/compare/v0.12.0...v0.13.0) (2026-06-20)


### Features

* add reviewed Russian gap coverage ([#85](https://github.com/textfilters/profanity/issues/85)) ([21d5858](https://github.com/textfilters/profanity/commit/21d58588238d4d2e7a45caab3d4a48c5ee1c093a))
* add reviewed Russian huylo coverage ([#87](https://github.com/textfilters/profanity/issues/87)) ([75464f6](https://github.com/textfilters/profanity/commit/75464f60ddae1aeb590b1fc756e35bb6d7cf6992))
* add reviewed Russian sexual vulgarity coverage ([#88](https://github.com/textfilters/profanity/issues/88)) ([547d01a](https://github.com/textfilters/profanity/commit/547d01a92819595fc9742a030805367b99431de1))

## [0.12.0](https://github.com/textfilters/profanity/compare/v0.11.0...v0.12.0) (2026-06-17)


### Features

* harden Russian default profanity coverage ([fbbb3dd](https://github.com/textfilters/profanity/commit/fbbb3ddf098803d7d7cb43d69f52095f25736938))
* split Russian profanity dictionary files ([e02d70f](https://github.com/textfilters/profanity/commit/e02d70f83d3eefca749d3139f21f14d1d4079981))

## [0.11.0](https://github.com/textfilters/profanity/compare/v0.10.0...v0.11.0) (2026-06-14)


### Features

* establish language dictionary authoring platform ([6118e29](https://github.com/textfilters/profanity/commit/6118e299a28eadc3e560e563932aa0ad02176ea0))

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
