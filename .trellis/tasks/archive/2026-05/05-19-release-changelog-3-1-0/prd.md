# release changelog 3.1.0

## Goal

Prepare and publish version 3.1.0 by deriving release notes from commits after
`v3.0.0`, following the repository release process so changelog, package
metadata, release commit, git tag, and remote branch/tag stay consistent.

## What I Already Know

- User requested writing the changelog from commits and publishing version
  `3.1.0`.
- Current branch is `master`.
- Latest release tag is `v3.0.0`.
- Current package metadata is still `3.0.0`.
- `CONTRIBUTING.md` defines the release process: update `CHANGELOG.md`, commit
  release prep, run local checks, run `npm version <version> -m "chore: release %s"`,
  then push `master` and the release tag.
- Candidate changes since `v3.0.0` include fixes for WebUI saved task state,
  WebUI brand repository link, unified task-default config source, restricted
  project license, and Trellis template/spec maintenance.

## Assumptions

- The release date is `2026-05-19`.
- Changelog should exclude routine journal and Trellis task archive commits.
- Pushing `v3.1.0` is intended to trigger the Docker release workflow.

## Requirements

- Add a dated `3.1.0` section to `CHANGELOG.md`.
- Base release notes on `git log v3.0.0..HEAD`.
- Keep wording user-facing and concise.
- Run the repository release checks before versioning.
- Use `npm version 3.1.0 -m "chore: release %s"` for package metadata, release
  commit, and tag.
- Push `master` and `v3.1.0` after successful release commit/tag creation.

## Acceptance Criteria

- [x] `CHANGELOG.md` contains `## 3.1.0 - 2026-05-19`.
- [x] `npm run lint`, `npm run type-check`, `npm run build:docker`, and
  `npm test` pass.
- [x] `package.json` and `package-lock.json` are versioned to `3.1.0`.
- [x] Local git has release commit `chore: release 3.1.0` and tag `v3.1.0`.
- [x] `origin/master` and `origin/v3.1.0` are pushed.

## Out of Scope

- Adding new product behavior.
- Creating a GitHub Release by hand.
- Modifying generated build output directly.

## Technical Notes

- Release instructions: `CONTRIBUTING.md`.
- Changelog target: `CHANGELOG.md`.
- Version source: `package.json` and lockfile metadata maintained by
  `npm version`.
- Release prep commit: `f43fabe`.
- Release commit/tag: `3bc943a` / `v3.1.0`.
