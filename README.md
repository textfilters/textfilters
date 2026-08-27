# Textfilters

Composable TypeScript text filtering and content moderation packages developed
in one monorepo and released independently.

## Packages

| Package                     | Workspace                                        | Purpose                                                                          |
| --------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `@textfilters/core`         | [`packages/core`](packages/core)                 | Shared contracts, normalization, range masking, and pipeline utilities.          |
| `@textfilters/url`          | [`packages/url`](packages/url)                   | URL detection, obfuscated links, defanged domains, and safe link censoring.      |
| `@textfilters/email`        | [`packages/email`](packages/email)               | Email detection, obfuscated forms, contact redaction, and false-positive guards. |
| `@textfilters/phone`        | [`packages/phone`](packages/phone)               | Phone number detection, contact redaction, and numeric false-positive guards.    |
| `@textfilters/profanity`    | [`packages/profanity`](packages/profanity)       | Dictionary-independent profanity matching, source ranges, and masking.           |
| `@textfilters/profanity-ru` | [`packages/profanity-ru`](packages/profanity-ru) | Maintained Russian deny, allow, and alias data.                                  |
| `@textfilters/profanity-en` | [`packages/profanity-en`](packages/profanity-en) | Maintained English deny, allow, and alias data.                                  |
| `@textfilters/spam`         | [`packages/spam`](packages/spam)                 | Stateful interval, duplicate, burst, and actor-based anti-spam checks.           |

Runtime workspaces own their implementation, tests, package README, public API
examples, and independently versioned changelog. Language data workspaces own
their versioned dictionary sources, generated module, smoke test, and package
README. The repository root owns shared development, CI, release automation,
compatibility policy, and benchmarks.

## Requirements

- Node.js 24 or newer
- npm 11
- GitHub Packages authentication for installing published packages

Configure the package scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install only the packages needed by an application:

```sh
npm install @textfilters/core @textfilters/url
npm install @textfilters/core @textfilters/email
npm install @textfilters/core @textfilters/phone
npm install @textfilters/profanity @textfilters/profanity-ru
npm install @textfilters/profanity @textfilters/profanity-ru @textfilters/profanity-en
npm install @textfilters/core @textfilters/spam
```

## Monorepo Development

Install dependencies once from the repository root:

```sh
npm ci
npm run check
```

The root workspace list is explicit and begins with `packages/core`. npm runs
workspace scripts in that order, so shared contracts build before dependent
packages.

Run focused commands with npm workspace selection:

```sh
npm run test --workspace @textfilters/url
npm run check --workspace @textfilters/profanity
npm run build --workspace @textfilters/core
```

## Usage

```ts
import { combineFilters } from "@textfilters/core";
import { createEmailFilter } from "@textfilters/email";
import { createPhoneFilter } from "@textfilters/phone";
import { createProfanityFilter } from "@textfilters/profanity";
import russian from "@textfilters/profanity-ru";
import { createUrlFilter } from "@textfilters/url";

const filter = combineFilters(
  createUrlFilter(),
  createEmailFilter(),
  createPhoneFilter(),
  createProfanityFilter(russian),
);

const safeText = filter.censor(
  "Contact user@example.com or visit https://example.com",
);
```

```ts
import { createSpamFilter } from "@textfilters/spam";

const spam = createSpamFilter({
  minIntervalMs: 700,
  duplicateWindowMs: 12_000,
  burstWindowMs: 10_000,
  burstMaxMessages: 6,
});

const decision = spam.check({
  actorKey: "user:123",
  text: "hello",
});
```

See each [package workspace](#packages) for its complete public API and
behavioral contract.

## Independent Releases

Release Please runs in manifest mode with the `node-workspace` plugin. Package
versions remain independent and are not kept in lockstep.

Normal Conventional Commit changes on `main` update one aggregated release pull
request. They do not publish immediately. When maintainers explicitly merge
that release pull request, Release Please creates only the affected releases
and tags:

```text
core-v0.4.1
url-v0.3.1
email-v0.3.2
```

The publish job accepts only released paths from the eight-package allowlist and
publishes selected workspaces sequentially, beginning with
`@textfilters/core`.

See [the release process](docs/release-process.md), [ecosystem policy](docs/ecosystem-policy.md),
and [package layout](docs/package-layout.md).

## Support and Security

Use repository issue forms for package bugs and feature requests. Select the
affected package in the form.

For security reports, follow [the security policy](.github/SECURITY.md).

## License

MIT
