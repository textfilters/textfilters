# Changelog

## 0.1.0 (2026-06-04)

Initial release of `@textfilters/url`.

- URL and obfuscated-link censor with a small `filter` export and configurable `createUrlFilter(...)` factory.
- Bare domain filtering with configured TLDs.
- Explicit-scheme authority support for localhost, ports, IPv6, userinfo, IDN/emoji hosts, and unknown TLDs.
- Defanged dot, `hxxp`, and split-scheme handling.
- Length-preserving masking for JavaScript strings.
- Architecture documentation and GitHub Packages release flow.
