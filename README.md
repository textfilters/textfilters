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

const result = content.process("Contact user@example.com");
```

Every child receives the same original text. Matches remain source-based and
ordered, while overlapping ranges are merged for one masking pass.

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
});
```

`TextGuard` may block the whole message and can use actor and time context.
Spam is a guard. `TextFilter` finds source text ranges and masks them without
actor state. URL, email, phone, and profanity are filters.

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

`npm run check` validates all workspaces, built public surfaces, dry packs, and
a clean consumer installation of all package tarballs.
