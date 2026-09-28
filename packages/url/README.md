# `@textfilters/url`

Stateless URL and obfuscated-domain filtering with source UTF-16 matches.

## Installation

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires
authentication for npm installs, including public packages.

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

| Option           | Meaning                                               |
| ---------------- | ----------------------------------------------------- |
| `tlds`           | Snapshot of accepted top-level domains                |
| `allowedDomains` | Exact hosts left unmasked; list subdomains separately |

The shared `filter` uses the built-in TLD set. The detector keeps conservative
handling for ambiguous `example. com` prose, while strong forms such as
`example. com/path`, `example[.]com`, and `example dot com` remain detectable.
It does not validate network reachability.

A closing bracket or quote next to a sentence dot, with whitespace after the
dot, ends the host before allowlist matching. For example, `word). Bot` stays
unchanged, and `docs .) example.com/path` matches only `example.com/path`.
An allowed `docs.example.com` cannot suppress that separate match. Path-like
text after the boundary does not rejoin the host: `example). com/path` stays
unchanged. Forms without that boundary, such as `example).com/path` and
`example [.] com/path`, remain detectable.

Public methods accept strings only. Matches use UTF-16 offsets into the source
text, and custom masks are supplied to `censor()` or `process()`.

See [architecture](docs/architecture.md) for internal matching ownership and
[the release process](docs/release-process.md) for release details.
