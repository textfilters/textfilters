# `@textfilters/url`

Stateless URL and obfuscated-domain filtering with source UTF-16 matches.

## Installation

```sh
npm install @textfilters/url
```

## Usage

```ts
import { filter as url } from "@textfilters/url";

const result = url.process("Visit https://example.com", "#");
```

## Configuration

```ts
import { createUrlFilter } from "@textfilters/url";

const url = createUrlFilter({
  tlds: ["com", "org"],
  allowedDomains: ["docs.example.com"],
});
```

| Option           | Meaning                                        |
| ---------------- | ---------------------------------------------- |
| `tlds`           | Snapshot of accepted top-level domains         |
| `allowedDomains` | Exact hosts and their subdomains left unmasked |

The shared `filter` uses the built-in TLD set. The detector keeps conservative
handling for ambiguous `example. com` prose, while strong forms such as
`example. com/path`, `example[.]com`, and `example dot com` remain detectable.
It does not validate network reachability.

Public methods accept strings only. Matches use UTF-16 offsets into the source
text, and custom masks are supplied to `censor()` or `process()`.

See [architecture](https://github.com/textfilters/textfilters/blob/main/packages/url/docs/architecture.md) for internal matching ownership and
[the release process](https://github.com/textfilters/textfilters/blob/main/packages/url/docs/release-process.md) for release details.
