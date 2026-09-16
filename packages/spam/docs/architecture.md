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
`burst`. The interval check reads the existing record before copying any
collections. Later decisions use a cloned record, so duplicate/burst pruning on
a rejected attempt does not change recorded windows, even if a later call uses
an earlier clock. New actors start directly with an empty record.

Each actor retains a bounded timestamp list and a bounded map of recent
normalized texts. The actor map is capped by `maxActors`; expired and then
oldest records are pruned when the cap is exceeded. A selection pass removes
the oldest timestamp without sorting or copying the actor map; equal timestamps
retain insertion-order tie handling. Finite caller clocks may repeat or decrease;
eviction never assumes insertion order is chronological. `reset()` clears the map.

When `nowMs` is omitted, the guard reads `Date.now()`. Explicit clocks are
useful for deterministic callers and tests, but non-finite values are rejected.

The guard implements the core `TextGuard` contract and therefore runs before
text filters in a moderation pipeline. It always sees the original unmasked
message. Storage services, persistence, queues, and async coordination remain
application responsibilities.
