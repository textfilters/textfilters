# npmjs.com Publication Plan

This repository records the ecosystem policy for publishing Textfilters
packages to npmjs.com when packages reach `1.0.0`. It does not publish any
package by itself.

## Policy

- Pre-`1.0.0` releases stay on GitHub Packages unless a package-specific issue
  explicitly changes that policy.
- `1.0.0+` public packages may publish to npmjs.com after their package
  repository has the workflow gate, metadata checklist, and first-publish setup
  below.
- GitHub Packages support remains available unless a separate compatibility
  decision removes it.
- Publishing must run only from trusted release automation on the package
  repository's default branch, never from pull requests or untrusted forks.
- Runtime behavior, package names, and public exports are not changed by this
  publication plan.

## Release Automation Model

Each package repository should own its npmjs.com publish step because packages
release independently. The recommended workflow shape is:

1. Release automation prepares or detects a package release on the default
   branch.
2. The package runs its normal `npm run check` gate.
3. The package runs a package dry run, for example `npm pack --dry-run`.
4. The workflow checks that the package version is `1.0.0` or newer.
5. The workflow publishes to GitHub Packages if that package still uses it.
6. The workflow publishes to npmjs.com with public access.
7. The workflow creates the GitHub Release and immutable `vX.Y.Z` tag only after
   publication succeeds, or otherwise reports the failed publication clearly.

The npmjs.com step should be explicit in each package workflow or in a shared
reusable workflow that package repositories call. In either case, the package
repository must make the version gate visible so pre-`1.0.0` releases cannot
publish to npmjs.com accidentally.

## Required Setup

- Create or choose the npm organization for the `@textfilters` scope.
- Confirm every package name is available under that scope.
- Configure npm two-factor authentication policy for the organization.
- Configure trusted publishing for each package where possible, or store an npm
  automation token as a GitHub Actions secret.
- Name the npm secret consistently across package repositories, for example
  `NPM_TOKEN`.
- Grant the release workflow only the GitHub permissions it needs for checkout,
  package publication, release creation, and provenance.
- Keep npm tokens and recovery codes out of repositories, issues, release notes,
  logs, and generated artifacts.

## Package Metadata Checklist

Before first npmjs.com publication, each package should verify:

- `name` is the intended public scoped package name.
- `version` is the release version.
- `license` is present and matches `LICENSE`.
- `repository`, `bugs`, and `homepage` point to the package repository.
- `description` and `keywords` are useful for public discovery.
- `files` includes only the intended publish surface, usually `dist`,
  `README.md`, `LICENSE`, and package docs where applicable.
- `exports`, `main`, and `types` point to built `dist` artifacts.
- `sideEffects` is correct for the package.
- README installation examples mention the correct public registry behavior for
  npmjs.com.
- `npm pack --dry-run` output contains the expected files and no local machine
  details.

## First-Publish Checklist

For each package:

1. Confirm the package is intended to publish publicly at `1.0.0+`.
2. Confirm the npm organization, package access, and token or trusted publishing
   setup.
3. Run the package's normal local check.
4. Run `npm pack --dry-run` and inspect the tarball file list.
5. Verify package metadata with `npm view` only after publication, not before.
6. Trigger the release workflow from the package repository's trusted default
   branch.
7. Confirm npmjs.com shows the expected package version, README, license,
   repository links, and public access.
8. Confirm GitHub Packages publication still works if the package keeps dual
   publishing.
9. Record any package-specific release caveat in that package repository.

## Candidate Packages

The initial npmjs.com plan covers:

- `@textfilters/core`
- `@textfilters/url`
- `@textfilters/email`
- `@textfilters/phone`
- `@textfilters/profanity`
- `@textfilters/spam`

Additional packages should follow the same policy unless their repository
documents a package-specific exception.
