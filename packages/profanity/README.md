# @textfilters/profanity

Dictionary-independent profanity filtering for TypeScript. The runtime accepts
plain structural dictionaries and does not include language data.

## Installation

Configure the `@textfilters` GitHub Packages scope, then install the runtime and
the language packages your application needs:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

```sh
npm install @textfilters/profanity @textfilters/profanity-ru
npm install @textfilters/profanity @textfilters/profanity-ru @textfilters/profanity-en
```

## Create and Reuse a Filter

```ts
import { createProfanityFilter } from "@textfilters/profanity";
import english from "@textfilters/profanity-en";
import russian from "@textfilters/profanity-ru";

const profanity = createProfanityFilter(russian, english);

profanity.check("message text");
profanity.find("message text");
profanity.censor("message text");
profanity.process("message text");
```

Create the filter once and reuse it. Construction snapshots the selected
dictionaries and builds the matcher indexes once.

Every filter exposes the shared `TextFilter` methods:

- `check(text)` returns whether an accepted match exists and can stop early.
- `find(text)` returns source-ordered matches with UTF-16 ranges into the
  original input.
- `censor(text, mask?)` masks accepted ranges while preserving the input's
  UTF-16 length.
- `process(text, mask?)` returns `{ censored, matches }`.

Profanity matches include the selected dictionary id and source term in
`match.data`.

## Matching Behavior

The runtime normalizes each input once with Unicode NFKC, lowercase mapping,
zero-width removal, and UTF-16 source tracking. Each selected dictionary then
applies only its own aliases.

Deny entries must contain only Unicode letters or numbers, with single ordinary
spaces between words. They use one compact trie, so bounded non-whitespace
separators may appear between matched characters in input. Whitespace is
accepted only at a word boundary written in the dictionary entry or when every
part of the complete candidate contains one letter or number. Repeated
character runs must contain at least the count written in the dictionary entry.
Matches keep word boundaries and select the leftmost longest entry.

Allow entries are exact and conservative. They preserve punctuation, collapse
only repeated whitespace, and suppress a deny match only when one concrete
allow range fully covers it.

## Combine with Other Filters

```ts
import { combineFilters } from "@textfilters/core";
import { createEmailFilter } from "@textfilters/email";
import { createProfanityFilter } from "@textfilters/profanity";
import russian from "@textfilters/profanity-ru";
import { createUrlFilter } from "@textfilters/url";

const filter = combineFilters(
  createUrlFilter(),
  createEmailFilter(),
  createProfanityFilter(russian),
);

const result = filter.process("message text");
```

The combined filter runs every child against the same original input, combines
their UTF-16 ranges, and applies one masking pass.

## Custom Dictionaries

Pass any object with the structural dictionary contract:

```ts
const custom = createProfanityFilter({
  id: "application",
  deny: ["blocked word", "blocked phrase"],
  allow: ["reviewed safe phrase"],
  aliases: [["0", "o"]],
});
```

`deny` and `allow` contain plain literals, not regular expressions.
Aliases are isolated to the dictionary that declares them. An allow entry
suppresses only deny ranges fully covered by that concrete source occurrence.

## Edit and Build Maintained Dictionaries

Maintained sources live in
[`../profanity-ru/data`](../profanity-ru/data) and
[`../profanity-en/data`](../profanity-en/data):

- add one complete word or phrase per line under `deny/` or `allow/`;
- keep family files as the versioned source of truth;
- write aliases as `source=target` pairs in `aliases.txt`;
- use `#` for source comments.

Build both language packages from the repository root:

```sh
npm run build:profanity-dictionaries
```

The root builder sorts inputs deterministically, rejects exact source
duplicates, and generates only `dist/index.js` and `dist/index.d.ts` in each
language package. The runtime owns normalization and normalized conflict
validation.

## License

MIT
