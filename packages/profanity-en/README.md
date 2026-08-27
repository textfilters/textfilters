# @textfilters/profanity-en

Plain English dictionary data for `@textfilters/profanity`.

## Installation

```sh
npm install @textfilters/profanity @textfilters/profanity-en
```

## Usage

```ts
import { createProfanityFilter } from "@textfilters/profanity";
import english from "@textfilters/profanity-en";

const profanity = createProfanityFilter(english);
profanity.censor("message text");
```

The package exports one structural data object with `id`, `deny`, `allow`, and
`aliases`. It contains no matching logic and has no runtime dependencies.

Dictionary sources live in `data/deny`, `data/allow`, and `data/aliases.txt`.
Each text file contains one complete word or phrase per line. The repository
builder validates source formatting and combines family files deterministically
into the ESM module under `dist`. Runtime normalization stays in
`@textfilters/profanity`.

## License

MIT
