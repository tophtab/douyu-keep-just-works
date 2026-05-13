# Remove Project-Specific Mandatory Spec Verification

## Goal

Remove project-specific `.trellis/spec/` requirements that make validation commands sound mandatory for every relevant change.

## Scope

- Keep Trellis workflow-level quality check requirements unchanged.
- Edit only project-specific spec language under `.trellis/spec/`.
- Remove hard "Tests Required" / "Testing Requirements" sections instead of replacing them with advisory validation lists.
- Preserve executable behavior contracts, API contracts, and examples.

## Acceptance Criteria

- Project-specific scenario/contract specs no longer include fixed validation suites for matching changes.
- General quality guideline specs no longer carry standalone testing-requirements sections.
- No source code behavior changes.
