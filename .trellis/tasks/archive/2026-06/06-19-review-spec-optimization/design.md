# Design: Spec Optimization

## Architecture And Boundaries

This task changes Trellis project documentation under `.trellis/spec/`.
Application source code and tests are out of scope.

The spec corpus should have two distinct documentation roles:

- Daily guidelines: short rules that are commonly needed before editing a layer.
- Scenario contracts: specific, high-risk behavior records that are read only
  when their trigger applies.

Indexes should route agents to both roles without requiring broad full-file
reads for narrow tasks.

## Target Shape

Keep the existing backend/frontend/guides layer model.

For backend:

- Keep daily guideline files such as `directory-structure.md`,
  `database-guidelines.md`, `error-handling.md`, `quality-guidelines.md`,
  `testing-guidelines.md`, and `logging-guidelines.md`.
- Consolidate scenario-heavy backend contracts into `backend/contracts.md`.
- Fold standalone scenario-only backend files into that contract surface to
  reduce file count.

For frontend:

- Keep daily guideline files such as `directory-structure.md`,
  `component-guidelines.md`, `hook-guidelines.md`, `state-management.md`,
  `quality-guidelines.md`, and `type-safety.md`.
- Move scenario-heavy state-management contracts into a dedicated frontend
  contract surface, preferably one `frontend/contracts.md`.
- Keep state-management daily rules focused on ownership, resource loading
  patterns, and common mistakes.

For shared guides:

- Keep `guides/index.md` as the routing entry.
- Compress guide prose only where it repeats the index or broad motivation.
- Preserve concrete checklists for cross-layer and reuse hazards.

## Compression Rules

Compression is allowed only when it preserves the executable contract:

- Keep triggers, affected files/APIs, hard contracts, validation requirements,
  and required tests.
- Remove repeated motivational prose and template boilerplate when the same
  information is already implied by headings.
- Collapse Good/Base/Bad and Wrong/Correct sections into concise bullets when
  examples do not carry unique implementation detail.
- Do not remove secret-boundary, CookieCloud, Passport QR, Yuba SSO, Docker
  build cache, config persistence, force-refresh, or Vue-only runtime contracts
  unless a direct stronger replacement remains in the spec.

## Compatibility And References

The active indexes must be updated for every moved contract.

Archived task references may continue to point to old file names; they are
historical records and do not block current spec cleanup. Current specs should
not keep stub files solely for archive compatibility unless a current skill or
workflow references them.

No Trellis skill or workflow behavior should be changed unless spec-only edits
cannot express the loading guidance. The first implementation pass should try
to solve the problem entirely in `.trellis/spec/`.

## Trade-Offs

Using one contract file per layer reduces file-count pressure and keeps routing
simple, but those files can become long. This is acceptable if indexes and
section maps let agents jump to triggered sections.

Splitting every scenario into its own file gives the best targeted reads, but
it increases file count and likely worsens the user's "too many specs" concern.

Aggressive line-count reduction is useful only after contract preservation is
checked scenario by scenario.

## Rollback

This is a documentation-only change. Rollback is a normal git revert of the
task edits. Keep edits scoped so `git diff .trellis/spec` clearly shows moved
and compressed content.
