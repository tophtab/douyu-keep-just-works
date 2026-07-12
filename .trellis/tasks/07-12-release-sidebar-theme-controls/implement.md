# Implementation Plan

- [ ] Verify `v3.8.0` is absent locally and remotely.
- [ ] Update `CHANGELOG.md` with the `3.8.0` sidebar theme-control release notes.
- [ ] Commit the changelog preparation as `chore: prepare release 3.8.0`.
- [ ] Confirm the worktree is clean and local `master` is linearly ahead of `origin/master`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run type-check`.
- [ ] Run `npm run build:docker`.
- [ ] Run `npm test`.
- [ ] Run `npm version 3.8.0 -m "chore: release %s"`.
- [ ] Push `master` to `origin`.
- [ ] Push the new version tag to `origin`.
- [ ] Verify remote branch/tag and GitHub Actions release workflow state.
