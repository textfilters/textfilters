# Release process

Release Please is configured for this repository and runs after pushes to `main`.
It reads commit messages that have landed on `main`, so the squash merge commit
title is the release signal.

## Squash merge titles

Before merging a pull request, set the squash commit title to a Conventional
Commit:

```text
type(scope?): short summary
```

Use the PR title as the expected squash commit title so the final squash commit
can be copied from the PR.

Examples:

```text
fix: include corpus JSON in package build
fix(email): reject ambiguous bare-word domains
feat: expose analysis result metadata
docs: clarify runtime literal behavior
chore: reorganize tests
```

## Release impact

- `fix:` creates a patch release.
- `feat:` creates a minor release.
- `type!:` or `BREAKING CHANGE:` creates a major release.
- `chore:`, `docs:`, `test:`, and `refactor:` usually do not create a release
  unless they are configured as releasable types or marked as breaking changes.

## Recovery for an already merged bad title

If a PR was squash-merged with a bad squash commit title, edit the merged PR body
and add a commit override:

```md
BEGIN_COMMIT_OVERRIDE
fix: describe the releasable change
END_COMMIT_OVERRIDE
```

Then re-run the Release Please workflow. This is only for recovery; future PRs
should use correct Conventional Commit squash titles before merge.
