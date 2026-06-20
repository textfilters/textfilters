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

Severity is ordered as `soft < low < medium < high`. Do not use severity to
mark implementation confidence. If a rule is risky, narrow the source or add
false-positive locks instead.

## Strict And Loose Policy

Strict rules should match clear normalized tokens. Loose rules may cover
separators, zero-width characters, repeated letters, fullwidth ASCII, combining
marks, and reviewed homoglyph forms when the expected false-positive surface is
bounded.

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
`order.json` remains the explicit rule ordering source.
