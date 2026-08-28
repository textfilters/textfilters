# `@textfilters/spam`

Bounded in-memory spam guard for actor-aware interval, duplicate, and burst
checks.

## Installation

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

Use the guard in `createModerationPipeline({ guards: [spam] })` when spam and
stateless text filters should form one moderation operation. The package does
not provide storage adapters or asynchronous checks.

See [architecture](https://github.com/textfilters/textfilters/blob/main/packages/spam/docs/architecture.md) for state ownership and
[the release process](https://github.com/textfilters/textfilters/blob/main/packages/spam/docs/release-process.md) for release details.
