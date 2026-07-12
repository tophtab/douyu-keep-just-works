# 发布侧边栏版本角标更新

## Goal

Publish the completed changes since `v3.6.0` to GitHub and trigger the Docker
release workflow with a new semantic-version tag.

## Background

- The local preview processes have been stopped.
- `master` is ahead of `origin/master`; the worktree is otherwise clean apart
  from this Trellis task.
- The latest local and remote release tag is `v3.6.0`.
- Changes since `v3.6.0` include WebUI layout fixes, internal refactoring, CI
  ordering improvements, README updates, and the title version badge.
- The documented release flow requires updating `CHANGELOG.md`, committing the
  release preparation, running the full quality gate, using `npm version`, and
  pushing the branch and tag separately.

## Requirements

- Release version is `v3.7.0` (`package.json` version `3.7.0`).
- Add a dated changelog entry summarizing user-visible and maintenance changes.
- Run lint, type-check, Docker build, and tests before creating the release tag.
- Use the repository's standard `npm version` flow so `package.json`, the lock
  file, release commit, and Git tag remain synchronized.
- Push `master` and the new version tag to `origin` without force-pushing.
- Verify the pushed refs and report the resulting GitHub/Docker release state.

## Acceptance Criteria

- [ ] Local preview processes are stopped.
- [ ] Release version and changelog are correct and committed.
- [ ] All documented release checks pass.
- [ ] `master` is pushed to GitHub.
- [ ] The new annotated version tag is pushed and visible on GitHub.
- [ ] The release workflow trigger or published release state is verified.

## Out of Scope

- Force-pushing or rewriting existing tags.
- Publishing packages to npm.
- Changing application behavior beyond release metadata.
