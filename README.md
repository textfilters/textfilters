# Textfilters

Textfilters is a TypeScript monorepo for composable text filters and actor-aware
message moderation. Packages are ESM-only, use UTF-16 source offsets, and can be
installed independently.

## Text Filtering

Use `combineFilters()` when only source text needs to be inspected and masked.

```ts
import { combineFilters } from "@textfilters/core";
import { filter as email } from "@textfilters/email";
import { filter as phone } from "@textfilters/phone";
import { createProfanityFilter } from "@textfilters/profanity";
import english from "@textfilters/profanity-en";
import russian from "@textfilters/profanity-ru";
import { filter as url } from "@textfilters/url";

const content = combineFilters(
  url,
  email,
  phone,
  createProfanityFilter(russian, english),
);

email.find("😀 user@example.com");
// [{ start: 3, end: 19, value: "user@example.com", filter: "email" }]

const result = content.process("Contact user@example.com");
// {
//   censored: "Contact ****************",
//   matches: [
//     { start: 8, end: 24, value: "user@example.com", filter: "email" },
//     { start: 13, end: 24, value: "example.com", filter: "url" },
//   ],
// }
```

Every child receives the same original text. Matches remain source-based and
ordered, while overlapping ranges are merged for one masking pass. Offsets are
UTF-16 `[start, end)` positions in the original string, so the emoji above takes
two code units. The email and nested URL matches remain separate in the result;
masking preserves the original string length.

## Full Moderation

Use `createModerationPipeline()` for messages with actor and time context.

```ts
import { createModerationPipeline } from "@textfilters/core";
import { filter as email } from "@textfilters/email";
import { filter as phone } from "@textfilters/phone";
import { createProfanityFilter } from "@textfilters/profanity";
import russian from "@textfilters/profanity-ru";
import { createSpamGuard } from "@textfilters/spam";
import { filter as url } from "@textfilters/url";

const moderation = createModerationPipeline({
  guards: [
    createSpamGuard({
      minIntervalMs: 700,
      duplicateWindowMs: 12_000,
      burstWindowMs: 10_000,
      burstMaxMessages: 6,
    }),
  ],
  filters: [url, email, phone, createProfanityFilter(russian)],
});

const result = moderation.process({
  actorKey: "user:123",
  text: "Contact user@example.com",
  nowMs: 1_000,
});
// {
//   allowed: true,
//   text: "Contact ****************",
//   matches: [
//     { start: 8, end: 24, value: "user@example.com", filter: "email" },
//     { start: 13, end: 24, value: "example.com", filter: "url" },
//   ],
// }

moderation.process({
  actorKey: "user:123",
  text: "A different message",
  nowMs: 1_001,
});
// { allowed: false, guard: "spam", reason: "too_fast" }
```

`TextGuard` may block the whole message and can use actor and time context.
Spam is a guard. `TextFilter` finds source text ranges and masks them without
actor state. URL, email, phone, and profanity are filters.

## Lifetime and Policy

Reuse immutable filters so options and dictionary indexes are prepared once.
Reuse each spam guard within its intended moderation scope so it remembers
accepted messages; create separate guards for independent scopes and use
`reset()` when that history should be cleared. Rejected messages do not extend
windows or consume accepted-message quota.

Allowlists are local to a filter. Allowing `user@example.com` in email does not
allow `example.com` in URL; combined masking may still redact the domain. Specify
each exception in the detector that owns it. Profanity exact allows remain
local to their dictionary and covered source range.

Detectors recognize supported text forms, not every possible obfuscation. URL
and email do not verify reachable hosts or mailboxes; phone does not verify
assigned numbers. Parse structured payloads first and filter only the relevant
user text. Package READMEs document detector-specific options and limitations.

## Packages

| Package                     | Purpose                                     |
| --------------------------- | ------------------------------------------- |
| `@textfilters/core`         | Filter contracts, composition, and pipeline |
| `@textfilters/url`          | URL and obfuscated-domain filtering         |
| `@textfilters/email`        | Direct and obfuscated email filtering       |
| `@textfilters/phone`        | Phone-like sequence filtering               |
| `@textfilters/profanity`    | Dictionary-independent profanity runtime    |
| `@textfilters/profanity-ru` | Maintained Russian dictionary               |
| `@textfilters/profanity-en` | Maintained English dictionary               |
| `@textfilters/spam`         | Bounded stateful spam guard                 |

See [package layout](docs/package-layout.md), [ecosystem policy](docs/ecosystem-policy.md),
and [release process](docs/release-process.md) for repository-level details.

## Development

```sh
npm ci
npm run check
npm run benchmark
```

`npm run check` validates root formatting, all workspaces, built public surfaces,
and a clean consumer installation of all package tarballs. It builds and packs
each workspace once; see the [validation flow](docs/package-layout.md#workspace-tooling).
