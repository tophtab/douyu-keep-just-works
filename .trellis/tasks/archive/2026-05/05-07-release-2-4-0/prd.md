# Release 2.4.0

## Goal

Publish version 2.4.0 of the Docker WebUI release line.

## What I Already Know

- Current package metadata is `2.3.0` in `package.json` and `package-lock.json`.
- Docker publish is handled by `.github/workflows/docker.yml`.
- The workflow publishes release images when a `vX.Y.Z` or `VX.Y.Z` tag is pushed.
- Existing latest release tag is `v2.3.0`; no `v2.4.0` tag exists yet.
- `CHANGELOG.md` has an `Unreleased` section and uses a Keep a Changelog-style format.

## Requirements

- Update package metadata to version `2.4.0`.
- Move relevant `Unreleased` notes into a dated `2.4.0` changelog entry.
- Include the main user-visible changes since `v2.3.0`.
- Run the local quality checks required for release readiness.
- Create a release commit and push it to `origin/master`.
- Create and push tag `v2.4.0` so the Docker release workflow publishes `2.4.0` and `latest`.
- Document the preferred future release process using `npm version <version>` so
  package metadata, lockfile metadata, release commit, and git tag stay in sync.

## Acceptance Criteria

- [ ] `package.json` version is `2.4.0`.
- [ ] `package-lock.json` root/package version metadata is `2.4.0`.
- [ ] `CHANGELOG.md` has `## 2.4.0 - 2026-05-07`.
- [ ] Lint, type-check, and build/test checks pass locally.
- [ ] Release commit exists on `master`.
- [ ] Git tag `v2.4.0` exists and is pushed to `origin`.
- [ ] Contributor/release documentation explains the `npm version` workflow and
  the separate push of `master` and the release tag.

## Definition of Done

- Local working tree is clean except for Trellis task bookkeeping if not archived.
- Release workflow has been triggered by pushing the release tag.
- Any limitation, such as inability to observe remote workflow completion, is reported.

## Out of Scope

- Changing runtime behavior.
- Adding new release automation.
- Creating a GitHub Release manually unless the repository already automates or requires it.

## Technical Notes

- `.github/workflows/docker.yml` validates lint, type-check, and Docker runtime build before publishing.
- Release tags accepted by the workflow match `^[vV]x.y.z$`.
