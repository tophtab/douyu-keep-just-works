# brainstorm: code refactor and optimization

## Goal

Simplify and optimize the existing TypeScript/Vue codebase across three current high-value areas: frontend task-page duplication, backend task metadata/routing duplication, and one safe WebUI legacy bridge deletion slice, without changing user-visible behavior.

## What I already know

* User asked for "精简与优化代码" and explicitly invoked `trellis-brainstorm`, so this should become a scoped implementation task rather than an ad hoc broad cleanup.
* The repository is a Node 24 TypeScript project with a Docker backend under `src/docker`, shared core logic under `src/core`, and a Vue/Vite Docker WebUI under `src/docker/webui`.
* Quality gates are available through `npm run lint`, `npm run type-check`, `npm run test:contracts`, and `npm run build:docker`.
* The working tree already has many unrelated Trellis changes and deleted archived task files; this task must not revert or accidentally include unrelated work.
* Current largest source files are mostly WebUI transitional/logic files: `src/docker/webui/resources.ts`, `legacy-state.ts`, `yuba.ts`, `cookie.ts`, `keepalive.ts`, `double.ts`, and `expiring.ts`.
* A previous archived review identified WebUI bridge removal, allocation task helper extraction, task metadata expansion, route wrapper cleanup, and gift allocation purification as useful directions.
* Several previous P0 items are already done in the current source: shared task defaults exist in `src/core/task-defaults.ts`; bridge event names are centralized in `src/docker/webui/bridge-contract.ts`; gift allocation helpers are synchronous and clone inputs; frontend allocation helpers exist in `src/docker/webui/allocation-task.ts`.

## Assumptions (temporary)

* The best next move is a staged refactor with no behavior change, not a broad rewrite.
* We should prefer changes that can be verified by existing contract tests plus type-check/lint.
* Because much of the WebUI still has legacy bridge contracts enforced by tests, bridge deletion should be treated as a small slice after lower-risk cleanup.

## Open Questions

* None. User confirmed all three candidate directions should be completed.

## Requirements (evolving)

* Preserve all existing public behavior and Docker WebUI flows.
* Implement all three selected refactor directions as staged, behavior-preserving slices:
  * Frontend allocation task page extraction for repeated keepalive/double/expiring mechanics.
  * Backend task metadata expansion or routing cleanup where it removes obvious duplicated task branching.
  * One safe WebUI legacy bridge deletion/collapse slice, with contract tests updated to encode the new boundary.
* Reduce duplication, complexity, or maintenance cost in code that is currently active.
* Update or add focused contract tests if the chosen slice changes a shared contract or removes repeated behavior.
* Run lint/type-check and relevant tests before completion.

## Acceptance Criteria (evolving)

* [x] All three refactor directions are documented with explicit in-scope and out-of-scope boundaries.
* [x] Frontend task-page duplication is reduced while preserving task page behavior.
* [x] Backend task metadata/routing duplication is reduced while preserving task scheduling and trigger behavior.
* [x] One WebUI legacy bridge layer is safely deleted or collapsed, and tests assert the new expected boundary.
* [x] Implementation preserves existing behavior and user-facing text unless explicitly agreed otherwise.
* [x] Duplicate code or transitional indirection is measurably reduced in each selected area.
* [x] Existing contract tests pass, with new/updated tests added where behavior contracts need protection.
* [x] Lint and type-check pass.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI-equivalent commands are green.
* Docs/notes updated if behavior or architecture changes.
* Rollout/rollback risk considered if risky.

## Out of Scope (explicit)

* Large rewrite of the whole WebUI or backend runtime.
* Behavior changes to task scheduling, sending logic, login/auth, or API response formats unless a selected refactor requires a small compatible internal adjustment.
* Reverting unrelated dirty working-tree changes.
* Deleting the entire legacy bridge in one pass; this task should remove/collapse one safe slice only.

## Technical Approach

Work in dependency order:

1. Extract common frontend allocation-task mechanics that are already shared conceptually across keepalive, double-card, and expiring-gift pages.
2. Expand backend task metadata only enough to remove a clear repeated switch/map, while keeping task-specific runner functions explicit where behavior differs.
3. Delete or collapse one legacy bridge slice that no longer owns UI behavior, then update `test/project-maintenance-contract.test.js` to assert the new boundary.

## Decision (ADR-lite)

**Context**: User asked to complete all three identified simplification directions, but the repo still has migration-era compatibility tests and a dirty working tree with unrelated Trellis changes.

**Decision**: Implement all three as staged, behavior-preserving slices in one task, with the legacy bridge work limited to one safe deletion/collapse slice.

**Consequences**: The task is broader than a single MVP, so verification must run across lint, type-check, and contract tests. Larger bridge deletion remains future work after this slice proves safe.

## Technical Notes

* Task directory: `.trellis/tasks/05-13-code-refactor-optimization`
* Relevant quality contract: `test/project-maintenance-contract.test.js` encodes many WebUI migration invariants and bridge expectations.
* Implementation completed:
  * Added `createFanListNote` and `createFanListEmptyText` in `src/docker/webui/task-shared.ts`, then reused them from keepalive, double-card, and expiring-gift pages.
  * Added task metadata helpers for not-configured messages, active checks, and schedule summaries in `src/docker/task-metadata.ts`, then reused them from scheduler/task runner code.
  * Deleted `src/docker/webui/events.ts`, moved its remaining event binding/auto-refresh responsibilities into `src/docker/webui/legacy-app.ts`, and removed the bridge install from `src/docker/webui/main.ts`.
  * Updated `test/project-maintenance-contract.test.js` to assert the new no-events-bridge contract.
* Verification completed:
  * `npm run lint`
  * `npm run type-check`
  * `npm run test:contracts`
  * `npm test`
* Relevant source clusters inspected:
  * `src/docker/webui/task-shared.ts`
  * `src/docker/webui/allocation-task.ts`
  * `src/docker/webui/keepalive.ts`
  * `src/docker/webui/double.ts`
  * `src/docker/webui/expiring.ts`
  * `src/docker/task-metadata.ts`
  * `src/docker/runtime-task-runners.ts`
  * `src/docker/runtime-scheduler.ts`
  * `src/core/task-defaults.ts`
  * `src/core/gift.ts`
  * `src/core/job.ts`

## Research References

* [`research/current-refactor-candidates.md`](research/current-refactor-candidates.md) — Current repo-specific candidates after accounting for cleanup already completed since the older archived review.
