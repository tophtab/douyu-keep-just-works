# Implementation Plan

- [x] Verify `v3.8.0` is absent locally and remotely.
- [x] Update `CHANGELOG.md` with the `3.8.0` sidebar theme-control release notes.
- [x] Commit the changelog preparation as `chore: prepare release 3.8.0`.
- [x] Confirm the worktree is clean and local `master` is linearly ahead of `origin/master`.
- [x] Run `npm run lint`.
- [x] Run `npm run type-check`.
- [x] Run `npm run build:docker`.
- [x] Run `npm test`.
- [x] Run `npm version 3.8.0 -m "chore: release %s"`.
- [x] Push `master` to `origin`.
- [x] Push the new version tag to `origin`.
- [x] Verify remote branch/tag and GitHub Actions release workflow state.
