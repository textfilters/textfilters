# URL Filter Architecture

## Goals

The package provides composable URL censoring while preserving existing URL matching behavior. The implementation is split into small parser modules so each rule family can be changed without turning the filter into a framework.

The matcher keeps two URL paths intentionally separate:

- bare domains use the configured TLD list, whose default is the complete IANA root-zone snapshot with Unicode IDN spellings;
- explicit-scheme URLs are treated as stronger evidence, so they can match localhost, ports, IPv6, userinfo, IDN or emoji hosts, and unknown TLDs.

## Public API

`createUrlFilter(config?)` creates a URL censor with optional `maskChar`,
`tlds`, `allowedDomains`, and `ambiguousSpacedDots` settings.

The default `filter` export is a shared instance with the default TLD list. `urlFilter(config?)` is an alias for `createUrlFilter(config?)`.

`UrlFilterConfig` supports:

- `maskChar`: the replacement character passed through core mask normalization;
- `tlds`: a custom bare-domain TLD allowlist. A non-empty normalized custom list replaces the default list; normalized-empty input retains the defaults.
- `allowedDomains`: case-insensitive exact hostnames excluded from filter and scanner results after parsing.
- `ambiguousSpacedDots`: whether a bare candidate whose final two labels use a literal dot followed by whitespace and no URL-tail evidence is preserved as prose or blocked as a defanged domain. The default is `preserve`.

`allowedDomains` is a synchronous configuration snapshot. Consuming
applications own external loading, validation, caching, and refresh behavior.
Refreshing the snapshot creates a new filter or scanner instance. Exact-host
matching does not trust subdomains or cross-script lookalikes, and invalid
entries fail closed.

## High-Level Flow

```mermaid
flowchart TD
  input["Input text"] --> config["Normalize mask character and TLD config"]
  config --> scanner["Run URL scanner"]
  scanner --> prefilter["Cheap candidate prefilter"]
  prefilter --> meta["Create metadata"]
  meta --> explicit["Collect explicit scheme URLs"]
  meta --> bare["Collect bare domains"]
  explicit --> allowlist["Exclude exact allowed domains"]
  bare --> allowlist
  allowlist --> merge["Merge code point ranges"]
  merge --> mask["Mask original code point ranges"]
  mask --> output["Output censored text"]
```

## Module Map

```mermaid
graph TD
  index["index.ts"] --> contracts["contracts.ts"]
  index --> scanner["scanner.ts"]
  index --> tlds["tlds.ts"]
  scanner --> allowed["allowed-domains.ts"]
  scanner --> chars["chars.ts"]
  scanner --> contracts
  scanner --> meta["meta.ts"]
  scanner --> ranges["ranges.ts"]
  scanner --> tlds
  ranges --> allowed
  ranges --> chars
  ranges --> contracts
  ranges --> dots["dots.ts"]
  ranges --> scheme["scheme.ts"]
  ranges --> domain["domain.ts"]
  ranges --> explicit["explicit-authority.ts"]
  ranges --> meta
  ranges --> tlds
  allowed --> chars
  allowed --> meta
  explicit --> host["explicit-host.ts"]
  explicit --> tail["authority-tail.ts"]
  explicit --> path["path.ts"]
  explicit --> domain
  explicit --> meta
  host --> chars
  host --> dots
  host --> meta
  tail --> chars
  tail --> dots
  tail --> meta
  domain --> chars
  domain --> dots
  domain --> meta
  domain --> path
  scheme --> chars
  scheme --> meta
  dots --> chars
  dots --> meta
  meta --> chars
  path --> chars
  path --> dots
  path --> meta
```

## File Responsibilities

| File                        | Responsibility                                                                                             | Out of scope                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `src/index.ts`              | Public entrypoint, public exports, and censor wrapper orchestration.                                       | Parser details or matching policy.         |
| `src/contracts.ts`          | Public types and constants.                                                                                | Internal parser types.                     |
| `src/scanner.ts`            | URL scanner factory, range scanner output, boolean checks, sink streaming, and cheap clean-text prefilter. | Low-level parser rules.                    |
| `src/tlds.ts`               | Versioned default IANA TLD data, TLD normalization, and derived lookup compilation.                        | Host parsing or URL range collection.      |
| `src/allowed-domains.ts`    | Exact allowed-domain normalization and parsed-host comparison.                                             | Network loading, caching, or suffix trust. |
| `src/chars.ts`              | Shared character sets, punctuation policy, lookalike map, and static parser character arrays.              | Parser control flow.                       |
| `src/meta.ts`               | Source metadata, raw and skeleton views, shared hostname limits, and low-level consume helpers.            | URL-specific matching policy.              |
| `src/scheme.ts`             | Real, split, hxxp, and defanged scheme parsing.                                                            | Host or path parsing.                      |
| `src/dots.ts`               | Real, Unicode, bracketed, word, and Russian defanged dot parsing.                                          | TLD validation.                            |
| `src/domain.ts`             | Bare domain labels, separators, TLD validation, candidate boundary evidence, and domain path tails.        | Explicit authority-only host rules.        |
| `src/explicit-authority.ts` | Explicit-scheme authority orchestration and final range construction.                                      | Low-level host or tail parsing.            |
| `src/explicit-host.ts`      | Localhost, port, IPv6, userinfo, underscore, IDN, emoji, and unknown-TLD host parsing.                     | Trailing prose and path-tail recovery.     |
| `src/authority-tail.ts`     | Authority boundary trimming, glued prose detection, and spaced/defanged continuation checks.               | Host validity or bare-domain TLD policy.   |
| `src/path.ts`               | Path, query, fragment continuation and trailing prose trimming.                                            | Scheme or TLD parsing.                     |
| `src/ranges.ts`             | Bare-domain candidate policy, allowed-domain arbitration, internal range collection, and range merging.    | Public API exports or parser primitives.   |

## Matching Strategy

The parser reads the original input as code points and builds parallel metadata
arrays. `raw` text is NFKC-normalized and lowercased through
`@textfilters/core`. `skeleton` additionally folds a versioned set of
single-code-point Unicode letter confusables toward ASCII so obfuscated hosts
and schemes can be compared against ASCII rules.

Scanner integrations reuse the caller's prepared `codePoints` view when
building metadata. Direct text helpers create the same view lazily after the
candidate prefilter succeeds.

Ranges always point back to the original code point indexes. This keeps masking length-preserving and avoids recalculating offsets after normalization.

Real URL schemes match `http` and `https`. Obfuscated schemes match `hxxp`, split-letter forms such as `h t t p`, and defanged delimiters such as `[:]//` or `[://]`.

Bare domains are parsed from labels separated by real, Unicode, or defanged
dots. They require a configured TLD unless the TLD is punycode-like. The
default list covers the complete IANA root-zone snapshot, and the existing
lookalike skeleton matches mapped visual substitutions against ASCII entries in
that list. Unicode TLD entries remain valid by normalized raw spelling but do
not synthesize ASCII TLD targets. A whitespace-wrapped typographic list
separator (`•`, `·`, `⋅`, or `・`) between two repeated standalone words is
prose, including at sentence boundaries; complete hosts before unrelated text
after whitespace-wrapped dot forms and continuations with domain or URL-tail
evidence remain detectable.

Every completed bare-domain label is finalized from its original source code
points through one whole-string NFKC normalization before raw and skeleton
lookup. The label parser and adjacent-domain trimming share that finalization
rule, so canonical decompositions, combining marks, and multi-character
compatibility expansions cannot diverge between paths. Label and hostname
limits use Unicode code-point counts across bare, explicit, and allowed-domain
paths. `tlds.ts` normalizes custom TLD entries and derives directional ASCII
targets only from normalized ASCII entries. The scanner combines those lookups
with the exact-host allowlist and normalized spaced-dot policy once per factory
instance. Low-level compatibility wrappers build the same policy from their
listed TLDs; the retained precomputed-target argument cannot replace the
derived targets.

A bare candidate whose final two labels use a literal single-character dot
followed by whitespace and no URL-tail evidence is intentionally
policy-controlled because its suffix is identical to sentence punctuation.
`preserve` leaves it unchanged without lexical or capitalization heuristics.
`block` treats it as a defanged domain. Explicit schemes, paths, queries,
fragments, ports, non-literal dot markers, and other stronger URL evidence are
unaffected by this policy.

Bare-domain parsing returns the complete parsed candidate together with any
domain selected by an internal sentence or completed-host boundary. Range
collection then applies prose policy and allowed-domain arbitration once,
without reparsing the selected suffix.

Explicit authorities are parsed after a scheme and can use broader host syntax than bare domains. That path accepts localhost, ports, IPv6 bracket hosts, userinfo, underscores, IDN and emoji labels, and unknown TLDs.

Allowed-domain checks use parsed hostname labels, not the full URL range. NFKC,
case, recognized dot variants, zero-width marks, and a trailing DNS root dot
are normalized. Parser skeletons are deliberately excluded from trust
decisions so visually similar cross-script hostnames cannot inherit an ASCII
domain exception. Unicode and punycode spellings remain separate configuration
entries. Defanged dots still resolve to the same parsed labels.

Path, query, and fragment continuation is shared by bare and explicit URL parsing. It trims trailing prose punctuation while keeping balanced path delimiters when they are part of the URL.

## Explicit Scheme vs Bare Domain

Examples:

- `https://example.unknown/path` should match because the scheme is explicit.
- `example.unknown/path` should not match by default because bare domains require configured TLDs.
- `http://localhost:3000/admin` should match because localhost is valid after an explicit scheme.
- `svc.internal` should match only with custom TLD config such as `{ tlds: ["internal"] }`.

## Embedded Snapshot Maintenance

The embedded IANA root-zone snapshot is updated manually; the package never
fetches or generates TLD data at build time or runtime. A refresh must replace
the ASCII entries and their decoded Unicode IDN spellings together, update the
version header in `src/tlds.ts`, and verify that the list has no missing, extra,
empty, or duplicate values relative to the captured IANA source. Run the full
package check and URL benchmark before committing a refreshed snapshot.

The Unicode lookalike snapshot is also maintained manually from the recorded
UTS #39 `confusables.txt` version. Keep only single-code-point letters whose
lowercase NFKC form maps toward an ASCII letter, preserve the documented
direction for case-folding collisions, and keep dot additions limited to
punctuation entries mapped directly to `.`. The exhaustive scanner test must
cover every embedded mapping after each refresh.

## Range And Masking Rules

The package collects code point ranges before masking. Clearly clean text is
rejected by a cheap prefilter before metadata arrays are built. Explicit-scheme
URLs are collected first because they can validate unknown TLDs and wider
authority forms. Bare-domain ranges are collected after that. Exact allowed
domains are skipped while the parser cursor still advances past the complete
URL. Remaining ranges are merged and deduplicated before being passed to core
masking.

The prefilter applies the configured spaced-dot policy before allocating parser
metadata. In `preserve` mode, an attached sentence dot followed by whitespace
does not make ordinary prose a domain candidate by itself; strict `block` mode
keeps that candidate. Stronger URL evidence and later unspaced domain dots
still enter the parser. ASCII code points use direct normalization and
classification while non-ASCII input retains the full Unicode path.

The public `createUrlScanner()` wrapper returns code point ranges in a shape
that can be used by the shared core range scanner contract. It also exposes
`check(input)` for boolean checks and `scan(input, sink)` for allocation-aware
range streaming with early stop support. Inputs may include shared-style text
hints such as dot, slash, colon, and non-ASCII markers so clearly clean text can
skip parser metadata allocation. The existing `createUrlFilter()`, `urlFilter()`,
and `filter` wrappers use that scanner while preserving their public censor
behavior.

Trailing punctuation and glued prose are trimmed before a range is emitted. Surrounding quotes and brackets stay outside explicit authority ranges unless they are structurally part of the URL, such as IPv6 brackets or balanced path parentheses.

Masking is idempotent because ranges are collected from the original text before any replacement happens. Masking preserves input length because replacement happens per original code point range.

## Change Guide

| Change                                  | Primary files                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Add a new TLD behavior                  | `src/tlds.ts` + `tests/tlds.spec.ts`                                                                   |
| Change defanged dot behavior            | `src/dots.ts` + public API tests                                                                       |
| Change hxxp/scheme parsing              | `src/scheme.ts` + public API tests                                                                     |
| Change explicit host handling           | `src/explicit-host.ts` + public API tests                                                              |
| Change authority/prose boundaries       | `src/authority-tail.ts` + public API tests                                                             |
| Change path/query/fragment tails        | `src/path.ts` + public API tests                                                                       |
| Change source normalization/lookalikes  | `src/meta.ts` or `src/chars.ts` + `tests/tlds.spec.ts`                                                 |
| Change scanner wrapping or prefiltering | `src/scanner.ts` + scanner tests                                                                       |
| Change allowed-domain behavior          | `src/allowed-domains.ts` + public API tests                                                            |
| Change ambiguous spaced-dot policy      | `src/contracts.ts`, `src/chars.ts`, `src/dots.ts`, `src/domain.ts`, `src/ranges.ts` + public API tests |

## Safety Rules

- Do not expose parser internals as public API.
- Do not make user config accept arbitrary regex.
- Do not change bare-domain matching without compatibility tests.
- Do not update ranges after masking.
- Keep behavioral tests public-API oriented; embedded snapshot invariant tests
  may import the versioned internal data they validate.
- Do not use lookalike skeleton folding for allowed-domain trust decisions.
