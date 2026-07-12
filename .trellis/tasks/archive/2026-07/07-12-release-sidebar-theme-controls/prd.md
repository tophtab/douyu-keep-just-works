# Publish the Sidebar Theme-Control Update

## Goal

Publish the completed sidebar theme-control update to GitHub and trigger the Docker release workflow with a new semantic-version tag, reusing the proven `v3.7.0` release process without rewriting existing release history.

## Background

- The sidebar theme-control change is committed as `da00d05`, archived in Trellis, and recorded in the developer journal.
- Local `master` is three commits ahead of `origin/master`: the work commit, task archive commit, and journal commit.
- Package metadata and the latest local release remain at `3.7.0`.
- Annotated tag `v3.7.0` already exists locally and remotely and points to the prior release commit `c62b649`; it must not be overwritten or reused.
- The prior archived release task is `.trellis/tasks/archive/2026-07/07-12-release-sidebar-version-badge/`. Its release sequence and safety constraints are reused here.
- The local Docker preview container has been stopped after user review.

## Requirements

- Publish the current `master` history through the repository's documented release flow.
- Publish version `v3.8.0` (`package.json` version `3.8.0`), as explicitly selected by the user to treat the sidebar theme-control improvement as a feature-level release.
- Add a dated changelog entry describing the icon-only theme control and desktop sidebar-bottom placement.
- Run lint, type-check, Docker build, and tests before creating the release tag.
- Use `npm version <version> -m "chore: release %s"` so package metadata, lockfile metadata, release commit, and annotated tag stay synchronized.
- Push `master` and the new tag to `origin` separately without force-pushing.
- Verify remote refs and the tag-triggered GitHub Actions release workflow.

## Acceptance Criteria

- [x] Release version `v3.8.0` is absent locally and remotely before versioning.
- [x] The local preview container is stopped.
- [x] Release changelog and package metadata are correct.
- [x] All documented release checks pass from a clean worktree.
- [x] `master` is pushed to GitHub.
- [x] The new annotated version tag is pushed and visible on GitHub.
- [x] The release workflow trigger or published Docker release state is verified.

## Out of Scope

- Force-pushing or rewriting `v3.7.0` or any other existing tag.
- Publishing packages to npm.
- Additional application behavior changes.
