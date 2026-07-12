# Implementation Plan

- [ ] Update `CHANGELOG.md` with the `3.7.0` release notes.
- [ ] Commit the changelog preparation as `chore: prepare release 3.7.0`.
- [ ] Confirm the worktree is clean and the remote tag does not exist.
- [ ] Run `npm run lint`.
- [ ] Run `npm run type-check`.
- [ ] Run `npm run build:docker`.
- [ ] Run `npm test`.
- [ ] Run `npm version 3.7.0 -m "chore: release %s"`.
- [ ] Push `master` to `origin`.
- [ ] Push `v3.7.0` to `origin`.
- [ ] Verify remote branch/tag and GitHub Actions release workflow state.
