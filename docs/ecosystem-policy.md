# Ecosystem Policy

This repository is the control plane for Textfilters ecosystem documentation,
compatibility expectations, benchmark guidance, and release boundaries. Runtime
package implementation stays in the package repositories.

## Repository Responsibilities

| Repository | Owns | Does not own |
| --- | --- | --- |
| `textfilters/textfilters` | Ecosystem overview, compatibility matrix, drift guard, benchmark guidance, package boundary policy, and release policy references. | Runtime package source, package-specific CI implementation, application infrastructure, or publishing execution. |
| `textfilters/core` | Shared contracts, normalization helpers, guard result shapes, pipeline primitives, range merging, and masking helpers. | URL, email, phone, profanity, or spam detection logic. |
| `textfilters/url` | Stateless URL scanners, URL censor factories, URL options, and thin public wrappers. | Shared contracts beyond core usage, application routing, or network validation. |
| `textfilters/email` | Stateless email scanners, email censor factories, email options, and thin public wrappers. | Shared contracts beyond core usage, mailbox validation, or delivery checks. |
| `textfilters/phone` | Stateless phone scanners, phone censor factories, phone options, and thin public wrappers. | Shared contracts beyond core usage, telephony validation, or carrier lookups. |
| `textfilters/profanity` | Dictionary compilation, Russian dictionary data, taxonomy metadata, scanners, analyzers, censor factories, and fast profanity checks. | URL/email/phone scanning, spam state, or application policy decisions. |
| `textfilters/spam` | Spam guard logic, block reasons, guard configuration, in-memory actor state, and pluggable actor state store abstractions. | Databases, queues, cache services, HTTP clients, or application-specific storage adapters. |
| `textfilters/.github` | Organization-wide GitHub metadata, shared policy documents, and reusable repository governance. | Package runtime behavior or package release decisions. |

Package repositories own their package README, API examples, tests, release
automation, and package-specific exceptions. This repository may describe the
expected shape of those items, but it should not move package implementation or
application infrastructure into the control plane.

## Package Boundaries

`@textfilters/core` should stay limited to shared contracts and primitives. It
may expose common range, masking, normalization, pipeline, and guard result
helpers, but package-specific detection rules belong in the runtime package that
uses them.

`@textfilters/url`, `@textfilters/email`, and `@textfilters/phone` are
stateless scanner-and-censor packages. They should expose thin root censor
factories, documented scanner factories for range pipeline integration, and
stable public option types while keeping parsers and low-level range collection
internals package-private.

`@textfilters/profanity` owns the larger dictionary-backed surface: dictionary
validation and compilation, maintained Russian dictionary data, taxonomy,
scanner/analyzer output, censoring, and fast boolean checks.

`@textfilters/spam` is the stateful package. It owns guard decisions and actor
state abstractions, but package code should not depend on a concrete application
database, cache, queue, web framework, or deployment platform.

## Compatibility Policy

Packages release independently and do not use lockstep versioning. The
compatibility matrix in the root README records the currently expected published
package set, public behavior shape, ecosystem dependency ranges, and dist check
status.

The root `npm run check` command is the local compatibility gate for this
control-plane repository. It validates package metadata, required workflows,
Node and npm baselines, package files, export shape, `sideEffects`, `prepack`,
`check`, `publishConfig`, and compatible `@textfilters/core` ranges from sibling
repository checkouts or pinned package repository refs.

Compatibility validation should confirm that the published package set can be
installed together on a single compatible `@textfilters/core` line. Temporary
npm overrides are acceptable in this repository when a published package range
has not yet caught up, but the override must be visible in the README smoke
steps and in the root installation state.

Any package change that alters public exports, package metadata, supported
runtime baselines, release workflow names, or `@textfilters/core` dependency
ranges should update the compatibility matrix or create a follow-up ecosystem
issue before the package change is considered complete.

## Performance Policy

Benchmark changes should be measured with before/after runs on the same
machine, same Node.js version, same package versions, and same command shape.
The benchmark suite is intended for comparisons, not for cross-machine absolute
performance claims.

Benchmark coverage should include:

- clean short and long inputs for baseline overhead
- positive matches for each scanner package
- long inputs with matches near the end
- custom option cases where options affect hot-path behavior
- dictionary compilation and compiled dictionary reuse for profanity
- allowed, blocked, repeated, and pruning scenarios for spam state
- combined pipeline cases with URL, email, phone, and profanity filters

PRs that intentionally affect performance-sensitive code should include the
benchmark command, relevant package versions, before/after results or a short
summary, and any known noise caveat. Documentation-only policy changes do not
need benchmark runs unless they change benchmark guidance.

## Release Policy

Each package repository owns its release automation and version line. Packages
use semantic versioning and Release Please from their own default branch, with
GitHub Packages as the current package registry.

Shared-contract changes should release from `@textfilters/core` first. Runtime
packages should then adopt the new core range in package-specific PRs, and this
repository should update the compatibility matrix and drift guard expectations
after the compatible package set is available.

npmjs.com publication is a future `1.0.0+` policy path and must remain explicit
per package. The control-plane repository may document the policy, but package
repositories must own the trusted publish workflow and release gates.
