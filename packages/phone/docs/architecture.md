# Phone Architecture

The package exposes one immutable `filter`. Candidate parsing and code-point
bookkeeping are internal.

## Flow

```text
source string
  -> folded digit metadata
  -> grouped phone candidate parser
  -> general text false-positive guards
  -> internal code-point ranges
  -> package-local UTF-16 conversion
  -> TextMatch[] or one core masking pass
```

The package-local adapter provides `check`, `find`, `censor`, and `process` from
the same candidate matcher. `check()` stops at the first accepted candidate.
`process()` collects matches once. Public methods reject non-string input.

False-positive guards cover general text patterns such as dates, times,
coordinates, IP-like values, balances, versions, and identifiers. The matcher
does not parse JSON or grant special trust to machine keys or numeric sentinel
values. Callers must parse structured payloads and select user text before
filtering.

Public matches always use UTF-16 offsets into the original string. Internal
code-point ranges and matching helpers are not exported.
