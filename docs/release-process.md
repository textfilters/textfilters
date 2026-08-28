# Release Process

Release Please runs in manifest mode for eight independently versioned npm
workspaces. The root configuration uses the `node-workspace` plugin and one
aggregated release pull request.

The workspace plugin propagates releases through the local dependency graph so
published dependents receive compatible local dependency ranges. A package
with no direct source change can therefore receive a dependency-only patch when
a released local dependency moves outside its current range.

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
url-v0.4.0
email-v0.3.2
phone-v0.2.4
profanity-v2.0.0
profanity-ru-v0.1.0
profanity-en-v0.1.0
spam-v0.3.3
```

Historical tags imported from the former package repositories are retained
under `archive/<package>/vX.Y.Z`.

## Publication

After Release Please creates releases, the workflow:

1. Installs the root lockfile.
2. Runs the full root check.
3. Reads the exact paths released by Release Please.
4. Rejects duplicates and paths outside the eight-package allowlist.
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
- run a runtime import smoke for all eight packages

Published package tags and package versions are immutable.

## Release History Boundary

`last-release-sha` points to the merge commit of release pull request #68. This
intentional post-architecture migration boundary excludes #67 and older commits
from future release analysis, preventing repeat Russian and English dictionary
releases caused only by the documentation changes in #67. Release Please still
processes every future commit after the boundary normally.

Do not remove the boundary as stale configuration. Reconsider it only after
both dictionary packages have real new releases whose tags are newer than #67.
