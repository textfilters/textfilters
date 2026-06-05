# Textfilters

Composable TypeScript text filtering primitives for moderation pipelines.

Textfilters is a small set of composable TypeScript text filtering primitives for moderation pipelines. This repository is documentation-only and provides the ecosystem overview for the current package set.

## Packages

| Package | Repository | Status | Purpose |
| --- | --- | --- | --- |
| `@textfilters/core` | `textfilters/core` | `0.1.0` on GitHub Packages | Shared contracts and pipeline utilities. |
| `@textfilters/url` | `textfilters/url` | `0.1.0` on GitHub Packages | URL and obfuscated-link filtering. |
| `@textfilters/phone` | `textfilters/phone` | `0.1.0` on GitHub Packages | Phone-like sequence filtering. |
| `@textfilters/profanity` | `textfilters/profanity` | `0.1.0` on GitHub Packages | Profanity filtering primitives. |
| `@textfilters/spam` | `textfilters/spam` | `0.1.0` on GitHub Packages | Lightweight in-memory spam guard primitives. |
| `@textfilters/email` | `textfilters/email` | `0.2.2` on GitHub Packages | Email address and obfuscated-email filtering. |

All current packages are published to GitHub Packages.

## Installation

Packages are published to GitHub Packages, not the public npm registry.

```ini
@textfilters:registry=https://npm.pkg.github.com
```

GitHub Packages requires npm authentication for installs, including public packages.

```sh
npm install @textfilters/core @textfilters/url @textfilters/phone @textfilters/profanity @textfilters/spam @textfilters/email
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

Packages use semantic versioning and Release Please from Conventional Commit history on `main`. Packages are published to GitHub Packages first, with GitHub Releases and immutable release tags using `vX.Y.Z`. npmjs.org publication may be added later.

## Support

Open package-specific bugs in the relevant package repository. Open ecosystem documentation issues in this repository. For security reports, see the organization security policy in `textfilters/.github`.

## Roadmap

Future package additions are tracked as they become ready for release.

## License

MIT
