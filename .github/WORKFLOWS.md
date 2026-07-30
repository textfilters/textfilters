# Repository Workflows

## Check

The root check workflow installs the monorepo once and runs:

```sh
npm ci
npm run check
```

Workspaces are listed explicitly in root `package.json`, beginning with
`packages/core`, so package checks run in dependency order.

## Release Please

Release Please runs in manifest mode after pushes to `main`. It keeps one
aggregated release pull request updated while releasable Conventional Commits
accumulate.

Merging ordinary pull requests does not publish packages. Merging the
aggregated release pull request creates independent GitHub Releases and tags
such as `core-v0.4.1` and `email-v0.3.2`.

The publish job reads only the paths released by Release Please, rejects paths
outside the six-package allowlist, and publishes selected workspaces in a fixed
order beginning with `@textfilters/core`.

See [the release process](../docs/release-process.md) for the complete contract.
