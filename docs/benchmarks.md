# Benchmarks

The benchmark suite measures built public package operations. Use it only for
before/after comparisons on the same machine, Node.js version, workspace state,
and command shape. Absolute timings are not portable promises.

See [performance budget](performance-budget.md) for regression thresholds and
[ecosystem policy](ecosystem-policy.md) for evidence requirements.

## Commands

```sh
npm ci
npm run build
npm run benchmark
```

Run selected suites by passing their names after `--`:

```sh
npm run benchmark -- core combined spam
npm run benchmark -- url email phone profanity
```

Supported suites are `core`, `url`, `email`, `phone`, `profanity`, `spam`, and
`combined`.

## Output

Each row reports its iteration count, total elapsed milliseconds, average
milliseconds per operation, and approximate operations per second. Compare the
median `avg ms` value from at least three identical runs.

## Coverage

The `url`, `email`, and `phone` suites cover construction or shared-filter
access plus `check()`, `find()`, `censor()`, and `process()` on short clean,
long clean, positive, late-match, and custom-mask inputs.

The `profanity` suite covers Russian, English, and combined dictionary
construction; clean and matched text; late matches; source range collection;
masking; combined processing; phrases; obfuscation; and exact allow rules.

The `core` suite covers combined-filter construction and operations plus
moderation pipeline construction, an allowed path, and an early blocked path.

The `spam` suite covers guard construction, allowed checks, interval,
duplicate, and burst blocks, bounded per-actor growth, and actor-map pruning.
Every scenario uses an explicit deterministic clock.

The `combined` suite runs URL, email, phone, and Russian/English profanity
filters against the same original text. It measures all four `TextFilter`
operations for clean, late-match, overlapping, multilingual, and obfuscated
inputs, followed by allowed and early-blocked moderation paths.

## Interpretation

- Compare identical labels and inputs wherever the public operation remains
  comparable.
- Treat a change as meaningful only when it repeats across multiple runs.
- Compare `find()`, `censor()`, and `process()` independently; a faster boolean
  check does not justify a slower full result path.
- Separate construction rows from steady-state rows.
- Investigate results outside [the performance budget](performance-budget.md)
  before delivery.
