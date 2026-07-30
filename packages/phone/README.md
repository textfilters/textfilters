# @textfilters/phone

TypeScript phone number detection and phone-like sequence filtering for content
moderation, chat moderation, UGC moderation, censoring, contact redaction, and
PII redaction workflows.

Use `@textfilters/phone` to detect phone numbers and phone-like numeric
sequences while keeping false-positive guards around dates, times, coordinates,
IP-like text, and balance-like numbers.

## Installation

Add the GitHub Packages registry for the `@textfilters` scope:

```ini
@textfilters:registry=https://npm.pkg.github.com
```

Install with GitHub npm authentication configured. GitHub Packages requires authentication for npm installs, including public packages.

```sh
npm install @textfilters/core @textfilters/phone
```

## Use Cases

- Redact phone numbers from chat messages, profiles, listings, and other UGC.
- Add contact redaction to a broader TypeScript text filtering library.
- Keep phone filtering separate from URL detection, email detection, profanity
  filtering, and spam checks.
- Apply false-positive guards for common numeric text that should stay visible.

## Usage

```ts
import { filter } from "@textfilters/phone";

const safeText = filter.censor("call +1 555 010 9999");
```

```ts
import { createPhoneFilter } from "@textfilters/phone";

const phoneFilter = createPhoneFilter({ maskChar: "#" });
const safeText = phoneFilter.censor("call 8 999 123 45 67");
```

```ts
import { createPhoneScanner } from "@textfilters/phone";

const scanner = createPhoneScanner();
const codePoints = Array.from("call +1 202 555 0187");
const result = scanner.scan({ text: "call +1 202 555 0187", codePoints });
const hasPhone = scanner.check({ text: "call +1 202 555 0187", codePoints });

scanner.scan({ text: "call +1 202 555 0187", codePoints }, (match) => {
  console.log(match.range);
  return false;
});
```

The default shared instance is exported as `filter`. It has stable `name: "phone"`.

## Behavior

The package detects phone-like numeric sequences across common RU and international formats, including Unicode digit forms that normalize to ASCII digits for matching.

False-positive guards keep date-like, time-like, coordinate-like,
IP/server-like, balance-like, and narrowly reviewed machine-metadata numeric
text outside the masked range. JSON metadata coverage is limited to exact
13-digit `serverTs` values and 13-digit `cursor` values with an optional `-0`
suffix. JSON whitespace before the value is handled without a fixed look-back
limit. Metadata keys remain case-sensitive and support standard JSON string
escapes. Exempt value prefixes must contain the exact ASCII source characters,
without ignored or normalized characters; a following group only preserves the
prefix when that suffix is independently recoverable as a phone. The signed
32-bit minimum sentinel follows the same exact-source rule. JSON metadata
exceptions require a complete, valid containing object; standalone key/value
fragments are not exempt. Enclosing-object validation is cached per scan so
a single structural index covers repeated, nested, incomplete, and malformed
metadata regions without candidate-by-candidate rescanning. Complete valid
objects inside malformed surrounding text remain independently eligible.

`censor()` preserves the original JavaScript string length and is idempotent.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the parser flow, module map,
and change guide.

Run `npm run benchmark:phone` from this package to compare scanner setup,
`check()`, clean, low-digit, direct phone, phone-like, and late-match cases on
the same machine.

## Related Textfilters Packages

- `@textfilters/core` for shared pipeline, normalization, and range masking
  primitives.
- `@textfilters/url` for URL detection, obfuscated links, and safe link
  censoring.
- `@textfilters/email` for email detection and contact redaction.
- `@textfilters/profanity` for Russian profanity filtering and taxonomy-backed
  moderation.
- `@textfilters/spam` for actor-based anti-spam guard checks.

## Release

Releases are managed by Release Please from Conventional Commit history on `main`. When a Release Please release is created, the workflow runs `npm run check` and publishes the package to GitHub Packages. Release tags keep the `v*` pattern.

The package is prepared for publication to GitHub Packages, not the public npm registry.

## License

MIT
