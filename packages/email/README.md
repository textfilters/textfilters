# `@textfilters/email`

Stateless direct and obfuscated email filtering with source UTF-16 matches.

## Installation

```sh
npm install @textfilters/email
```

## Usage

```ts
import { filter as email } from "@textfilters/email";

const result = email.process("Contact user@example.com", "#");
```

## Configuration

```ts
import { createEmailFilter } from "@textfilters/email";

const email = createEmailFilter({
  matchObfuscated: true,
  allowedEmails: ["support@example.com"],
  allowedUsernames: ["postmaster"],
  allowedDomains: ["internal.example"],
});
```

| Option             | Meaning                                    |
| ------------------ | ------------------------------------------ |
| `matchObfuscated`  | Detect supported textual `at`/`dot` forms  |
| `allowedEmails`    | Full addresses left unmasked               |
| `allowedUsernames` | Local parts left unmasked                  |
| `allowedDomains`   | Domains and their subdomains left unmasked |

The package detects direct addresses and supported obfuscated forms. It does
not verify mailbox existence or accept single-label domains. Public methods
accept strings only, and custom masks are supplied to `censor()` or `process()`.

See [architecture](https://github.com/textfilters/textfilters/blob/main/packages/email/docs/architecture.md) for internal matching ownership and
[the release process](https://github.com/textfilters/textfilters/blob/main/packages/email/docs/release-process.md) for release details.
