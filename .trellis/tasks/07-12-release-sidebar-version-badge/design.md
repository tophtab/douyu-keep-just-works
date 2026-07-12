# Release Design

## Boundaries

- Release the existing `master` history; do not add application behavior.
- Update only release documentation and npm-managed package version metadata.
- Use the existing GitHub `origin` and documented tag-triggered Docker workflow.

## Release Sequence

1. Add the `3.7.0 - 2026-07-12` changelog entry and commit it separately.
2. Run the documented local release quality gate on a clean worktree.
3. Run `npm version 3.7.0 -m "chore: release %s"` to update package metadata,
   create the release commit, and create annotated tag `v3.7.0`.
4. Push `master`, then push `v3.7.0` separately.
5. Verify remote refs and the tag-triggered GitHub Actions workflow.

## Safety and Rollback

- Never force-push or overwrite an existing tag.
- Stop before pushing if checks, versioning, authentication, or remote state
  differs from the expected clean linear history.
- Before tag push, local release commits can be corrected through normal new
  commits; after tag push, report failures instead of rewriting release history.
