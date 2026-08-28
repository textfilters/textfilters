# URL Architecture

The package exposes a shared `filter` and `createUrlFilter(options?)`. Parsing,
normalization, range collection, and code-point bookkeeping are internal.

## Flow

```text
source string
  -> package-local normalization and metadata
  -> scheme, authority, host, path, TLD, and defanged-dot matching
  -> internal code-point ranges
  -> package-local UTF-16 conversion
  -> TextMatch[] or one core masking pass
```

`check()` uses the same matcher with early stop. `find()` and `process()` collect
matches once. `censor()` collects only ranges required for masking. Every public
operation validates that its input is a string.

The TLD and allowed-domain arrays are normalized and copied when a filter is
created. External mutation therefore cannot change an existing instance.
Allowed hosts are removed before public matches are produced.

Ambiguous literal-dot whitespace keeps the conservative default behavior.
Stronger URL evidence, including a path, bracketed dot, word dot, scheme, or
explicit authority, remains detectable.

The parser stays split by responsibility because URL syntax has independent
scheme, authority, host, path, normalization, and TLD concerns. None of those
internal contracts are package exports.
