# release 3.0.0

## Goal

Publish version 3.0.0 using the repository release process so changelog, package metadata, release commit, git tag, and remote branch/tag are consistent.

## What I Already Know

- User requested publishing `3.0.0`.
- Current package version is `2.5.0`.
- `CONTRIBUTING.md` defines the release flow: update `CHANGELOG.md`, commit release prep if needed, run release checks, run `npm version <version> -m "chore: release %s"`, then push `master` and `v<version>`.
- Current branch is `master` and the working tree was clean before task setup.

## Assumptions

- The existing `Unreleased` changelog entry belongs to version `3.0.0`.
- The publish target is the default remote `origin` for `master` and tag `v3.0.0`.
- Pushing `v3.0.0` is intended to trigger the Docker release workflow.

## Requirements

- Add a dated `3.0.0` section to `CHANGELOG.md`.
- Run the repository release checks before versioning.
- Use `npm version 3.0.0 -m "chore: release %s"` for package metadata, release commit, and tag.
- Push `master` and `v3.0.0` after successful release commit/tag creation.

## Acceptance Criteria

- [x] `CHANGELOG.md` contains `## 3.0.0 - 2026-05-15` with the release notes.
- [x] `npm run lint`, `npm run type-check`, `npm run build:docker`, and `npm test` pass.
- [x] `package.json` and `package-lock.json` are versioned to `3.0.0`.
- [x] Local git has release commit `chore: release 3.0.0` and tag `v3.0.0`.
- [x] `origin/master` and `origin/v3.0.0` are pushed.

## Out of Scope

- Adding new product behavior.
- Manually editing generated build output.
- Creating a GitHub Release by hand unless the repository workflow requires it separately.

## Technical Notes

- Release instructions: `CONTRIBUTING.md`.
- Changelog target: `CHANGELOG.md`.
- Version source: `package.json` and lockfile metadata maintained by `npm version`.
- Initial tag workflow was cancelled because the first changelog draft only
  covered `Unreleased`. The final `v3.0.0` tag was moved to the changelog
  correction commit `cf0f81a`, and the corrected Docker release workflow passed.
