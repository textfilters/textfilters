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
  entries must exist in the repository. Package file entries must not exclude
  required output, and `dist` must not contain its own `.npmignore` or
  `.gitignore`.
- Repositories keep a committed npm lockfile because shared workflows use
  `npm ci`.
- Script names include `lint`, `test`, `build`, `smoke:dist`, `pack:dry-run`,
  and `check`, and required script bodies are non-empty.
- `prepack` runs `npm run build`, and `pack:dry-run` runs
  `npm pack --dry-run`; install, prepare, and publish lifecycle scripts that
  could mutate CI or publish state are not used. Pre/post run-script hooks
  around audited package scripts are not used.
- `check` runs exact formatting, test, package dist smoke, and package dry-run
  commands while preserving package-specific smoke details. Its command list is
  limited to the audited sequence with an optional direct build immediately
  before `smoke:dist`; it must not short-circuit before any required command
  runs or append extra commands after the audit.
- A TypeScript build runs before the package dist smoke, either directly before
  `smoke:dist` in `check` or as the first command delegated by `smoke:dist`;
  delegated smoke scripts do real smoke work beyond rebuilding and must not use
  an explicit successful early exit.
- Shared dev dependencies are Prettier, TypeScript, and Vitest at the versions
  recorded in `package-contract.json`.
- Package scripts must not contain `npm publish` or publish aliases, mutate
  GitHub Actions environment files, or set npm config environment variables that
  alter publication; release publication stays in the audited Release Please
  workflow.
- Packages must not define npm workspaces.
- Package-level npm configuration must not set `dry-run`, `script-shell`,
  workspace options, `tag`, `userconfig`, `globalconfig`, `ignore-scripts`, or
  a non-contract registry.

Runtime dependency compatibility is tracked separately from this repository
workflow contract. This guard focuses on manifest shape, scripts, CI, release,
registry, and package-management drift.

## Workflow Contract

Package repositories keep copied workflows today, but their important contract
is shared:

- Workflow files do not use YAML anchors or aliases for control blocks,
  environment, defaults, jobs, or steps; copied workflows stay explicit.
- The `Check` workflow has the exact top-level workflow name and runs on pull
  requests and pushes only to the exact `main` branch entry. The pull request
  event is a top-level workflow event, and the selected check job defines a
  runner, has no job dependencies, defines no matrix strategy, and is
  unconditional and blocking. Required events are not filtered by paths or event
  types, including inline flow-mapping filters. No extra events or jobs are
  configured.
- The check job grants read-only repository contents access and package read
  access only, either through workflow-level or block-form job-level
  permissions.
- It checks out the repository exactly once without checkout inputs, sets up
  Node 24 once with the `@textfilters` GitHub Packages registry in a blocking
  setup step, runs exact `npm ci`, then runs exact `npm run check` in the same
  job. The check job contains only these audited steps. The install and check
  steps use the default shell and npm script shell, are unconditional, and are
  blocking.
- The `Release Please` workflow has the exact top-level workflow name and runs
  only on unfiltered pushes to the exact `main` branch entry. Its jobs are
  limited to the audited Release Please and publish jobs.
- Release Please uses exactly one `googleapis/release-please-action@v5` step
  with `release-please-config.json` and `.release-please-manifest.json`
  configured in the action step `with` block. Its action inputs are limited to
  the expected token, config file, and manifest file, and the action step uses
  exact `id: release`. The Release Please job contains only this audited action
  step.
- The Release Please and publish jobs define runners. The Release Please job
  has no job dependencies, neither release job defines a matrix strategy, and
  the Release Please job and action step are unconditional and blocking. Release
  Please job permissions are exactly `contents: write`, `issues: write`, and
  `pull-requests: write`.
- The Release Please job exposes `release_created` from the action step output
  through job-level `outputs`.
- Release publication only runs when Release Please reports a created release,
  with job-level `needs` wiring and only the expected release-created job gate
  or publish-step gate.
- Publication runs exact `npm ci`, then exact `npm run check`, then exact
  `npm publish` to GitHub Packages in the publish job, with a single publish
  command. The publish job contains only the audited checkout, setup, install,
  check, and publish steps, so no command can mutate release inputs between
  check and publication. The install, prepublish check, and publish steps are
  blocking.
- The publish job permissions are exactly `contents: read` and
  `packages: write`, and the publish step or publish job has the package
  registry token available without a conflicting step-level token override or
  publish-altering npm configuration at workflow, job, step, or package npm
  config scope, including scoped registry environment overrides.
- Required npm install, check, and publish commands run at the package
  repository root with the default shell and without PATH overrides.
- `npm publish` commands, including publish aliases, shell-escaped command
  words, and any `npm` invocation that reaches a publish command token before a
  shell boundary, only appear in the audited Release Please workflow. Other
  workflows must not run Release Please actions.

## Release Please Contract

Each package has a package-local `release-please-config.json` with:

- `include-component-in-tag: false`
- only the root `.` package entry
- package `include-component-in-tag` absent or false
- package `release-type: "node"`
- package name matching the repository package name
- no root-level or package-level `skip-github-release: true`
- no root-level or package-level `skip-github-pull-request: true`
- a `.release-please-manifest.json` `.` entry matching the package version

Release Please remains the release path. Packages must not be published
manually.

## Updating The Contract

When the shared baseline changes, update `package-contract.json` first, then
update package repositories to match. A package-specific exception should be
encoded explicitly in the package entry instead of weakening the shared checks
for every package.
