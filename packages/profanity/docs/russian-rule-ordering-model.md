# Russian Rule Ordering Model

This note records the Russian dictionary rule-order audit. It does not change
matching semantics, rule ids, taxonomy metadata, strict or loose behavior, or the
current `order.json` sequence.

## Current State

Russian family dictionaries are authored as JSON or internal TypeScript modules
under `src/languages/ru/profanity/`. Each family rule owns its source pattern,
taxonomy metadata, and strict or loose matcher flags.

The assembled Russian dictionary does not use source file import order as its
profile order. Assembly first collects every family rule by id, then maps
`src/languages/ru/profanity/order.json` to the final
`RUSSIAN_PROFANITY_DICTIONARY.rules` array. That file is therefore the explicit
source order for the Russian dictionary and for the strict and loose matcher
view inputs.

Runtime matcher precedence has one additional compiler step. After
`dictionaryRulesForMode()` derives strict and loose view inputs from the
assembled dictionary, `compilePatternDefinitions()` sorts compiled patterns by
descending regular-expression source length. For overlapping compiled patterns
with different source lengths, collectors see the length-sorted compiled order,
not raw `order.json` order.

Existing composition tests already lock these invariants:

- every family dictionary validates through the public validator;
- every Russian rule id is unique;
- `order.json` has no duplicate ids;
- every ordered id resolves to exactly one family rule;
- every family rule is represented in `order.json`;
- the assembled dictionary id order equals `order.json`;
- strict and loose matcher view inputs are derived from the assembled dictionary
  order before compiler sorting.

## Ordering Policy

Keep `order.json` as a compatibility contract for dictionary order and matcher
view input order. Rule placement can affect strict and loose view construction,
and it can affect representative match metadata when overlapping compiled
patterns have equal source-length precedence. It cannot override the compiler's
descending source-length sort. Reordering a rule is therefore a behavior change
only when tests prove that an observable overlap is affected.

When adding a new Russian rule:

1. Place it near the reviewed family area it belongs to.
2. Prefer rule sources that encode the intended specificity directly instead of
   relying on JSON placement to win overlaps.
3. Keep false-positive guard rules and reviewed neutral locks in nearby tests.
4. Add metadata tests when the new rule can overlap an existing source.
5. If overlap behavior depends on precedence, add metadata tests that cover both
   `order.json` placement and compiled source-length sorting.
6. Treat any deliberate reorder as a tested behavior change when it changes
   observable matching or metadata, and document the reason in the pull request.

## Audit Decision

The current explicit dictionary-order model plus compiled source-length sorting
is sufficient for the present corpus. It keeps family authoring local, makes
profile source order visible in one JSON file, and leaves compiled matcher
specificity centralized in the compiler. No semantic reorder is justified in
this pass.

Future work may add small tooling around `order.json`, but it should preserve the
same model: family modules own rule content, and the profile-level order file
owns source order while the compiler owns compiled-pattern precedence.
