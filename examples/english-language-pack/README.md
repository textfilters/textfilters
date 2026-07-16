# Reviewed English Profanity Language Pack

The package-owned implementation of this reviewed, opt-in English dictionary
lives in `src/languages/en` and is included in the published distribution. This
private example re-exports that implementation so repository examples exercise
the same code as package consumers.

The pack covers only `fuck`, `fucking`, `fucked`, `shit`, `dick`,
`motherfucker` (including detection before a possessive suffix), `cock`,
`bitch`, `whore`, `nigga`, `suck`, `fag`, `faggot`, and `bastard`. It does not
attempt broad toxicity, comprehensive hate-speech or slur detection, or
contextual moderation.

## Opt-in API

The public package exports a validated dictionary, a shared read-only filter,
and a factory for isolated mutable filters:

```ts
import {
  createEnglishProfanityFilter,
  englishProfanityDictionary,
  englishProfanityFilter,
} from "@textfilters/profanity";

englishProfanityFilter.check("reviewed English text");
englishProfanityFilter.analyze("reviewed English text");

const mutableEnglishFilter = createEnglishProfanityFilter();
mutableEnglishFilter.addStrict("tenant-only-term");
```

Importing the main package does not enable these rules on the default `filter`.
The built-in shared default remains Russian-only, and the English filter is
initialized only when its methods are first called.

## Policy boundaries

- The explicitly reviewed `fuck`, `shit`, `bitch`, `whore`, `nigga`, `suck`,
  `fag`, and `faggot` rules accept separator-obfuscated loose forms while still
  requiring complete token boundaries. Other maintained rules remain
  strict-only.
- Matching is case-insensitive and accepts punctuation around a token.
- Substrings inside longer words and names are excluded by strict token
  boundaries. Exact maintained tokens are also ignored when they form an
  unquoted dot-atom email local part (including plus-address tags), a label in a
  multi-label domain, or an `@`-prefixed username. These context checks use the
  same fullwidth-ASCII normalization as matching.
- Context exclusions apply only to maintained pack rule ids. Runtime literals
  added or installed through `addStrict`, `addLoose`, `setStrict`, or `setLoose`
  retain the normal runtime matching contract.
- The possessive suffix in `motherfucker's` is not part of the reported range;
  only the maintained profanity token is censored.
- A separately published language package requires the ownership and release
  criteria in
  [the external language pack policy](../../docs/external-language-pack-policy.md).
