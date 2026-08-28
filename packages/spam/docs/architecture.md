# Spam Architecture

`createSpamGuard(options?)` creates an immutable guard object with private,
bounded in-memory state. No state is shared between instances.

## Decision Flow

```text
ModerationInput
  -> validate actorKey, text, and optional nowMs
  -> normalize actor key and text
  -> reject empty text
  -> check minimum interval
  -> check normalized duplicates
  -> check burst threshold
  -> record accepted message
  -> prune actor and per-actor state
```

The first failed check returns one of `empty`, `too_fast`, `duplicate`, or
`burst`. Evaluation happens on a cloned actor record, so a rejected attempt does
not change interval, duplicate, or burst windows.

Each actor retains a bounded timestamp list and a bounded map of recent
normalized texts. The actor map is capped by `maxActors`; expired and then
oldest records are pruned when the cap is exceeded. `reset()` clears the map.

When `nowMs` is omitted, the guard reads `Date.now()`. Explicit clocks are
useful for deterministic callers and tests, but non-finite values are rejected.

The guard implements the core `TextGuard` contract and therefore runs before
text filters in a moderation pipeline. It always sees the original unmasked
message. Storage services, persistence, queues, and async coordination remain
application responsibilities.
