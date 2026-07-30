# @textfilters/email

TypeScript email detection and obfuscated email filtering for content
moderation, chat moderation, UGC moderation, censoring, contact redaction, and
PII redaction workflows.

Use `@textfilters/email` to detect direct email addresses, obfuscated email
forms, excluded domains, and guarded false positives inside a composable
TypeScript text filtering library.

## Installation

Add the GitHub Packages registry for the `@textfilters` scope in a project `.npmrc` or user npm config:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires authentication for npm installs, including public packages.

```sh
npm install @textfilters/core @textfilters/email
```

## Use Cases

- Redact email addresses from user-generated text before display or indexing.
- Detect obfuscated email forms in chat moderation and UGC moderation pipelines.
- Apply contact redaction while preserving configured support addresses or
  trusted domains.
- Combine email filtering with URL, phone, profanity, and spam checks.

## Usage

```ts
import { createEmailFilter } from "@textfilters/email";

const emailFilter = createEmailFilter({ maskChar: "#" });
const safeText = emailFilter.censor("contact user@example.com");
```

```ts
import { createEmailFilter } from "@textfilters/email";

const emailOnlyFilter = createEmailFilter({ matchObfuscated: false });
const safeText = emailOnlyFilter.censor("contact user@example.com");
```

```ts
import { createEmailFilter } from "@textfilters/email";

const emailFilter = createEmailFilter({
  excludeDomains: ["example.com"],
  excludeUsernames: ["support"],
});
```

```ts
import { filter } from "@textfilters/email";

const safeText = filter.censor("contact user [at] example [dot] com");
```

```ts
import { createTextPipeline } from "@textfilters/core";
import { filter as emailFilter } from "@textfilters/email";

const pipeline = createTextPipeline().use(emailFilter);
const result = pipeline.censor("contact user@example.com");
```

```ts
import { createEmailScanner } from "@textfilters/email";

const scanner = createEmailScanner();
const codePoints = Array.from("contact user@example.com");
const result = scanner.scan({ text: "contact user@example.com", codePoints });
const hasEmail = scanner.check({
  text: "contact user@example.com",
  codePoints,
});

scanner.scan({ text: "contact user@example.com", codePoints }, (match) => {
  console.log(match.range);
  return false;
});
```

The default shared instance is exported as `filter`. It has stable `name: "email"`.

## Behavior

The package detects direct email addresses such as `user@example.com`, tagged local parts, mixed-case input, subdomains, and common fullwidth symbol variants after NFKC normalization.

It also detects common obfuscated forms such as `user [at] example [dot] com`, `user(at)example(dot)com`, `user at example dot com`, and `user [@] example [.] com`.

Set `matchObfuscated: false` to keep only direct `user@example.com` matching.

Configured exclusions can leave selected full email addresses, local-part usernames, or domains unmasked. Domain exclusions match the exact domain and its subdomains after normalization.

`censor()` preserves JavaScript string length for matched spans where practical and is idempotent. Masking is applied over code points so surrogate pairs are not split.

False-positive guards avoid package scopes, social handles, prose-only `at` and `dot` words, version-like text, IP addresses, incomplete domains, and single-label domains by default.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the scanner flow, module map,
and change guide.

Run `npm run benchmark:email` from this package to compare scanner setup,
`check()`, clean, no-dot `@` text, direct, obfuscated, and late-match email
censoring cases on the same machine.

## Related Textfilters Packages

- `@textfilters/core` for shared pipeline, normalization, and range masking
  primitives.
- `@textfilters/url` for URL detection, obfuscated links, and safe link
  censoring.
- `@textfilters/phone` for phone number detection and contact redaction.
- `@textfilters/profanity` for Russian profanity filtering and taxonomy-backed
  moderation.
- `@textfilters/spam` for actor-based anti-spam guard checks.

## Release

Releases are managed by Release Please from Conventional Commit history on `main`. When a Release Please release is created, the workflow runs `npm run check` and publishes the package to GitHub Packages. Release tags keep the `v*` pattern.

The package is prepared for publication to GitHub Packages, not the public npm registry.

## License

MIT
