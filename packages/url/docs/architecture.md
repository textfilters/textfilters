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

Closed sentence boundaries are decided before host labels are joined. The
domain parser and explicit short-host continuation use the same predicate in
`dots.ts`: a literal sentence dot, a closing bracket or quote on either side,
and whitespace after the dot. The predicate inspects both sides before deciding
and ignores formatting characters. It uses raw normalized punctuation so dot
markers and other characters mapped to dots keep their URL meaning.

This boundary ends a host even when the following text looks like a path.
Matching resumes independently after the boundary; allowlist selection receives
only the separate hosts. No range-stage boundary repair or allowlist override
is needed. Plain spaced dots without a closer retain their existing ambiguity
and allowlist behavior.

The parser stays split by responsibility because URL syntax has independent
scheme, authority, host, path, normalization, and TLD concerns. None of those
internal contracts are package exports.

A candidate check runs before code-point metadata is prepared. One callback path emits ranges and shares its metadata with the adapter, which creates UTF-16 offsets only on the first match. The boolean check stops the same matcher immediately; there is no second array collection or sorting path.

## Domain-dot Candidate Pass

The candidate pass remembers the latest letter/digit on the left and whether an
eligible dot has occurred since it. The next letter/digit establishes the right
side and returns immediately. ASCII uses direct character-code checks. Unicode
uses code points and remembers the last non-variation-selector position, so the
left sentence-boundary check never revisits a selector run.

The only lookahead skips selectors immediately following a sentence dot. These
runs are disjoint (a selector is not a dot), so their total work is bounded by the
input size. Every code point is visited at most once by the forward pass and
once by selector lookahead. ASCII uses constant auxiliary space; Unicode still
allocates its code-point array. Neither path truncates input or limits candidate
length. This proves O(n) time for `hasLikelyDomainDot`, not for the full URL
parser. Existing marker, split-word, and downstream parser paths are unchanged.
