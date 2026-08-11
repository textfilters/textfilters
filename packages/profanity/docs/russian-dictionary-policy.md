# Russian Dictionary Policy

This document describes the policy used for the bundled Russian dictionary. It
does not define a public language-pack DSL.

## Scope

The Russian dictionary is a maintained built-in moderation corpus. It covers
reviewed Russian obscene mat, strong insults, and vulgar expressions with
taxonomy metadata and explicit matcher order. New coverage should be added as
narrow family rules, not broad catch-all expressions.

Current reviewed family areas include roots around `бля`, `еб`, `пизд`, `хуй`,
`пидор`, `мудак`, `сука`, `гандон`, `залупа`, `шлюха`, `хер`, `говно`,
`дерьмо`, `срать`, `засранец`, `обосрал`, and `чмо`, plus selected safe
transliterations.

The package is not a broad toxicity, hate-speech, slur, harassment, or
political insult detector. Those areas require separate policy decisions,
profiles, or packages because they often depend on target identity, speaker
intent, local policy, and context. Russian additions should stay focused on
reviewed profanity, vulgarity, obscene mat, vulgar bodily terms, and strong
direct insults with bounded false-positive risk.

See [Russian profanity coverage map](russian-coverage-map.md) for current
family coverage, known gaps, intentionally unsupported areas, and the
maintenance checklist for new families.

## Taxonomy

Use the weakest category and severity that still describes the moderation
impact:

| Category        | Typical Russian Use                                              |
| --------------- | ---------------------------------------------------------------- |
| `OBSCENE_MAT`   | Core obscene mat roots and direct obscene anatomical references. |
| `STRONG_INSULT` | Direct personal insults and degrading nouns.                     |
| `VULGAR`        | Vulgar but less severe expletives, reactions, and scatology.     |
| `EUPHEMISM`     | Soft euphemistic forms when intentionally covered.               |

Severity is ordered as `soft < low < medium < high`:

- `high` covers core explicit mat and the strongest direct insults;
- `medium` covers mat derivatives and ordinary direct vulgar insults;
- `low` covers everyday scatology, body terms, weak sexual vulgarity, and
  mild substitutes;
- `soft` covers shortened or intentionally softened euphemisms.

This keeps `бля` and `пиздец` at `high`, forms such as `прихуел`, `хуйня`,
`сука`, and `гандон` at `medium`, and `говно`, `жопа`, `сру`, and `дрочить`
at `low`. Euphemistic `лять`, `ёпт`, and `пох` are `soft`.

Do not use severity to mark implementation confidence. If a rule is risky,
narrow the source or add false-positive locks instead. Strict, loose, split,
and transliterated views of the same expression must keep the same taxonomy.
See [Built-in taxonomy and severity policy](severity-policy.md) for the shared
cross-language rubric and migration notes.

## Strict And Loose Policy

Strict rules should match clear normalized tokens. Loose rules may cover
separators, zero-width characters, repeated letters, fullwidth ASCII, combining
marks, and reviewed homoglyph forms when the expected false-positive surface is
bounded.

Every TypeScript rule created through `russianRule` must declare its matcher
mode. A strict-only rule declares `match: "strict"` and has no loose options. A
loose or strict-and-loose rule must also make its repetition decision explicit:
use `loose: {}` for separator-only matching, or `loose: { stretch: true }` only
when repeated-letter matching is intended and covered by regression cases.
Matcher mode and stretching must not be inherited from helper defaults.

Use loose transliteration only for reviewed spellings. Transliteration rules
must account for same-length homoglyph folding before matching, for example
Latin letters that normalize into Cyrillic lookalikes. Bare transliterations
that overlap common names, companies, places, or product terms need explicit
neutral-context tests or should stay unsupported.

## False-Positive Locks

Every broad or high-risk rule needs nearby negative audit cases. Locks should
cover:

- neutral Russian words sharing the same prefix;
- known toponyms and names;
- product, company, ticker, and spreadsheet-like tokens;
- Ukrainian `підор...` words that overlap Russian insult roots;
- Latin proper-name contexts for risky transliterations;
- token-boundary cases around URLs, usernames, and names when relevant.

False-positive tests are part of the dictionary source policy. Removing or
weakening one should be treated like a behavior change, not test cleanup.

## Authoring Model

Legacy reviewed families may remain as JSON. New built-in Russian family files
may use `src/languages/ru/profanity/authoring.ts` to share repeated boilerplate:

- `language: "ru"` dictionary wrapping;
- taxonomy-preserving rule construction;
- common Cyrillic and Latin suffix fragments;
- token-boundary wrappers;
- reviewed neutral-context guards.

The helper is internal. It must not be documented as a public API, exported from
the package entrypoint, or used to create generated matcher JSON. The assembled
dictionary must continue to validate as a `ProfanityLanguageDictionary`, and
`order.json` remains the explicit Russian dictionary source-order file.

## Matcher Cost Budget

Run `npm run report:matcher-cost --workspace @textfilters/profanity` to inspect
the Russian matcher structure. The report includes strict, loose, stretching,
candidate-indexed loose, and global-scan fallback counts. Every fallback entry
also names its rule and explains why a safe leading signature could not use the
candidate index.

The reviewed structural budget is stored in
[the Russian matcher cost baseline](../tests/fixtures/russian-matcher-cost-baseline.json).
Update it only for an intentional matcher-cost change, review the rule-level
diff, and compare the package benchmark against `origin/main` on the same
machine. The structural budget is deterministic; wall-clock timings remain
supporting evidence rather than a CI threshold.

See [Russian rule ordering model](russian-rule-ordering-model.md) for the
current ordering audit and compatibility constraints.
