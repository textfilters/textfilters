# Release Process

`@textfilters/core` is independently versioned from the root Release Please
manifest. Releasable Conventional Commits that touch this workspace accumulate
in the single aggregated release pull request.

Ordinary merges to `main` do not publish. When maintainers explicitly merge the
aggregated release pull request, Release Please creates a `core-vX.Y.Z` tag and
GitHub Release, then the publish job validates the released path and publishes
this workspace first.

See the [monorepo release process](../../../docs/release-process.md).
