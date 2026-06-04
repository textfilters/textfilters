# @textfilters/url

URL and obfuscated-link filtering for composable text moderation.

## Installation

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires authentication for npm installs, including public packages.

```sh
npm install @textfilters/core @textfilters/url
```

## Usage

```ts
import { filter } from "@textfilters/url";

const safeText = filter.censor("visit example.com");
```

```ts
import { createUrlFilter } from "@textfilters/url";

const urlFilter = createUrlFilter({ tlds: ["com", "org"], maskChar: "#" });
const safeText = urlFilter.censor("visit example[.]com");
```

The default shared instance is exported as `filter`. It has stable `name: "url"`. The package also exports `urlFilter()` as an alias for `createUrlFilter()`.

## Behavior

The package preserves the existing URL filtering behavior and adds stricter explicit-scheme URL handling for common authority forms such as localhost, ports, IPv6, userinfo, and explicit-scheme unknown TLDs.

Bare domains still require the configured TLD list. For example, `example.unknown/path` is left unchanged by the default filter, while `https://example.unknown/path` is masked because it has an explicit scheme.

The filter masks:

- known-TLD bare domains such as `example.com`, `t.me/example`, and `discord.gg/example`;
- defanged dot forms such as `example[.]com`, `example dot com`, and `example точка com`;
- `http`, `https`, and `hxxp` scheme forms, including split-letter obfuscation;
- explicit-scheme hosts with ports, IPv6 literals, userinfo, IDN/emoji hosts, and unknown TLDs;
- glued prose around explicit authorities while keeping trailing punctuation outside the masked range.

`censor()` preserves the original JavaScript string length and is idempotent.

## Architecture

The parser is split into focused modules for metadata, schemes, defanged dots, domains, explicit authorities, paths, and range collection. See [docs/architecture.md](docs/architecture.md).

## Release

Releases are managed by release-please. When a release is created from `main`, the workflow runs `npm run check` and publishes the package to GitHub Packages.

The package is prepared for publication to GitHub Packages, not the public npm registry.

## License

MIT
