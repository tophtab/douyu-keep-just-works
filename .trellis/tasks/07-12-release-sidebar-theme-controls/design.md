# Release Design

## Boundaries

- Release the existing `master` history; do not add application behavior.
- Update only release documentation and npm-managed package version metadata.
- Reuse the existing GitHub `origin` and documented tag-triggered Docker workflow.
- Preserve the existing `v3.7.0` release and tag unchanged.

## Release Sequence

1. Confirm `v3.8.0` does not already exist locally or remotely.
2. Add a dated `3.8.0` changelog entry and commit it separately.
3. Confirm the worktree is clean and run the documented full quality gate.
4. Run `npm version 3.8.0 -m "chore: release %s"` to update package metadata, create the release commit, and create annotated tag `v3.8.0`.
5. Push `master`, then push the new version tag separately.
6. Verify remote refs and the tag-triggered GitHub Actions workflow.

## Safety and Rollback

- Never force-push or overwrite an existing tag.
- Stop before pushing if checks, versioning, authentication, or remote state differs from the expected clean linear history.
- Before tag push, correct problems with normal new commits; after tag push, report failures instead of rewriting release history.
- If the workflow fails after the tag is pushed, diagnose or rerun the workflow without moving the published tag.
