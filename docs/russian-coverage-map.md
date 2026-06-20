# Russian Profanity Coverage Map

This document maps the built-in Russian profanity dictionary coverage. It is a
maintenance aid for reviewed family additions, not a generated matcher contract
or a promise to cover every offensive Russian phrase.

See [Russian dictionary policy](russian-dictionary-policy.md) for taxonomy and
false-positive review rules.

## Scope Boundary

The Russian dictionary covers reviewed profanity, vulgar expressions, obscene
mat, vulgar bodily terms, and strong direct insults when the false-positive
surface can be bounded.

It is not a broad toxicity, slur, hate-speech, harassment, political insult, or
contextual moderation classifier. Identity-based slurs, hate-speech policy,
political insults, broad abuse scoring, and context-only offensive language
should remain out of scope unless a separate policy, profile, or package is
explicitly accepted later.

New candidate families require extra review when they have short roots,
transliteration collisions, neutral-word overlaps, common name or brand
collisions, toponym collisions, or context-dependent offensiveness.

## Coverage Dimensions

| Dimension            | Meaning                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- |
| Cyrillic             | Reviewed Cyrillic roots, inflections, prefixes, or phrase forms.                   |
| Transliteration      | Reviewed Latin spellings and homoglyph-safe folded forms.                          |
| Split / separator    | Reviewed separator, digit, zero-width, or split-letter forms.                      |
| Loose / obfuscation  | Loose matching for repeated letters, mixed symbols, or package-owned bypass forms. |
| Metadata             | Rule id, category, and severity are available on dictionary-backed matches.        |
| False-positive locks | Nearby tests protect neutral words, names, products, places, or other collisions.  |

## Covered Families

| Family                                             | Main rule ids                                                                                                                        | Category / severity                                                | Cyrillic | Transliteration                | Split / separator                                                          | Loose / obfuscation                                   | Metadata | False-positive locks | Notes                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------- | ------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------- | -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `бля` / `бляд` / `блеа` / `блеать`                 | `ru.obscene.blya`, `ru.obscene.blyad.family`, `ru.obscene.blea`, `ru.obscene.bleat.family`                                           | `OBSCENE_MAT` / high or medium                                     | Covered  | Covered for reviewed spellings | Covered for reviewed digit/split forms                                     | Covered for selected loose forms                      | Covered  | Covered              | Core obscene family with reviewed aliases; short aliases use medium severity.                                         |
| `еб` family                                        | `ru.obscene.eb.*`, `ru.insult.eb.*`                                                                                                  | `OBSCENE_MAT` or `STRONG_INSULT` / high                            | Covered  | Covered for reviewed spellings | Covered for reviewed digit/split and token-loose forms                     | Covered for selected phrase, prefix, and symbol forms | Covered  | Covered              | Includes reviewed verbs, prefixes, insults, and mother phrase coverage.                                               |
| `пизд` family                                      | `ru.obscene.pizda.*`, `ru.vulgar.pizdec.*`                                                                                           | `OBSCENE_MAT` or `VULGAR` / high or medium                         | Covered  | Covered for reviewed spellings | Covered for reviewed digit/split forms                                     | Covered for selected loose and symbol forms           | Covered  | Covered              | Includes core noun, related vulgar expression, and reviewed derivations.                                              |
| `хуй` family                                       | `ru.obscene.huy.*`, `ru.vulgar.huy*`, `ru.insult.huyesos.*`                                                                          | `OBSCENE_MAT`, `VULGAR`, or `STRONG_INSULT` / high, medium, or low | Covered  | Covered for reviewed spellings | Covered for reviewed digit/split forms                                     | Covered for selected loose and stretched forms        | Covered  | Covered              | Includes core obscene root, vulgar derivatives, low-severity `хули` / `хуйня` loose forms, and reviewed insult forms. |
| `нахуй` / `нихуя` / `пох` adjacent forms           | `ru.vulgar.nahuy.*`, `ru.vulgar.nihuy.family`, `ru.vulgar.poh`, `ru.vulgar.ni.huya.spaced.loose`                                     | `VULGAR` / medium or low                                           | Covered  | Limited                        | Covered for reviewed split forms                                           | Covered for selected token-loose forms                | Covered  | Covered              | Kept narrow to avoid broad substring behavior; standalone `пох` is low severity.                                      |
| `пидор` family                                     | `ru.insult.pidor.*`                                                                                                                  | `STRONG_INSULT` / high                                             | Covered  | Covered for reviewed spellings | Covered for reviewed Cyrillic, digit, and inflected split forms            | Covered for selected loose forms                      | Covered  | Covered              | Includes Ukrainian overlap locks and other neutral-context guards.                                                    |
| `мудак` / `муд` insult family                      | `ru.insult.mudak.family`, `ru.insult.mudila.family`, `ru.insult.mudozvon.family`, `ru.insult.muden.family`, `ru.insult.mud.translit` | `STRONG_INSULT` / medium                                           | Covered  | Covered for reviewed spellings | Limited                                                                    | Limited                                               | Covered  | Covered              | Covers reviewed insult forms, not every `муд...` word.                                                                |
| `мандовош`                                         | `ru.insult.mandavosh.family`                                                                                                         | `STRONG_INSULT` / high                                             | Covered  | Missing                        | Covered through the loose view                                             | Covered through the loose view                        | Covered  | Covered              | Related wider `манда` forms are partial or missing pending review.                                                    |
| `сука` / `сучка`                                   | `ru.insult.suka.family`, `ru.insult.suchka.family`, `ru.insult.suka.translit`, `ru.insult.suka.token.loose`                          | `STRONG_INSULT` / high                                             | Covered  | Covered for reviewed spellings | Limited                                                                    | Covered for reviewed token-loose forms                | Covered  | Covered              | Latin proper-name and neutral-token collisions are locked.                                                            |
| `гандон`                                           | `ru.insult.gandon.*`                                                                                                                 | `STRONG_INSULT` / high                                             | Covered  | Covered for reviewed spellings | Covered                                                                    | Limited                                               | Covered  | Covered              | Narrow family coverage with reviewed split behavior.                                                                  |
| `шлюха` / `шлюшка` / `шалава`                      | `ru.insult.shlyuha.*`, `ru.insult.shlyushka.family`, `ru.insult.shalava.*`                                                           | `STRONG_INSULT` / high                                             | Covered  | Covered for reviewed spellings | Covered for reviewed split forms                                           | Limited                                               | Covered  | Covered              | High-risk insult family with guarded transliteration.                                                                 |
| `чмо` / `чмошник` / `чмыр`                         | `ru.insult.chmo.*`, `ru.insult.chmoshnik.family`, `ru.insult.chmyr.family`                                                           | `STRONG_INSULT` / medium                                           | Covered  | Covered for reviewed spellings | Covered for reviewed split forms                                           | Limited                                               | Covered  | Covered              | Neutral split contexts are guarded.                                                                                   |
| `хер` / `охер` / `похер`                           | `ru.vulgar.her.*`, `ru.vulgar.oheret.*`                                                                                              | `VULGAR` / medium                                                  | Covered  | Covered for reviewed spellings | Covered for reviewed split forms                                           | Limited                                               | Covered  | Covered              | Includes reviewed prefixed and derivative forms with proper-name locks.                                               |
| `залупа`                                           | `ru.obscene.zalupa.*`                                                                                                                | `OBSCENE_MAT` / high                                               | Covered  | Covered for reviewed spellings | Covered                                                                    | Limited                                               | Covered  | Covered              | Obscene anatomical family with URL/name-like transliteration locks.                                                   |
| `говно`                                            | `ru.vulgar.govno.*`                                                                                                                  | `VULGAR` / medium                                                  | Covered  | Covered for reviewed spellings | Covered for reviewed noun, case, adjective, and transliterated split forms | Covered for selected loose forms                      | Covered  | Covered              | Covers reviewed scatological noun, case, adjective, and transliterated forms.                                         |
| `дерьмо`                                           | `ru.vulgar.dermo.family`                                                                                                             | `VULGAR` / medium                                                  | Covered  | Missing                        | Covered through the loose view                                             | Covered through the loose view                        | Covered  | Covered              | Cyrillic-only coverage; Latin `dermo`-like tokens are left unchanged by false-positive locks.                         |
| `срать` / `сран` / `сру` / `обосрать` / `засранец` | `ru.vulgar.srat.*`, `ru.vulgar.sran.*`, `ru.vulgar.sru.family`, `ru.vulgar.obosrat.*`, `ru.insult.zasranec.*`                        | `VULGAR` or `STRONG_INSULT` / medium                               | Covered  | Covered for reviewed spellings | Covered for reviewed split forms                                           | Limited                                               | Covered  | Covered              | Includes vulgar scatology and strong insult derivatives.                                                              |

## Partial Or Missing Families For Review

These families are visible gaps or partial areas. They should remain unchanged
until a dedicated issue adds reviewed rules and false-positive locks.

| Family                                                       | Current status     | Reason to review before adding                                                                  |
| ------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------- |
| `ёпт` / `епт` / `ёпта` / `епта` / `ептваю`                   | Missing or partial | Short expletive-like forms need explicit taxonomy and neutral collision review.                 |
| Wider `жопа` forms such as `жопа`, `жопу`, `жопой`, `жопный` | Missing            | Vulgar bodily terms are in scope, but need positive tests and neutral-word locks.               |
| Wider `манда` forms such as `манда`, `манду`, `мандой`       | Partial            | Nearby `мандовош` is covered; broader anatomical forms need separate reviewed coverage.         |
| `хуйло` / `хуило` / `хуила`                                  | Missing            | Current `хуй` rules do not own these whole-token forms; they need explicit reviewed coverage.   |
| `дрочить` / `дрочу` / `дрочер` / `дрочила`                   | Missing            | Sexual vulgarity with neutral Russian and Latin collision risk.                                 |
| Narrow `соси` / `отсоси` / `сосать`                          | Missing            | Very high false-positive risk around words such as `сосна`, `насос`, `сосед`, `SOS`, and names. |

## Intentionally Unsupported By Default

| Area                                               | Status                 | Rationale                                                                                            |
| -------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Broad toxicity and harassment scoring              | Unsupported            | Requires contextual policy decisions beyond profanity matching.                                      |
| Identity-based slurs and hate speech               | Unsupported            | Should be handled by a separate policy, profile, or package if accepted later.                       |
| Broad political insults                            | Unsupported            | Many are context-dependent and outside profanity package scope.                                      |
| Offensive words that are only offensive in context | Unsupported by default | A token matcher cannot reliably judge speaker intent, target, or context.                            |
| Broad short-root matching                          | Unsupported by default | Short roots create unacceptable false-positive risk unless each form is reviewed narrowly.           |
| Unreviewed transliteration variants                | Unsupported by default | Latin spellings can collide with names, brands, places, technical tokens, and ordinary English text. |

## Maintenance Checklist

Use this checklist before adding a new Russian family:

1. Decide whether the family is profanity, vulgarity, obscene mat, vulgar bodily
   language, or a strong direct insult.
2. Reject or defer broad toxicity, slur, hate-speech, political insult, and
   context-only moderation requests unless a separate policy has accepted them.
3. Assign the weakest accurate category and severity.
4. Add stable semantic rule ids and explicit order entries.
5. Keep rules in the Russian dictionary/profile, not generic matcher modules.
6. Prefer narrow family rules over broad post-match exceptions.
7. Add representative positive Cyrillic tests before adding transliteration.
8. Add split, loose, homoglyph, or transliteration coverage only when reviewed
   and false-positive-safe.
9. Add false-positive locks for neutral words, names, brands, places, URLs,
   usernames, and transliteration collisions.
10. Verify `analyze()` metadata and UTF-16 source ranges.
11. Run the package check before opening a pull request.
