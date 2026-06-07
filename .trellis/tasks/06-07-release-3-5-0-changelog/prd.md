# Release 3.5.0

## Goal

Publish the current Docker WebUI release as version 3.5.0.

## Requirements

- Update `CHANGELOG.md` with dated 3.5.0 release notes.
- Summarize notable changes since `v3.2.0` without listing every maintenance commit.
- Use the standard maintainer release flow from `CONTRIBUTING.md`.
- Run the local release quality gate before creating the release commit and tag.
- Create the package metadata changes and `v3.5.0` tag via `npm version 3.5.0 -m "chore: release %s"`.

## Acceptance Criteria

- [ ] `CHANGELOG.md` contains `## 3.5.0 - 2026-06-07`.
- [ ] Release notes cover the current user-visible auth, refresh, WebUI, Docker build, and maintenance changes since `v3.2.0`.
- [ ] `npm run lint` passes.
- [ ] `npm run type-check` passes.
- [ ] `npm run build:docker` passes.
- [ ] `npm test` passes.
- [ ] `package.json` and `package-lock.json` are updated to 3.5.0 by `npm version`.
- [ ] `v3.5.0` exists locally.

## Definition of Done

- Release-prep changes are committed before `npm version`.
- Release commit and tag are created from a clean tree.
- No business logic changes are introduced by this release task.

## Technical Approach

Follow the maintainer release process in `CONTRIBUTING.md`: prepare and commit the changelog first, verify the tree, run the quality gate, then use `npm version` to generate synchronized package metadata, release commit, and tag.

## Decision

Use `3.5.0` because the user requested this version explicitly and the changes since `v3.2.0` include multiple feature-level authentication and manual refresh improvements, not only patch fixes.

## Out of Scope

- No feature, runtime, WebUI, or CI implementation changes.
- No remote push unless the user confirms the commit/release plan.
- No GitHub Release body unless requested separately.

## Technical Notes

- Current branch before release work: `master`.
- Current latest release tag before release work: `v3.2.0`.
- Current package metadata before release work: `3.2.0`.
- Release date is `2026-06-07`.
