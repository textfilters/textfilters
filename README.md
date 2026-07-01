# Textfilters

Composable TypeScript text filtering and content moderation packages for URLs,
email addresses, phone numbers, profanity, spam, and custom moderation
pipelines.

Textfilters is an ecosystem of small MIT-licensed packages for building a
TypeScript text filtering library around chat moderation, UGC moderation,
censoring, redaction, URL detection, email detection, phone number detection,
Russian profanity filtering, anti-spam checks, and custom pipelines. This
repository is documentation-only and provides the ecosystem overview for the
current package set.

## Packages

| Package | Repository | Status | Purpose |
| --- | --- | --- | --- |
| `@textfilters/core` | `textfilters/core` | Published on GitHub Packages | Shared contracts, normalization, range masking, and pipeline utilities. |
| `@textfilters/url` | `textfilters/url` | Published on GitHub Packages | URL detection, obfuscated links, defanged domains, hxxp links, and safe link censoring. |
| `@textfilters/email` | `textfilters/email` | Published on GitHub Packages | Email detection, obfuscated email forms, contact redaction, and false-positive guards. |
| `@textfilters/phone` | `textfilters/phone` | Published on GitHub Packages | Phone number detection, phone-like sequence filtering, contact redaction, and numeric false-positive guards. |
| `@textfilters/profanity` | `textfilters/profanity` | Published on GitHub Packages | Russian profanity filter primitives with dictionary support, obfuscation handling, taxonomy metadata, and validation. |
| `@textfilters/spam` | `textfilters/spam` | Published on GitHub Packages | Lightweight anti-spam guard for interval, duplicate, burst, and actor-based message checks. |

Packages are released independently, so versions are not kept in lockstep across the ecosystem. Use the relevant package repository, GitHub Release, or package metadata as the source of truth for the current release.

## Ecosystem Compatibility Matrix

| Package | Purpose | Shared mutable instance or stateless API | Output shape | Range support | Metadata/options support | Runtime dependencies inside the ecosystem | Dist smoke/check status | Repository |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@textfilters/core` | Shared contracts, normalization helpers, range masking, and pipelines. | Stateless helpers plus factory-created pipelines with mutable registration order. | Censored text, guard decisions, pipeline process results, and range helpers. | Exposes UTF-16 and code point range types plus shared scanner contracts, merge helpers, and mask helpers. | Pipeline, guard, scanner, range, and hint contracts; no package-specific detection metadata. | None. | `0.3.2`; Node `>=24`; npm `11.16.0`; check and release workflows present. | [`textfilters/core`](../core) |
| `@textfilters/url` | Direct, obfuscated, defanged, and hxxp URL detection. | Shared default `filter`; `createUrlFilter` / `urlFilter` create isolated stateless censors; `createUrlScanner()` creates a range scanner. | Censored text through the `TextCensor` interface plus scanner range outputs. | Exposes URL scan input, scan result, range match, and sink contract names aligned with shared scanner shapes. | `tlds` and `maskChar` options. | `@textfilters/core@^0.3.1`. | `0.1.6`; Node `>=24`; npm `11.16.0`; check and release workflows present. | [`textfilters/url`](../url) |
| `@textfilters/email` | Direct and obfuscated email detection with contact redaction guards. | Shared default `filter`; `createEmailFilter` / `emailFilter` create isolated stateless censors; `createEmailScanner()` creates a range scanner. | Censored text through the `TextCensor` interface plus scanner range outputs. | Exposes email scan input, scan result, range match, and sink contract names aligned with shared scanner shapes. | Masking, obfuscation, localhost, single-label domain, and exclusion options. | `@textfilters/core@^0.3.1`. | `0.2.7`; Node `>=24`; npm `11.16.0`; check and release workflows present. | [`textfilters/email`](../email) |
| `@textfilters/phone` | Phone number and phone-like sequence detection. | Shared default `filter`; `createPhoneFilter` / `phoneFilter` create isolated stateless censors; `createPhoneScanner()` creates a range scanner. | Censored text through the `TextCensor` interface plus scanner range outputs. | Exposes phone scan input, scan result, range match, and sink contract names aligned with shared scanner shapes. | `maskChar` option. | `@textfilters/core@^0.3.1`. | `0.1.5`; Node `>=24`; npm `11.16.0`; check and release workflows present. | [`textfilters/phone`](../phone) |
| `@textfilters/profanity` | Russian profanity filtering, dictionary validation, obfuscation handling, and taxonomy-aware matching. | Shared mutable `filter`; `createProfanityFilter` and dictionary factories create isolated mutable filters for runtime dictionary changes; `createProfanityScanner()` creates a range scanner. | `censor()` text, `check()` boolean, `analyze()` match ranges, and scanner range outputs. | Public `analyze()` ranges include source offsets and match mode; scanner output maps matches to code point ranges. | Category, severity, rule id, match-mode metadata, filter options, dictionary validation, compiled dictionary reuse, and mutable strict/loose term APIs. | `@textfilters/core@^0.3.1`. | `0.14.0`; Node `>=24`; npm `11.16.0`; check and release workflows present. | [`textfilters/profanity`](../profanity) |
| `@textfilters/spam` | Interval, duplicate, burst, and actor-based anti-spam decisions. | Factory-created stateful guards; `reset()` clears actor state for the guard instance. | Guard decision objects: `{ allowed: true }` or `{ allowed: false, reason }`. | Not range-based. | Timing/window/max-actor config plus typed block reasons. | `@textfilters/core@^0.3.0`. | `0.3.0`; Node `>=24`; npm `11.16.0`; check and release workflows present. | [`textfilters/spam`](../spam) |

Package repositories share the same script contract: `lint`, `test`, `build`,
`smoke:dist`, `pack:dry-run`, and `check`. `npm run check` runs formatting
checks, tests, a TypeScript build, a package-specific dist smoke command, and
`npm pack --dry-run`. Every package also keeps `prepack: npm run build`, so
direct package packing remains build-backed outside `check`.

This repository's root `npm run check` runs the ecosystem drift guard. The guard
checks package metadata and required workflow presence from sibling repository
checkouts when they are available, or from pinned package repository refs
otherwise.
It validates Node and npm baselines, package exports, package files,
`sideEffects`, `prepack`, `check`, `publishConfig`, compatible
`@textfilters/core` dependency ranges, and required check/release workflows.
The root integration install also keeps published packages on a single
`@textfilters/core` line with npm overrides until every published package
dependency range has caught up.

Package source layout is intentionally similar across repositories where that
does not force behavior changes. New package work should keep `src/index.ts` as
the root public export, expose documented scanner factories only when range
pipeline integration is part of the public API, keep parsers and low-level range
collectors internal, expose isolated factories and stable public types from the
root, and use package-specific modules for config, normalization, matching,
range collection, dictionaries, or actor state as needed. See
[ecosystem policy](docs/ecosystem-policy.md) for repository responsibilities,
compatibility, performance, and release boundaries, and
[package layout](docs/package-layout.md) for the preferred layout and alignment
rules.

For ecosystem compatibility checks, authenticate npm for GitHub Packages, then
install the current published package set together with its compatible core line
in a clean temporary project and run a basic pipeline smoke:

```sh
npm init -y
npm config set @textfilters:registry https://npm.pkg.github.com --location=project
npm pkg set "overrides.@textfilters/spam.@textfilters/core=^0.3.1"
npm install @textfilters/core@^0.3.2 @textfilters/url @textfilters/email @textfilters/phone @textfilters/profanity @textfilters/spam
node --input-type=module --eval "import { readFileSync } from 'node:fs'; const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')); const versions = new Set(Object.entries(lock.packages).filter(([path, pkg]) => path.endsWith('node_modules/@textfilters/core') && pkg.version).map(([, pkg]) => pkg.version)); if (versions.size !== 1) throw new Error('Expected exactly one @textfilters/core version, got ' + ([...versions].join(', ') || 'none'));"
node --input-type=module --eval "import { createTextPipeline } from '@textfilters/core'; import { filter as urlFilter } from '@textfilters/url'; import { filter as emailFilter } from '@textfilters/email'; import { filter as phoneFilter } from '@textfilters/phone'; import { filter as profanityFilter } from '@textfilters/profanity'; import { createSpamFilter } from '@textfilters/spam'; const pipeline = createTextPipeline().use(urlFilter).use(emailFilter).use(phoneFilter).use(profanityFilter); pipeline.censor('Contact user@example.com, https://example.com, or +1 555 123 4567'); createSpamFilter().check({ actorKey: 'smoke', text: 'hello' });"
```

## Package Behavior Model

The published URL, email, and phone packages are text censors with shared range
scanner adapters. Their exported `filter` instances are convenient shared
defaults, while `createUrlFilter`, `createEmailFilter`, and `createPhoneFilter`
create isolated censors with their own options. Use `createUrlScanner()`,
`createEmailScanner()`, and `createPhoneScanner()` when a core range pipeline
needs scanner-compatible ranges instead of direct censored text.

The spam package is intentionally stateful. `createSpamFilter(config?)` returns
an in-memory guard that tracks actor message timing, duplicate content, and
burst windows until `reset()` is called, stale actor state is pruned, or
`maxActors` eviction removes the least-recent actor state. Create separate guard
instances for separate moderation scopes.

The profanity package is dictionary-backed and mutable. Its shared `filter` is
the built-in Russian default for common read-only `check`, `censor`, and
`analyze` calls. Use the package's factory-created filters when application,
tenant, request, or test-specific runtime terms must be isolated. Profanity
`analyze()` output can include match mode, rule ids, categories, and severities
from the maintained dictionary.

`@textfilters/core` owns the shared contracts used across the ecosystem:
normalization helpers, `TextCensor`, pipeline composition, guard decision types,
scanner inputs, scanner hints, scanner results, range merging, and UTF-16 and
code point masking helpers. URL, email, phone, and profanity expose scanner
factories that can participate in the core range pipeline while preserving their
existing direct `check()` and `censor()` wrappers.

## Which Package Should I Use?

| Need | Start with |
| --- | --- |
| Compose multiple filters into one ordered pipeline | `@textfilters/core` |
| Detect direct URLs, obfuscated links, defanged domains, or hxxp links | `@textfilters/url` |
| Detect direct or obfuscated email addresses | `@textfilters/email` |
| Detect phone numbers and phone-like contact sequences | `@textfilters/phone` |
| Censor Russian profanity or inspect taxonomy metadata | `@textfilters/profanity` |
| Block repeated, too-fast, bursty, or actor-based spam messages | `@textfilters/spam` |

Install only the packages needed for your moderation surface. Add
`@textfilters/core` when you want a shared pipeline or when a package lists it
as a dependency in the install command.

## Use Cases

- Chat moderation for links, contact details, profanity, and spam behavior.
- UGC moderation for posts, profiles, comments, listings, and marketplace
  messages.
- Censoring and redaction before display, indexing, search, or audit storage.
- Composable moderation pipelines where URL, email, phone, profanity, and spam
  checks remain independently testable.

## Installation

Packages are published to GitHub Packages, not the public npm registry.

```ini
@textfilters:registry=https://npm.pkg.github.com
```

GitHub Packages requires npm authentication for installs, including public packages.

```sh
npm install @textfilters/core @textfilters/url @textfilters/phone @textfilters/profanity @textfilters/spam @textfilters/email
```

Install individual packages for narrower use cases:

```sh
npm install @textfilters/core @textfilters/url
npm install @textfilters/core @textfilters/email
npm install @textfilters/core @textfilters/phone
npm install @textfilters/core @textfilters/profanity
npm install @textfilters/core @textfilters/spam
```

## Usage

```ts
import { createTextPipeline } from "@textfilters/core";
import { filter as urlFilter } from "@textfilters/url";
import { filter as phoneFilter } from "@textfilters/phone";
import { filter as profanityFilter } from "@textfilters/profanity";
import { filter as emailFilter } from "@textfilters/email";

const pipeline = createTextPipeline()
  .use(urlFilter)
  .use(phoneFilter)
  .use(profanityFilter)
  .use(emailFilter);

const safeText = pipeline.censor(
  "message with https://example.com, +7 999 123-45-67, and user@example.com",
);
```

```ts
import { createSpamFilter } from "@textfilters/spam";

const spam = createSpamFilter({
  minIntervalMs: 700,
  duplicateWindowMs: 12_000,
  burstWindowMs: 10_000,
  burstMaxMessages: 6,
});

const decision = spam.check({
  actorKey: "user:123",
  text: "hello",
});
```

## Release Model

Packages use semantic versioning and Release Please from Conventional Commit history on `main`. Each package has its own release cadence and version line. During `0.x`, minor releases may include API changes, so consumers should review the affected package release notes before upgrading.

Packages are published to GitHub Packages first, with GitHub Releases and immutable release tags using `vX.Y.Z`. npmjs.org publication may be added later.

See [npmjs.com publication plan](docs/npmjs-publication.md) for the planned
`1.0.0+` public npm publishing policy, required secrets, workflow gates, and
first-publish checklist.

## Support

Open package-specific bugs in the relevant package repository. Open ecosystem documentation issues in this repository. For security reports, see the organization security policy in `textfilters/.github`.

## Roadmap

Future package additions are tracked as they become ready for release.

## License

MIT
