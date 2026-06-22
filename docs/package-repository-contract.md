# Package Repository Contract

This document records the shared repository contract for the published
Textfilters packages. The machine-readable source of truth is
[`package-contract.json`](../package-contract.json), and the lightweight audit
command is:

```sh
node scripts/check-package-contract.mjs
```

Run the command from this documentation repository with sibling package
repositories checked out next to it:

- `core`
- `url`
- `email`
- `phone`
- `profanity`
- `spam`

## Package Manifest Contract

Each package repository keeps its own source, tests, and package-specific
`smoke:dist` command. Shared manifest expectations are:

- ESM package metadata with `type: "module"`, `license: "MIT"`, and
  `sideEffects: false`.
- Node baseline `engines.node: ">=24"` and package manager `npm@11.16.0`.
- GitHub Packages publish registry:
  `https://npm.pkg.github.com`.
- Packages are publishable manifests: `private` is not true, and package
  versions use semver.
- Published files include `dist`, `README.md`, and `LICENSE`; file-backed
  entries must exist in the repository.
- Repositories keep a committed npm lockfile because shared workflows use
  `npm ci`.
- Script names include `lint`, `test`, `build`, `smoke:dist`, `pack:dry-run`,
  and `check`.
- `prepack` runs `npm run build`, and `pack:dry-run` runs
  `npm pack --dry-run`.
- `check` runs exact formatting, test, package dist smoke, and package dry-run
  commands while preserving package-specific smoke details.
- A TypeScript build runs before the package dist smoke, either directly before
  `smoke:dist` in `check` or as the first command delegated by `smoke:dist`.
- Shared dev dependencies are Prettier, TypeScript, and Vitest at the versions
  recorded in `package-contract.json`.

Runtime dependency compatibility is tracked separately from this repository
workflow contract. This guard focuses on manifest shape, scripts, CI, release,
registry, and package-management drift.

## Workflow Contract

Package repositories keep copied workflows today, but their important contract
is shared:

- The `Check` workflow runs on pull requests and pushes to `main`.
- The check job grants read-only repository contents access and package read
  access.
- It checks out the repository, sets up Node 24 with the `@textfilters`
  GitHub Packages registry, runs exact `npm ci`, then runs exact
  `npm run check` in the same job.
- The `Release Please` workflow runs on pushes to `main`.
- Release Please uses `googleapis/release-please-action@v5` with
  `release-please-config.json` and `.release-please-manifest.json` configured
  on the action step.
- The Release Please job exposes `release_created` from the action step output.
- Release publication only runs when Release Please reports a created release.
- Publication runs exact `npm run check` before exact `npm publish` to GitHub
  Packages in the publish job.
- The publish job keeps `packages: write` for GitHub Packages publication, and
  the publish step or publish job has the package registry token available.

## Release Please Contract

Each package has a package-local `release-please-config.json` with:

- `include-component-in-tag: false`
- package `include-component-in-tag` absent or false
- package `release-type: "node"`
- package name matching the repository package name
- no root-level or package-level `skip-github-release: true`
- a `.release-please-manifest.json` `.` entry matching the package version

Release Please remains the release path. Packages must not be published
manually.

## Updating The Contract

When the shared baseline changes, update `package-contract.json` first, then
update package repositories to match. A package-specific exception should be
encoded explicitly in the package entry instead of weakening the shared checks
for every package.
