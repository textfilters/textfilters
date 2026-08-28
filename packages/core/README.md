# `@textfilters/core`

Small TypeScript contracts and composition helpers for stateless text filters
and actor-aware moderation guards.

## Installation

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires
authentication for npm installs, including public packages.

```sh
npm install @textfilters/core
```

## Usage

```ts
import { combineFilters, createModerationPipeline } from "@textfilters/core";
import { filter as email } from "@textfilters/email";

const content = combineFilters(email);
const filtered = content.process("Contact user@example.com", "#");

const moderation = createModerationPipeline({ filters: [content] });
const result = moderation.process({
  actorKey: "user:123",
  text: "Contact user@example.com",
});
```

## Public API

- `combineFilters(...filters)` creates one immutable `TextFilter`.
- `createModerationPipeline({ guards, filters })` creates an immutable pipeline
  whose only operation is `process()`.
- `maskTextRanges(text, ranges, mask?)` masks UTF-16 source ranges while
  preserving string length.
- `TextFilter`, `TextGuard`, match, result, and moderation contracts are
  exported as TypeScript types.

Child filters always inspect the original text. Guard evaluation stops on the
first blocked decision. Public text methods accept strings only, matches use
UTF-16 offsets, and custom masks must be one BMP code unit; unsupported masks
fall back to `*`.

See [the release process](https://github.com/textfilters/textfilters/blob/main/packages/core/docs/release-process.md) for package release details.
