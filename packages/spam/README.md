# `@textfilters/spam`

Bounded in-memory spam guard for actor-aware interval, duplicate, and burst
checks.

## Installation

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires
authentication for npm installs, including public packages.

```sh
npm install @textfilters/spam @textfilters/core
```

## Usage

```ts
import { createSpamGuard } from "@textfilters/spam";

const spam = createSpamGuard();
const decision = spam.check({
  actorKey: "user:123",
  text: "hello",
  nowMs: 1_000,
});
```

## Configuration

```ts
const spam = createSpamGuard({
  minIntervalMs: 700,
  duplicateWindowMs: 12_000,
  burstWindowMs: 10_000,
  burstMaxMessages: 6,
  maxActors: 3_000,
});
```

| Option              | Meaning                                      |
| ------------------- | -------------------------------------------- |
| `minIntervalMs`     | Minimum time between accepted actor messages |
| `duplicateWindowMs` | Normalized duplicate retention window        |
| `burstWindowMs`     | Sliding burst window                         |
| `burstMaxMessages`  | Accepted messages allowed in a burst window  |
| `maxActors`         | Maximum retained actor records               |

Each guard instance owns independent bounded state. `actorKey` is required.
Omitted `nowMs` uses `Date.now()`; an explicit value must be finite. Rejected
messages do not extend any window, and `reset()` clears all state.

Duplicate comparison covers the entire normalized message, including differences
beyond 512 UTF-16 code units. Normalization removes supported zero-width
characters, applies NFKC and lowercase, collapses whitespace, and trims it.
Short normalized messages are compared exactly; messages longer than 512 code
units use SHA-256 of their exact UTF-16LE code units. The residual risk of a
SHA-256 collision is negligible, but equality is not mathematically guaranteed.
Unpaired surrogates remain distinct. History retains at most 256 bounded keys
per actor; temporary normalization memory still grows with the input length.

Use the guard in `createModerationPipeline({ guards: [spam] })` when spam and
stateless text filters should form one moderation operation. The package does
not provide storage adapters or asynchronous checks.

See [architecture](docs/architecture.md) for state ownership and
[the release process](docs/release-process.md) for release details.
