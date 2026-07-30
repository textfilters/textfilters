# @textfilters/spam

Lightweight TypeScript anti-spam guard primitives for content moderation, chat
moderation, UGC moderation, rate limiting, duplicate detection, burst detection,
and actor-based message checks.

Use `@textfilters/spam` to add stateful spam checks beside censoring and
redaction filters in a composable TypeScript text filtering library.

## Installation

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires authentication for npm installs, including public packages.

```sh
npm install @textfilters/core @textfilters/spam
```

## Use Cases

- Block repeated, too-fast, or bursty messages in chat moderation workflows.
- Add actor-based anti-spam checks before running heavier content moderation.
- Return stable spam decision reasons for application-specific moderation
  policy.
- Keep rate limiting and duplicate detection separate from text censoring
  filters.

## Usage

```ts
import {
  createInMemorySpamStateStore,
  createSpamFilter,
} from "@textfilters/spam";

const spam = createSpamFilter({
  minIntervalMs: 700,
  duplicateWindowMs: 12_000,
  burstWindowMs: 10_000,
  burstMaxMessages: 6,
  actorKeyPolicy: "reject_missing",
  clockPolicy: "system",
  trackRejectedAttempts: true,
  stateStore: createInMemorySpamStateStore(),
});

const decision = spam.check({
  actorKey: "user:123",
  text: "hello",
});
```

`createSpamFilter(config?)` returns a stateful guard with stable `name: "spam"` and a `reset()` method. The `spamFilter(config?)` export is a backwards-compatible alias for `createSpamFilter(config?)`.

## Behavior

The package provides an in-memory, actor-based spam guard for interval, duplicate, and burst checks. Each blocked decision returns a stable reason so callers can apply their own moderation policy.

Actor state is bounded by pruning stale entries as messages are checked and by
trimming each actor's record lists after state updates. Each actor keeps at most
`burstMaxMessages` burst timestamps and 256 recent normalized text entries for
duplicate detection. Use one guard instance for a shared moderation scope, or
create isolated instances for separate tenants or test cases. `stateStore` can
supply a custom `SpamStateStore`; omitting it creates an isolated in-memory store
for that filter instance. Filters with matching state policy settings can share
a store, while filters with different policy windows keep isolated actor buckets
inside the same store. `reset()` clears the configured store scope for the
filter.

Recommended server-side usage is to pass a stable authenticated actor key, use
`clockPolicy: "system"` so client-provided timestamps cannot weaken checks, and
enable `trackRejectedAttempts` when repeated rejected attempts should keep
pressure on the actor's interval, duplicate, and burst windows.

By default, missing actor keys share one stable unknown actor bucket for
backward compatibility. Set `actorKeyPolicy: "reject_missing"` to reject
non-empty messages without a normalized actor key with reason `missing_actor`.

By default, finite `nowMs` values are accepted for deterministic tests and
server-controlled callers. Set `clockPolicy: "system"` to ignore `nowMs` and
always use the process clock.

Supported clock policies:

- `input_or_system` is the default. It accepts finite `nowMs` values and falls
  back to `Date.now()` when `nowMs` is missing or non-finite. This preserves
  deterministic tests and trusted server-controlled timestamps.
- `system` ignores caller-provided `nowMs` and always uses `Date.now()`. Prefer
  this policy for server-side moderation endpoints that receive untrusted client
  input.

Finite negative and backward-moving `nowMs` values are preserved for
compatibility under `input_or_system`. They are useful for deterministic tests
but should not be accepted directly from untrusted clients.

By default, rejected messages do not update actor state. Set
`trackRejectedAttempts: true` to count rejected interval, duplicate, and burst
attempts as pressure for future checks.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the decision flow, module map, and change guide.

## Related Textfilters Packages

- `@textfilters/core` for shared pipeline, normalization, and range masking
  primitives.
- `@textfilters/url` for URL detection, obfuscated links, and safe link
  censoring.
- `@textfilters/email` for email detection and contact redaction.
- `@textfilters/phone` for phone number detection and contact redaction.
- `@textfilters/profanity` for Russian profanity filtering and taxonomy-backed
  moderation.

## Release

Releases are managed by Release Please from Conventional Commit history on `main`. When a Release Please release is created, the workflow runs `npm run check` and publishes the package to GitHub Packages. Release tags keep the `v*` pattern.

The package is prepared for publication to GitHub Packages, not the public npm registry.

## License

MIT
