# Remove Docker Hub Minor Tag

## Goal
Stop publishing Docker Hub minor version tags such as `1.5` and keep only patch version tags such as `1.5.x` plus `latest`.

## Requirements
- Remove Docker Hub minor version tags from the publish workflow.
- Keep full patch version tags such as `1.5.0`, `1.5.1`, and so on.
- Keep `latest` for the default branch publishing flow.

## Acceptance Criteria
- [ ] Docker workflow no longer publishes `major.minor` tags.
- [ ] Docker workflow still publishes `major.minor.patch` tags.
- [ ] Docker workflow still publishes `latest` on the default branch.

## Technical Notes
The change should stay scoped to the GitHub Actions workflow that builds and publishes Docker images.
