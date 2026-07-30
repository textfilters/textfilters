# Ecosystem Policy

This monorepo is the single source repository for Textfilters runtime packages,
shared governance, compatibility expectations, benchmark guidance, and release
automation.

## Workspace Responsibilities

| Workspace | Owns | Does not own |
| --- | --- | --- |
| [`packages/core`](../packages/core) | Shared contracts, normalization helpers, guard result shapes, pipeline primitives, range merging, and masking helpers. | URL, email, phone, profanity, or spam detection logic. |
| [`packages/url`](../packages/url) | Stateless URL scanners, censor factories, URL options, and public wrappers. | Application routing or network validation. |
| [`packages/email`](../packages/email) | Stateless email scanners, censor factories, email options, and public wrappers. | Mailbox validation or delivery checks. |
| [`packages/phone`](../packages/phone) | Stateless phone scanners, censor factories, phone options, and public wrappers. | Telephony validation or carrier lookups. |
| [`packages/profanity`](../packages/profanity) | Dictionary compilation, language data, taxonomy metadata, scanners, analyzers, and censor factories. | URL, email, phone, spam, or application policy decisions. |
| [`packages/spam`](../packages/spam) | Spam guard logic, block reasons, configuration, and in-memory actor state. | Databases, queues, cache services, HTTP clients, or application storage adapters. |
| [Repository root](..) | Workspaces, lockfile, shared CI, release manifest, governance, integration checks, and ecosystem documentation. | Application infrastructure or package-specific runtime behavior. |

Package workspaces own their README, public examples, tests, architecture
documentation, metadata, and package-specific exceptions.

## Package Boundaries

`@textfilters/core` stays limited to shared contracts and primitives.
Package-specific detection rules belong in the runtime workspace that uses
them.

`@textfilters/url`, `@textfilters/email`, and `@textfilters/phone` are
stateless scanner-and-censor packages. They expose thin censor factories,
documented scanner factories for range pipeline integration, and stable public
option types while keeping parsers and low-level range collection internal.

`@textfilters/profanity` owns dictionary validation and compilation, maintained
language data, taxonomy, scanner and analyzer output, censoring, and fast
boolean checks.

`@textfilters/spam` is stateful. It owns guard decisions and actor state
abstractions but does not depend on an application database, cache, queue, web
framework, or deployment platform.

## Compatibility Policy

Packages release independently and do not use lockstep versioning. Public
package names and TypeScript APIs remain package-owned contracts.

All non-core workspaces use a compatible `@textfilters/core` range. The
Release Please `node-workspace` plugin updates local dependency ranges and
patch-bumps dependents when a released core version requires it.

The root `npm run check` command is the local compatibility gate. It runs the
release path allowlist self-test and every package's lint, test, build, dist
smoke, and dry-pack checks in workspace order.

Before publication, pack results must be compared with the previous release.
Only intended metadata, documentation, version, and dependency-range changes
are acceptable unless a package change explicitly modifies runtime output.

After publication, a clean integration project must install all six packages
and resolve exactly one compatible `@textfilters/core` version.

## Performance Policy

Performance-sensitive changes must be measured before and after on the same
machine, Node.js version, package versions, and command shape. Benchmark results
are comparisons, not portable absolute claims.

Relevant changes include matching, scanning, range collection, masking,
dictionary compilation, and actor-state hot paths. Documentation, metadata, and
workflow-only changes do not require package microbenchmarks when runtime code
and packaged runtime output are unchanged.

## Release Policy

Release Please uses one root manifest for six independently versioned
components. Releasable Conventional Commits accumulate in one aggregated
release pull request.

Ordinary merges to `main` never publish packages. Publishing begins only when
the aggregated release pull request is explicitly merged. Release tags include
the package component, for example `core-v0.4.1` and `spam-v0.3.3`.

The publish job validates Release Please paths against a fixed allowlist and
publishes only selected workspaces in dependency order, beginning with core.
Published tags and package versions are immutable.

See [the release process](release-process.md) for operational details.
