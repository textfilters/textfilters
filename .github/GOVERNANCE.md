# Governance

Textfilters uses maintainer-led governance. Maintainers set package scope,
public API direction, release timing, and repository policy.

The project favors small API surfaces, focused packages, and public MIT
packages that can be composed in moderation pipelines. Runtime ownership stays
inside the relevant `packages/<name>` workspace.

Packages use independent semantic versions. Releases are published to GitHub
Packages first. Published package tags are immutable.

Repository artifacts are English-only. Pull requests are not self-merged.
Maintainers review scope, validation, public API compatibility, and release
impact before merge.
