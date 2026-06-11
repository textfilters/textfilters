# Maintenance Invariants

This guide records the invariants that should stay true while maintaining the
package. For the full pipeline and module map, see [architecture.md](architecture.md).

## Same-Length Normalization

Matching runs on a normalized copy of the source text. Normalization must keep
the JavaScript string length unchanged so collected ranges can be applied
directly to the original input.

Current same-length transforms include fullwidth ASCII folding, latin-to-cyrillic
homoglyph folding, `ё` to `е` folding, and zero-width replacement with a regular
space. Do not introduce normalization that inserts, deletes, or reorders UTF-16
code units unless range mapping is redesigned first.

## UTF-16 Source Ranges

All ranges are UTF-16 offsets into the original source string. This is why
astral characters are masked with two `*` characters and why tests assert string
length around emoji and other astral code points.

## Runtime Literals Vs Internal Built-In Rules

Runtime dictionary terms from `createProfanityFilter(strict, loose)`,
`setStrict`, `setLoose`, `addStrict`, and `addLoose` are normalized literals.
They are not regular expressions.

The built-in Russian corpus is package-owned language dictionary data and may
use controlled internal rules. Keep user-provided terms out of that internal
rule compiler.

Built-in rule objects may carry compiler metadata. `loose.stretch: true` allows
the loose compiler to match repeated word-like atoms with optional separators
between repeats. This is generic matcher behavior; language-specific roots,
aliases, guards, morphology, taxonomy, loose behavior, and false-positive
exceptions must stay in the Russian dictionary profile.

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
