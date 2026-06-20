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
| `@textfilters/core` | Shared contracts, normalization helpers, range masking, and pipelines. | Stateless helpers plus factory-created pipelines with mutable registration order. | Censored text, guard decisions, pipeline process results, and range helpers. | Exposes UTF-16 and code point range types plus merge/mask helpers. | Pipeline and guard contracts; no package-specific detection metadata. | None. | `check` runs lint, tests, build, and dry-run pack; no separate dist smoke script. | [`textfilters/core`](../core) |
| `@textfilters/url` | Direct, obfuscated, defanged, and hxxp URL detection. | Shared default `filter`; `createUrlFilter` / `urlFilter` create isolated stateless censors. | Censored text through the `TextCensor` interface. | Uses code point ranges internally; ranges are not public API output. | `tlds` and `maskChar` options. | `@textfilters/core`. | `check` runs lint, tests, build, and dry-run pack; no separate dist smoke script. | [`textfilters/url`](../url) |
| `@textfilters/email` | Direct and obfuscated email detection with contact redaction guards. | Shared default `filter`; `createEmailFilter` / `emailFilter` create isolated stateless censors. | Censored text through the `TextCensor` interface. | Uses code point ranges internally; ranges are not public API output. | Masking, obfuscation, localhost, single-label domain, and exclusion options. | `@textfilters/core`. | `check` runs lint, tests, build, and dry-run pack; no separate dist smoke script. | [`textfilters/email`](../email) |
| `@textfilters/phone` | Phone number and phone-like sequence detection. | Shared default `filter`; `createPhoneFilter` / `phoneFilter` create isolated stateless censors. | Censored text through the `TextCensor` interface. | Uses code point ranges internally; ranges are not public API output. | `maskChar` option. | `@textfilters/core`. | `check` runs lint, tests, build, and dry-run pack; no separate dist smoke script. | [`textfilters/phone`](../phone) |
| `@textfilters/profanity` | Russian profanity filtering, dictionary validation, obfuscation handling, and taxonomy-aware matching. | Shared mutable `filter`; `createProfanityFilter` and dictionary factories create isolated mutable filters. | `censor()` text, `check()` boolean, and `analyze()` match ranges. | Public `analyze()` ranges include source offsets and match mode. | Category, severity, rule id, match-mode metadata, filter options, and mutable strict/loose term APIs. | `@textfilters/core`. | `check` includes lint, tests, dist smoke, and dry-run pack. | [`textfilters/profanity`](../profanity) |
| `@textfilters/spam` | Interval, duplicate, burst, and actor-based anti-spam decisions. | Factory-created stateful guards; `reset()` clears actor state. | Guard decision objects: `{ allowed: true }` or `{ allowed: false, reason }`. | Not range-based. | Timing/window/max-actor config plus typed block reasons. | `@textfilters/core`. | `check` includes lint, tests, build, dist smoke, and dry-run pack. | [`textfilters/spam`](../spam) |

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

## Support

Open package-specific bugs in the relevant package repository. Open ecosystem documentation issues in this repository. For security reports, see the organization security policy in `textfilters/.github`.

## Roadmap

Future package additions are tracked as they become ready for release.

## License

MIT
