# Contributing

Thanks for helping improve Textfilters.

## Language

All repository artifacts must be written in English. This includes branches,
commit messages, pull requests, issues, labels, documentation, release notes,
generated files, and code comments.

## Development

Use Node.js 24+ and npm 11. Install all workspace dependencies from the
repository root:

```sh
npm ci
npm run check
```

The root check runs every package check in dependency order, beginning with
`@textfilters/core`. Use a workspace command for focused development:

```sh
npm run test --workspace @textfilters/url
npm run check --workspace @textfilters/email
```

Open an issue before large changes so maintainers can confirm scope and package
fit. Keep runtime changes inside the owning `packages/<name>` directory and
update its public documentation when the API changes.

## Pull Requests

Use English Conventional Commit titles:

```text
type(scope?): short summary
```

Maintainers use squash merge, and the pull request title becomes the squash
commit title. Pull requests are not self-merged; wait for maintainer review and
explicit merge approval.

## Releases

Release Please maintains one aggregated release pull request for independently
versioned packages. Normal changes may accumulate on `main` without publishing.
Packages are tagged, released, and published only when the aggregated release
pull request is merged.

Published package tags are immutable.
