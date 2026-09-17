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
duplicate keys. The actor map is capped by `maxActors`; expired and then
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

## Full-message Duplicate Keys

Normalization processes the entire string before deriving a history key. It
never normalizes separate chunks, so NFKC composition and whitespace behavior
remain consistent across the former 512-code-unit boundary. Actor normalization
is unchanged. Different long messages that previously shared a truncated prefix
are now allowed unless another guard rule blocks them.

Keys use separate namespaces: `text:` plus the complete normalized string up to
512 UTF-16 code units (at most 517 units total), or `sha256:` plus 64 hex digits
for longer messages (71 units total). The standard SHA-256 implementation comes
from `@noble/hashes`, avoiding custom cryptography and preserving synchronous,
portable JavaScript execution without a Node-only runtime import. This dependency
is required for the bounded, full-message comparison, not for normalization.

Hash input is the exact little-endian encoding of every UTF-16 code unit, using
a fixed 1,024-byte scratch buffer. Unlike UTF-8 replacement encoding, it keeps
different unpaired surrogates distinct. The digest has a residual collision risk;
it is not a mathematical proof of equal messages. Short literal keys cannot
collide with digest keys because their namespaces differ.

Hashing takes O(n) time and bounded scratch space. Full-string normalization
still takes input-proportional temporary memory; the complete operation is not
O(1) space. Retained duplicate history stays bounded by 256 fixed-maximum-size
keys per actor and the existing `maxActors` limit. Burst timestamps retain their
existing independent bound. Interval rejection still occurs before hashing or
copying actor collections, and rejected attempts never commit history changes.
