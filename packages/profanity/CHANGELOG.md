# Changelog

## 0.16.2 (2026-07-23)


### Performance Improvements

* cached repeated strict token lookups per input (b67b031), closes #172
* eliminated strict lookup allocations and sorting (8e61e12), closes #171
* fused normalization and input fact collection (4b25b29), closes #170
* indexed loose candidates before full pattern scans (735614f), closes #168
* indexed loose rules by mandatory signatures (8c4ecbd)
* reused prepared input across scanners and profiles (ff288c2), closes #173

## 0.16.1 (2026-07-22)


### Bug Fixes

* close reviewed profanity coverage and boundary gaps (7f451ff)

## 0.16.0 (2026-07-16)


### Features

* add composable profanity language profiles (#163) (1896a00)

## 0.15.3 (2026-07-16)


### Bug Fixes

* expanded reviewed English profanity coverage (bc56918)

## 0.15.2 (2026-07-14)


### Bug Fixes

* updated core dependency to 0.4.0 (8a839d3)

## 0.15.1 (2026-07-13)


### Bug Fixes

* expose English language pack (455ce27)

## 0.15.0 (2026-07-13)


### Features

* add reviewed English profanity pack (1361734)

## 0.14.2 (2026-07-12)


### Bug Fixes

* cover reviewed Russian profanity gaps (#150) (94ad4ef)

## 0.14.1 (2026-07-01)


### Bug Fixes

* keep Russian root match from absorbing conjunctions (#146) (0b67a55)
* preserve profanity scanner check fast path (1abf767)

## 0.14.0 (2026-06-29)


### Features

* add language dictionary conformance validator (eafef1a)
* add language dictionary validator cli (2c9707b)
* add min severity taxonomy filter (#42) (e84f526)
* add reviewed Russian gap coverage (#85) (21d5858)
* add reviewed Russian huylo coverage (#87) (75464f6)
* add reviewed Russian sexual vulgarity coverage (#88) (547d01a)
* add semantic metadata to Russian dictionary rules (a93a529)
* add taxonomy filtering options (2e7486c)
* establish language dictionary authoring platform (6118e29)
* export taxonomy metadata types (da612be)
* expose profanity language dictionary API (a1f58ed)
* expose taxonomy metadata on matches (da19dce)
* improve aggressive profanity obfuscation coverage (310402f)
* split Russian profanity dictionary files (e02d70f)


### Bug Fixes

* clarify runtime literal semantics (#117) (a98743f)
* harden profanity matching and test layout (73f8bfb)
* keep reviewed Russian gaps strict-only (#89) (9dbd759)
* load built-in corpus from JSON data files (e746524)
* make default filter read-only (#119) (6055bb1)
* use shared public input normalization (e6c194e)
* validate language dictionaries before compile (54d5173), closes #122

## 0.13.5 (2026-06-30)


### Performance Improvements

* add allocation-aware profanity scanner (c90027d)
* add fast profanity check path (0cec027)
* add profanity candidate prefilter (a306b2d)
* expose profanity scanner adapter (79bc093)

## 0.13.4 (2026-06-25)


### Bug Fixes

* use shared public input normalization (e6c194e)
* validate language dictionaries before compile (54d5173), closes #122

## 0.13.3 (2026-06-22)


### Bug Fixes

* make default filter read-only (#119) (6055bb1)

## 0.13.2 (2026-06-22)


### Bug Fixes

* clarify runtime literal semantics (#117) (a98743f)

## 0.13.1 (2026-06-20)


### Bug Fixes

* keep reviewed Russian gaps strict-only (#89) (9dbd759)

## 0.13.0 (2026-06-20)


### Features

* add reviewed Russian gap coverage (#85) (21d5858)
* add reviewed Russian huylo coverage (#87) (75464f6)
* add reviewed Russian sexual vulgarity coverage (#88) (547d01a)

## 0.12.0 (2026-06-17)


### Features

* harden Russian default profanity coverage (fbbb3dd)
* split Russian profanity dictionary files (e02d70f)

## 0.11.0 (2026-06-14)


### Features

* establish language dictionary authoring platform (6118e29)

## 0.10.0 (2026-06-14)


### Features

* add language dictionary validator cli (2c9707b)

## 0.9.0 (2026-06-12)


### Features

* add language dictionary conformance validator (eafef1a)

## 0.8.0 (2026-06-11)


### Features

* expose profanity language dictionary API (a1f58ed)

## 0.7.0 (2026-06-11)


### Features

* add semantic metadata to Russian dictionary rules (a93a529)

## 0.6.0 (2026-06-11)


### Features

* improve aggressive profanity obfuscation coverage (310402f)

## 0.5.0 (2026-06-11)


### Features

* add min severity taxonomy filter (#42) (e84f526)

## 0.4.0 (2026-06-11)


### Features

* add taxonomy filtering options (2e7486c)

## 0.3.0 (2026-06-10)


### Features

* expose taxonomy metadata on matches (da19dce)

## 0.2.0 (2026-06-10)


### Features

* export taxonomy metadata types (da612be)

## 0.1.2 (2026-06-09)


### Bug Fixes

* load built-in corpus from JSON data files (e746524)

## 0.1.1 (2026-06-09)


### Bug Fixes

* harden profanity matching and test layout (73f8bfb)

## 0.1.0 (2026-06-04)

Initial release of `@textfilters/profanity`.

- Profanity censor and boolean check package with a small `filter` export and configurable `createProfanityFilter(...)` factory.
- Built-in strict and loose dictionaries.
- Runtime dictionary terms treated as normalized literals, not regular expressions.
- Internal package-owned rule compiler for the bundled corpus.
- Length-preserving masking for JavaScript strings.
- Architecture documentation and GitHub Packages release flow.
