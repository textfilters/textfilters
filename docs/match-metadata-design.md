# Match Metadata Design

This document records the intended direction for future profanity match metadata.
It is design groundwork only: it does not add a public analysis API, category
options, severity options, corpus changes, or matcher behavior changes.

## Current State

After the structured range refactor, `src/filter.ts` collects internal
`ProfanityRanges` with two range lists:

- `strict`: ranges found by the strict token-oriented matcher.
- `loose`: ranges found by the loose matcher that tolerates separators and other
  evasion-like spellings.

The public API remains unchanged:

- `check(text): boolean`
- `censor(text): string`
- `setStrict(list): void`
- `setLoose(list): void`
- `addStrict(term): void`
- `addLoose(term): void`

The matcher still runs on a same-length normalized copy of the input and keeps
accepted ranges as UTF-16 offsets into the original input. `censor()` applies
those original-input ranges when masking.

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

## Future Internal Model

A future implementation should move from raw mode buckets toward an internal
range record that can carry rule identity and taxonomy metadata without changing
the current matching semantics.

One possible internal shape:

```ts
interface ProfanityMatchRange {
  readonly start: number;
  readonly end: number;
  readonly mode: "strict" | "loose";
  readonly ruleId?: string;
  readonly category?: ProfanityCategory;
  readonly severity?: ProfanitySeverity;
}
```

`start` and `end` must remain UTF-16 offsets into the original input. The
internal collector may still group ranges by mode while the code is migrated, but
the long-term model should allow a single list of accepted match ranges with
explicit metadata.

The internal model should preserve enough information for `censor()` to keep its
current behavior and for a later analysis API to expose structured facts.

## Future Public Model

A later public API can expose a normalized, documented match object. One possible
shape:

```ts
interface ProfanityMatch {
  readonly start: number;
  readonly end: number;
  readonly value: string;
  readonly normalizedValue: string;
  readonly mode: "strict" | "loose";
  readonly category: ProfanityCategory;
  readonly severity: ProfanitySeverity;
  readonly ruleId?: string;
}
```

The public object should describe facts about the match, not the final moderation
decision. Callers can then decide whether to block, warn, censor, log, or ignore
a match based on their own product policy.

## Category And Severity Ownership

Category and severity should belong to the rule or term definition, not to the
raw input text.

The same raw substring can appear through direct typing, homoglyph folding,
separator evasion, or another normalization path. Those input forms should not
change the underlying taxonomy of the matched rule. If a rule represents an
obscene term, a loose/evasive match of that rule is still the same category.

This means future corpus or rule definitions should carry explicit taxonomy
metadata, for example:

- a stable rule id;
- a category such as `OBSCENE_MAT`, `STRONG_INSULT`, `VULGAR`, or `EUPHEMISM`;
- a severity such as `high`, `medium`, `low`, or `soft`;
- any language- or corpus-specific review notes that are needed before exposure.

Runtime literal terms will need a separate design decision: either callers
provide metadata for them, or the package assigns a conservative default.

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

The future metadata pipeline should be an implementation detail until a separate
public API is added. Existing callers should not need to pass category or
severity options to preserve today's boolean and masking behavior.

If category-aware options are added later, they should be opt-in and should not
silently narrow the default behavior of current calls.

## Future `analyze()`

A public `analyze()` API should be a separate future pull request after design
and code groundwork are in place.

That future pull request should define the exact public types, option names,
runtime literal metadata behavior, sorting and de-duplication rules, and tests
for direct and obfuscated matches. This document intentionally avoids adding
`analyze()` to the current public API.

## Open Questions

The taxonomy work from issue #3 still needs product and implementation decisions:

- Should `severity` be derived from `category`, or should both be stored
  explicitly?
- Should category names be language-neutral, Russian-specific, or
  package-specific?
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
