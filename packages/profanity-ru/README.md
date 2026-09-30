# @textfilters/profanity-ru

Plain Russian dictionary data for `@textfilters/profanity`.

## Installation

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires
authentication for npm installs, including public packages.

```sh
npm install @textfilters/profanity @textfilters/profanity-ru
```

## Usage

```ts
import { createProfanityFilter } from "@textfilters/profanity";
import russian from "@textfilters/profanity-ru";

const profanity = createProfanityFilter(russian);
profanity.censor("message text");
```

The package exports one structural data object with `id`, `deny`, `allow`, and
`aliases`. It contains no matching logic and has no runtime dependencies.

Dictionary sources live in `data/deny`, `data/allow`, and `data/aliases.txt`.
Each text file contains one complete word or phrase per line. The repository
builder validates source formatting and combines family files deterministically
into the ESM module under `dist`. Runtime normalization stays in
`@textfilters/profanity`.

Reviewed inflections and compounds are maintained as complete deny terms in
their family files. The dictionary covers the listed word forms; it does not
infer arbitrary suffixes or compounds from short roots. Neutral words and
identity terms remain outside these insult families. Regression tests exercise
the built dictionary through the public runtime and filter composition.

## License

MIT
