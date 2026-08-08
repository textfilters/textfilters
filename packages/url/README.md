# @textfilters/url

TypeScript URL detection and obfuscated link filtering for content moderation,
chat moderation, UGC moderation, censoring, and redaction workflows.

Use `@textfilters/url` to find and safely censor URLs, defanged domains, hxxp
links, obfuscated links, and known-TLD domains inside user-generated text while
keeping the package composable with other Textfilters filters.

## Installation

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires authentication for npm installs, including public packages.

```sh
npm install @textfilters/core @textfilters/url
```

## Use Cases

- Detect links in chat moderation and UGC moderation pipelines.
- Redact direct URLs, defanged links, hxxp links, and obfuscated domains.
- Add URL filtering to a broader TypeScript text filtering library.
- Keep package-specific link detection separate from profanity, email, phone,
  and spam checks.

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

Use `allowedDomains` when an application has already loaded a trusted domain
snapshot from configuration or an external service:

```ts
import { createUrlFilter } from "@textfilters/url";

const response = await fetch("https://config.example/url-allowlist");
const { domains } = (await response.json()) as { domains: string[] };
const urlFilter = createUrlFilter({ allowedDomains: domains });

const safeText = urlFilter.censor(
  "trusted.com stays visible while example.org is masked",
);
```

Allowed domains use case-insensitive exact-host matching. `trusted.com` does
not allow `www.trusted.com`, `nottrusted.com`, or `trusted.com.evil.test`.
Schemes, userinfo, ports, paths, queries, and recognized defanged dots do not
change the hostname decision. For the ambiguous literal-dot-plus-whitespace
form, a single leading label is treated as a defanged subdomain, while a
multi-label prefix is treated as sentence text and the selected suffix is
checked independently. Cross-script lookalikes remain distinct. Unicode and
punycode spellings must be listed separately.

The package does not fetch or cache external configuration. Build a new filter
or scanner from each validated snapshot and replace the active instance
atomically. If refresh fails, keep the previous valid instance or use an empty
allowlist for fail-closed behavior.

The default shared instance is exported as `filter` with `name: "url"`. The
package also exports `urlFilter()` as an alias for `createUrlFilter()`.

For scanner-oriented integrations, `createUrlScanner()` returns code point
ranges that can be passed through core range masking or a shared range scanner
pipeline:

```ts
import { createUrlScanner } from "@textfilters/url";

const scanner = createUrlScanner();
const result = scanner.scan({
  text: "visit https://example.com",
  codePoints: Array.from("visit https://example.com"),
});

const hasUrl = scanner.check({
  text: "visit https://example.com",
  codePoints: Array.from("visit https://example.com"),
});

scanner.scan(
  {
    text: "visit https://example.com",
    codePoints: Array.from("visit https://example.com"),
  },
  (match) => {
    console.log(match.range);
    return false;
  },
);
```

## Behavior

The package preserves the existing URL filtering behavior and adds stricter explicit-scheme URL handling for common authority forms such as localhost, ports, IPv6, userinfo, and explicit-scheme unknown TLDs.

Bare domains require a recognized TLD. By default, the package embeds the
complete delegated IANA root-zone list in both ASCII and decoded IDN forms.
A non-empty custom `tlds` list replaces that default snapshot. For example,
`example.unknown/path` is left unchanged by the default filter, while
`https://example.unknown/path` is masked because it has an explicit scheme.

The filter masks:

- delegated-TLD bare domains such as `example.com`, `youtu.be/example`, and
  `example.travel`;
- Unicode-confusable TLD spellings that resolve to a delegated ASCII suffix;
- defanged dot forms such as `example[.]com`, `example dot com`, and `example точка com`;
- `http`, `https`, and `hxxp` scheme forms, including split-letter obfuscation;
- explicit-scheme hosts with ports, IPv6 literals, userinfo, IDN/emoji hosts, and unknown TLDs;
- glued prose around explicit authorities while keeping trailing punctuation outside the masked range.

A whitespace-wrapped U+2022 list bullet between two repeated standalone words is
treated as prose punctuation, including at sentence boundaries. A complete host
before unrelated text remains detectable after a whitespace-wrapped dot form or
a single-character dot followed by whitespace, as in `example.com • next`.
Different labels, unspaced or one-sided forms, and repeated labels that extend a
host or URL tail remain detectable and cannot broaden exact-host allowlists.

Configured `allowedDomains` are removed from filter and scanner results after
parsing. They do not add new TLD detection rules, and subdomains must be listed
explicitly. Visually similar cross-script spellings remain blocked. This
exact-host allowlist is the only default-domain exemption.

`censor()` preserves the original JavaScript string length and is idempotent.

## Architecture

The parser is split into focused modules for metadata, schemes, defanged dots,
domains, explicit authorities, paths, range collection, and scanner wrapping.
Clearly clean input skips URL parser work through a cheap prefilter. See
[docs/architecture.md](docs/architecture.md).

## Benchmarks

Build the package, then run URL benchmark coverage for scanner setup,
`check()`, clean text, direct URLs, bare domains, obfuscated URLs, and
allowlist hits and misses, and late-match cases:

```sh
npm run build
npm run benchmark:url
```

## Related Textfilters Packages

- `@textfilters/core` for shared pipeline, normalization, and range masking
  primitives.
- `@textfilters/email` for email detection and contact redaction.
- `@textfilters/phone` for phone number detection and contact redaction.
- `@textfilters/profanity` for Russian profanity filtering and taxonomy-backed
  moderation.
- `@textfilters/spam` for actor-based anti-spam guard checks.

## Release

Releases are managed by Release Please from Conventional Commit history on `main`. When a Release Please release is created, the workflow runs `npm run check` and publishes the package to GitHub Packages. Release tags keep the `v*` pattern.

The package is prepared for publication to GitHub Packages, not the public npm registry.

## License

MIT
