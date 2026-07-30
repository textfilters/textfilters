# Maintenance Invariants

This guide records the invariants that should stay true while maintaining the
package. For the full pipeline and module map, see [architecture.md](architecture.md).

## Same-Length Normalization

Matching runs on a normalized copy of the source text. Normalization must keep
the JavaScript string length unchanged so collected ranges can be applied
directly to the original input.

Current same-length transforms include fullwidth ASCII folding, latin-to-cyrillic
homoglyph folding, `ё` to `е` folding, and zero-width replacement with a regular
split marker. Do not introduce normalization that inserts, deletes, or reorders
UTF-16 code units unless range mapping is redesigned first.

Language dictionaries select either `cyrillic-homoglyphs` or
`latin-preserving`. Both strategies must preserve UTF-16 length. New strategies
must be implemented and reviewed inside this package; dictionary authors cannot
inject arbitrary normalization callbacks. Older dictionaries that omit the
strategy keep the Cyrillic-homoglyph compatibility default.

## Invocation-Local Prepared Input

Prepared normalized views may be reused only within one top-level filter or
scanner operation and only by filters declaring the same package-owned
normalization strategy. Do not add a global or cross-message normalized-text
cache.

Loose candidate facts are valid only for the candidate index that collected
them. Rebuilding matcher state after runtime mutation must use a new index and
must not reuse stale facts.

Scanner hints are optional optimization evidence. Missing, partial, or
conflicting hints must not change whether a match is found. Any skip based on a
length or empty-input hint must first corroborate that fact against the actual
source.

## UTF-16 Source Ranges

All ranges are UTF-16 offsets into the original source string. This is why
astral characters are masked with two `*` characters and why tests assert string
length around emoji and other astral code points.

## Runtime Literals Vs Internal Built-In Rules

Runtime dictionary terms from `createProfanityFilter(strict, loose)`,
`createCustomProfanityFilter({ strict, loose })`,
`setStrict`, `setLoose`, `addStrict`, and `addLoose` are normalized literals.
They are not regular expressions.

The exported `filter` is a shared read-only default instance. Factory-created
filters remain the mutable boundary, so application, tenant, request, or
test-specific terms stay isolated. Filters returned by
`composeProfanityProfiles()` are also read-only and preserve each selected
profile's maintained runtime policy.

Language profiles are declarative objects with stable `id`, `languageTag`, and
a ready-to-use read-only filter. Composition identity is based on `id`, not the
language tag, so multiple explicit profiles may cover the same language.

Composed `analyze()` output preserves overlapping strict, loose, and profile
evidence and annotates it with profile provenance. Censoring and legacy scanner
range output may merge equivalent source ranges, but scanner metadata must keep
the original match evidence. Sink streaming may use profile and matcher order
to preserve early stop.

The built-in Russian corpus is package-owned, human-maintained language
dictionary data and may use controlled internal rules. Keep user-provided terms
out of that internal rule compiler.

Built-in rule objects may carry meaningful compiler metadata. For example,
`loose.stretch: true` allows the loose compiler to match repeated word-like
atoms with optional separators between repeats. Strict and loose entries are
compiled matcher views, not serialized matcher output. This is generic matcher
behavior; language-specific roots, aliases, guards, morphology, taxonomy, loose
behavior, and false-positive exceptions must stay in the Russian dictionary
profile.

## Strict Token Boundaries

Strict word terms match whole normalized tokens. A strict runtime word term such
as `bad` should not match `_bad`, `-bad`, or `badminton`. Symbol-only and phrase
runtime literals have separate strict passes because their token shapes differ
from normal word terms.

## Loose Separator Matching

Loose terms may match across separators such as spaces, hyphens, dots,
underscores, slashes, and similar split characters. Loose matches still need
boundary checks so a separator-obfuscated prefix inside a larger word remains
neutral.

For built-in internal rules, word-like atoms with a `+` quantifier are expanded
with the same loose separator behavior between repeated atoms. This keeps rules
such as character-class aliases compact while covering separated repeats.

## False-Positive Locks

False-positive tests are compatibility locks. When adding or adjusting built-in
rules, add nearby neutral examples for common words that could be crossed by the
new rule. Prefer narrowing a rule over adding broad post-match exceptions.

## Hyphen-Tail Behavior

Known hyphen-tail handling masks the profane prefix of neutral compounds while
continuing to mask profane tails. Examples such as a profane prefix followed by
`-fix`, `-module`, or a neutral word should keep the neutral tail visible.
Examples with a profane tail after the hyphen should remain fully masked through
that profane tail.
