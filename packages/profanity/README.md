# `@textfilters/profanity`

Dictionary-independent profanity filtering with source UTF-16 matches,
obfuscation handling, exact allow rules, and match metadata.

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
const result = profanity.process("source text", "#");
```

Multiple dictionaries can be combined in one filter:

```ts
import english from "@textfilters/profanity-en";

const multilingual = createProfanityFilter(russian, english);
```

Dictionaries provide an `id`, normalized deny terms, exact allow terms, and
optional aliases. The runtime compiles reusable indexes at construction and
preserves leftmost-longest matching, source ranges, dictionary identity, and
match metadata.

Public methods accept strings only. Custom masks are supplied to `censor()` or
`process()`. Application-specific policy belongs outside the runtime.

See [the release process](https://github.com/textfilters/textfilters/blob/main/packages/profanity/docs/release-process.md) for package release details.
