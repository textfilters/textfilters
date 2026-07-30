# Release Process

Release Please runs in manifest mode for six independently versioned npm
workspaces. The root configuration uses the `node-workspace` plugin and one
aggregated release pull request.

## Release Signals

Squash merge titles must use English Conventional Commits:

```text
type(scope?): short summary
```

- `fix:` creates a patch release for affected workspaces.
- `feat:` creates a minor release for affected workspaces.
- `type!:` or `BREAKING CHANGE:` creates a breaking release.
- `docs:`, `test:`, `refactor:`, and `chore:` normally do not create a package
  release.

The pull request title is the expected squash commit title.

## Accumulating Changes

Release Please runs after pushes to `main` and creates or updates one aggregated
release pull request. Ordinary merges do not create tags, GitHub Releases, or
package publications.

Maintainers may keep adding compatible changes until the proposed versions and
release notes are ready. Package changelog files retain the imported historical
record; new release notes live in GitHub Releases. Publishing starts only after
the aggregated release pull request is explicitly merged.

## Tags and Versions

Versions remain independent. Tags include a stable component prefix:

```text
core-v0.4.1
url-v0.3.1
email-v0.3.2
phone-v0.2.3
profanity-v0.16.3
spam-v0.3.3
```

Historical tags imported from the former package repositories are retained
under `archive/<package>/vX.Y.Z`.

## Publication

After Release Please creates releases, the workflow:

1. Installs the root lockfile.
2. Runs the full root check.
3. Reads the exact paths released by Release Please.
4. Rejects duplicates and paths outside the six-package allowlist.
5. Publishes selected workspaces sequentially in dependency order, beginning
   with `@textfilters/core`.

Package objects and existing package versions are never recreated or deleted.
Repository association changes do not change package names or version history.

## Required Verification

Before merging a release pull request:

- inspect every proposed package version and release note
- run `npm ci` and `npm run check`
- compare package dry-pack contents with the previous release
- confirm only intended metadata, version, documentation, and dependency-range
  changes

After publication:

- confirm all expected tags and GitHub Releases
- confirm package association with this monorepo, visibility, and Actions access
- install the released package set in a clean project
- verify exactly one `@textfilters/core` version resolves
- run a runtime import smoke for all six packages

Published package tags and package versions are immutable.
