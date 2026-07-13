# Reviewed English Profanity Language Pack

This directory contains a real, opt-in English dictionary for the reviewed
audit vocabulary. It is deliberately non-published: the package is marked
`private`, has no release workflow, and remains an in-repository example until
an English-language maintainer or maintenance group is named.

The pack covers only `fuck`, `fucking`, `fucked`, `shit`, `dick`,
`motherfucker` (including detection before a possessive suffix), `cock`,
`bitch`, and `bastard`. It does not attempt broad toxicity, hate-speech, slur,
or contextual moderation.

## Opt-in API

The example exports a validated dictionary and an isolated filter:

```ts
import {
  englishProfanityDictionary,
  englishProfanityFilter,
} from "./src/index.js";

englishProfanityFilter.check("reviewed English text");
englishProfanityFilter.analyze("reviewed English text");
```

Importing the main `@textfilters/profanity` package does not enable these
rules. The built-in shared filter remains Russian-only.

## Policy boundaries

- Every maintained rule is strict-only and requires a complete word token.
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
- Publication requires the ownership and release criteria in
  [the external language pack policy](../../docs/external-language-pack-policy.md).
