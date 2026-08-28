# Email Architecture

The package exposes a shared `filter` and `createEmailFilter(options?)`. Direct
and obfuscated matching stay separate internally but feed one package-local
adapter.

## Flow

```text
source string
  -> normalization and tokenization
  -> direct and obfuscated candidate matchers
  -> validators, context rules, and allowlists
  -> internal code-point ranges
  -> package-local UTF-16 conversion
  -> TextMatch[] or one core masking pass
```

`check()` uses early stop. `find()` and `process()` collect matches once, while
`censor()` collects the ranges needed for masking. All methods reject non-string
input.

Options are copied and normalized when a filter is created. `allowedEmails`,
`allowedUsernames`, and `allowedDomains` retain the existing exclusion
semantics. Localhost and other single-label domains are not supported.

Tokenizer, context, direct-match, obfuscated-match, validation, and allowlist
modules remain internal because they represent distinct matching concerns. No
range-scanner contracts are exported.
