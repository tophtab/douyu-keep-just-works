# Execution Plan

## Gate

- [x] Inspect all legacy config owners and related contracts.
- [x] Persist converged requirements, design, research and real spec context manifests.
- [x] Obtain explicit approval of the final planning summary, then run `task.py start`.

## Implementation

- [x] Dispatch `trellis-implement` with native injection or child-side context loading. It owns product code, tests and README. Main agent owns active specs and task artifacts. Preserve all unrelated existing edits.
- [x] Simplify core normalization/defaults to current fields; remove the unused option and update callers.
- [x] Remove old credential/section merging and validation from config-store, config-validation, server-config-routes and runtime-app-context.
- [x] Remove the complete README subsection.
- [x] Update config tests and Passport/route fixtures; cover ignored old fields, current patches/clears, persistence, validation and preserved cron.
- [x] Update active backend/frontend specs to current-format-only contracts.

## Verification

- [x] Dispatch `trellis-check` over the complete task diff and approved PRD. Verify removed compatibility while retaining unrelated external legacy protocols.
- [x] Run `npm run lint` and `npm run type-check`.
- [x] Run `npm test` (all contract tests then `npm run build:docker`; avoid a duplicate build).
- [x] Review diff/whitespace; confirm runtime config and pre-existing Trellis changes were not modified by this task.
- [x] Prepare verified handoff for task archive and session journal; push and GitHub Release follow local finish-work.

## Risk and Recovery Boundaries

Tests must cover loading and merging into saved current settings across core, validation and persistence. Revisit planning before extending scope. If recovery is needed, revert only task-owned edits, never reset the pre-existing tree. Do not deploy or modify runtime config during verification.

## Proposed Commit Batch

User authorized the commit batch, finish-work, push and v3.11.0 release. Main implementation commit:

`refactor: remove legacy config compatibility`

- `README.md`
- `src/core/config-normalization.ts`
- `src/core/task-defaults.ts`
- `src/docker/config-store.ts`
- `src/docker/config-validation.ts`
- `src/docker/runtime-app-context.ts`
- `src/docker/server-config-routes.ts`
- `test/config-guardrails-contract.test.js`
- `test/douyu-passport-contract.test.js`
- `test/server-route-guardrails-contract.test.js`
- `.trellis/spec/backend/contracts.md`
- `.trellis/spec/backend/database-guidelines.md`
- `.trellis/spec/frontend/type-safety.md`

Also commit the task artifacts with the implementation, the existing Trellis changes as `chore: update Trellis to 0.6.17`, and CHANGELOG as `chore: prepare release 3.11.0`. Run `npm version 3.11.0 -m "chore: release %s"` from a clean tree. Then archive this task and record the session with separate bookkeeping commits. Push master and v3.11.0 and populate GitHub Release notes. This work was implemented directly on the existing master branch and does not create a PR; use the archive command's explicit branch-validation skip for that documented local-only case.

Existing Trellis files explicitly authorized for the separate tooling commit:

- `.agents/skills/trellis-session-insight/SKILL.md`
- `.agents/skills/trellis-session-insight/references/cli-quick-reference.md`
- `.cursor/hooks/inject-subagent-context.py`
- `.cursor/skills/trellis-session-insight/SKILL.md`
- `.cursor/skills/trellis-session-insight/references/cli-quick-reference.md`
- `.trellis/.template-hashes.json`
- `.trellis/.version`
- `.trellis/scripts/common/active_task.py`
- `.trellis/scripts/common/task_store.py`

## Verification Results

Implementation and independent full-scope review completed on 2026-09-30. No reviewer findings or changes. Lint and backend/WebUI type checks passed; all 49 contract tests passed with no skips; Docker application build passed (Vite WebUI and backend TypeScript). Task whitespace/residual-compatibility searches passed. Temporary test/build log: `/tmp/remove-legacy-config-check-test.log`. Runtime config was not accessed and the nine pre-existing dirty paths were preserved. The user has now authorized all commits, release 3.11.0, finish-work and push, including the existing Trellis files.

## Local Release Completion

Committed configuration changes (`7350d7a`), existing Trellis 0.6.17 updates (`89cff74`), CHANGELOG (`930c9ed`), and npm-generated version metadata (`7311083`). Annotated `v3.11.0` points to the release commit. Package and lockfile root versions are all 3.11.0. Trellis review passed Python AST, metadata JSON, mirrored skills and whitespace checks. Finish-work archives this task and records the session next; master/tag push and GitHub Release publication follow.
