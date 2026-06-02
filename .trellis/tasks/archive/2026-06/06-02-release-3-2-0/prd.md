# Release 3.2.0

## Goal

Publish the current Docker WebUI release as version 3.2.0.

## Requirements

- Update `CHANGELOG.md` with dated 3.2.0 release notes.
- Run the local release quality gate before tagging.
- Use the standard `npm version 3.2.0 -m "chore: release %s"` release flow.
- Push `master` and the `v3.2.0` tag so the Docker release workflow publishes the versioned and latest images.

## Acceptance Criteria

- [ ] `CHANGELOG.md` contains `## 3.2.0 - 2026-06-02`.
- [ ] `npm run lint` passes.
- [ ] `npm run type-check` passes.
- [ ] `npm run build:docker` passes.
- [ ] `npm test` passes.
- [ ] `package.json` and `package-lock.json` are updated to 3.2.0 by `npm version`.
- [ ] `v3.2.0` exists locally and is pushed to origin.

## Definition of Done

- Release-prep changes are committed before `npm version`.
- Release commit and tag are created from a clean tree.
- `master` and `v3.2.0` are pushed separately.
- Publish status is checked after push.

## Technical Approach

Follow the maintainer release process in `CONTRIBUTING.md`. This release is Docker-first; the tag push triggers `.github/workflows/docker.yml`, which publishes `tophtab/douyu-keep-just-works:3.2.0` and `latest`.

## Decision

Use `3.2.0` rather than `3.1.1` because the changes since `v3.1.0` include multiple cookie recovery behavior fixes plus runtime architecture cleanup.

## Out of Scope

- No business logic changes.
- No Docker workflow changes.
- No GitHub Release body unless requested after the Docker publish succeeds.

## Technical Notes

- Current branch before release: `master`.
- Current latest tag before release: `v3.1.0`.
- Working tree was clean before creating this release task.
