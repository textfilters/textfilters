# Match Metadata Design

This document records the intended direction and current compatibility rules for
profanity match metadata. It is design and status documentation only: it does
not add corpus changes or matcher behavior changes.

The taxonomy metadata rollout plan is tracked separately in
[Profanity Taxonomy Metadata Plan](profanity-taxonomy-plan.md).

## Current State

`src/filter.ts` exposes `analyze(text): ProfanityMatchRange[]` and collects
internal range metadata from two matcher paths:

- `strict`: ranges found by the strict token-oriented matcher.
- `loose`: ranges found by the loose matcher that tolerates separators and other
  evasion-like spellings.

The public API includes:

- `analyze(text): ProfanityMatchRange[]`
- `check(text): boolean`
- `censor(text): string`
- `setStrict(list): void`
- `setLoose(list): void`
- `addStrict(term): void`
- `addLoose(term): void`

The matcher runs on a same-length normalized copy of the input and keeps
accepted ranges as UTF-16 offsets into the original input. `analyze()` returns
those original-input ranges with `mode` and optional rule metadata. `censor()`
applies those original-input ranges when masking.

## Match Mode Is Not Severity

`strict` and `loose` are match modes, not content ratings.

Strict matching describes a narrower tolerance model. It accepts full normalized
tokens and selected literal shapes after boundary checks.

Loose matching describes a broader tolerance model. It can match across
separators or obfuscation-like input, then still applies boundary checks before a
range is accepted.

Neither mode answers whether the matched term is severe, vulgar, mild,
euphemistic, or product-specific. A severe obscene term can be found in strict
mode or loose mode. A mild euphemism can also be found in strict mode or loose
mode. The mode only explains how the matcher found the range.

## Match Range Model

The public match range shape carries rule identity and taxonomy metadata without
changing matching semantics:

```ts
interface ProfanityMatchRange {
  readonly [0]: number;
  readonly [1]: number;
  readonly mode: "strict" | "loose";
  readonly ruleId?: string;
  readonly category?: ProfanityCategory;
  readonly severity?: ProfanitySeverity;
}
```

The tuple positions are UTF-16 offsets into the original input. The internal
collector may still group ranges by mode, but public output is a single list of
accepted match ranges with explicit metadata.

The model preserves enough information for `censor()` to keep its current
behavior and for callers to inspect structured match facts. Generated built-in
rule ids are diagnostic metadata, not stable policy keys; they may change when a
package-owned corpus is reorganized into different compiled matcher views.

## Taxonomy-Driven Options

The public API includes category- and severity-aware filtering options:

```ts
interface ProfanityMatchOptions {
  readonly categories?: readonly ProfanityCategory[];
  readonly severities?: readonly ProfanitySeverity[];
  readonly minSeverity?: ProfanitySeverity;
}
```

These options describe caller-selected filtering, not final moderation policy.
Callers can decide whether to block, warn, censor, log, or ignore a match based
on their own product policy. Combined taxonomy options are intersections:
`categories` must match the category set, `severities` must match the exact
severity set, and `minSeverity` must satisfy the package-defined order
`soft < low < medium < high`.

## Category And Severity Ownership

Category and severity should belong to the rule or term definition, not to the
raw input text.

The same raw substring can appear through direct typing, homoglyph folding,
separator evasion, or another normalization path. Those input forms should not
change the underlying taxonomy of the matched rule. If a rule represents an
obscene term, a loose/evasive match of that rule is still the same category.

This means corpus or rule definitions can carry explicit taxonomy metadata, for
example:

- an explicit rule id when the package intentionally supports one;
- a category such as `OBSCENE_MAT`, `STRONG_INSULT`, `VULGAR`, or `EUPHEMISM`;
- a severity such as `high`, `medium`, `low`, or `soft`;
- any language- or corpus-specific review notes that are needed before exposure.

Runtime string terms remain unclassified and omit taxonomy metadata. Object terms
can carry metadata. Taxonomy filters exclude matches that do not carry the
requested metadata.

## Evasion Is Orthogonal To Category

Loose matching, separator handling, homoglyph folding, zero-width replacement,
and other evasion-related behavior should remain orthogonal to category.

Category answers what was matched. Mode and normalization details answer how it
was found. Keeping those dimensions separate prevents accidental policy coupling,
for example treating every loose match as more severe or treating every strict
match as safe to down-rank.

## Source Range Invariant

All ranges must remain based on original input offsets.

The matcher can continue to operate on a same-length normalized string, but
metadata ranges must point back to the caller's original JavaScript string. This
keeps `censor()` stable, preserves current UTF-16 behavior, and avoids exposing
normalized-only offsets that callers cannot safely apply to their input.

Any future normalization that inserts, deletes, reorders, or combines code units
would require an explicit source-map design before match metadata can expose
correct ranges.

## Backward Compatibility

`check()` and `censor()` must keep their current default behavior.

Metadata remains additive on `analyze()` output. Existing callers should not need
to pass category or severity options to preserve today's boolean and masking
behavior.

Taxonomy-aware options are opt-in and must not silently narrow the default
behavior of calls that omit options.

## Corpus Taxonomy Audit Status

The built-in Russian dictionary is object-backed so each package-owned rule can
carry source, match behavior, and optional taxonomy metadata in one place. The
current Russian rules do not attach taxonomy metadata yet. Runtime object-backed
terms and future taxonomy-backed corpus rules can carry metadata, and tests
enforce that any taxonomy-backed built-in rule uses a valid category and
severity.

## Open Questions

Future taxonomy-driven filtering still needs product and implementation
decisions:

- Should category names be language-neutral, Russian-specific, or
  package-specific if more categories are added?
- Should strong slurs and general strong insults be separate categories?
- Should deprecated or ambiguous terms get a review state before they are enabled
  by default?
- Should default `censor()` include all current terms for compatibility while
  future category-aware calls can narrow the scope?
- What metadata should runtime literal terms receive when callers add terms
  through the existing mutable dictionary API?
- Should public matches expose normalization details beyond `normalizedValue`,
  such as whether homoglyph folding or separator tolerance contributed to the
  match?
- How should overlapping strict and loose matches for the same underlying rule be
  merged, ranked, or reported?
