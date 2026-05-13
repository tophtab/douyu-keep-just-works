# brainstorm: optimize and simplify code

## Goal

Simplify the current TypeScript/Vue codebase across all currently identified optimization spaces: frontend allocation task-page duplication, WebUI resource/legacy-state boundary complexity, and backend task metadata/routing duplication, without changing user-visible Docker WebUI or backend task behavior.

## What I already know

* User asked for "优化、精简代码" and explicitly invoked `trellis-brainstorm`, so this needs a scoped Trellis task instead of a broad ad hoc cleanup.
* The repo is a Node 24 TypeScript project with shared Douyu logic in `src/core/`, Docker/Express runtime in `src/docker/`, and a Vite/Vue Docker WebUI in `src/docker/webui/`.
* Quality gates are available through `npm run lint`, `npm run type-check`, `npm run test:contracts`, and `npm test`.
* The working tree already has unrelated Trellis changes/deletions. This task must not revert or silently include unrelated work.
* A recent completed task already handled one round of code simplification:
  * shared WebUI task helpers in `src/docker/webui/task-shared.ts`
  * allocation helpers in `src/docker/webui/allocation-task.ts`
  * backend task metadata helper expansion
  * deletion of `src/docker/webui/events.ts`
* Current large/high-signal files include `src/docker/webui/resources.ts`, `src/docker/webui/legacy-state.ts`, `src/docker/webui/yuba.ts`, `src/docker/webui/cookie.ts`, `src/docker/webui/keepalive.ts`, `src/docker/webui/double.ts`, and `src/docker/webui/expiring.ts`.
* The WebUI remains in a transitional state: Vue components own visible surfaces, while `installLegacy*Bridge` modules still provide compatibility and state/resource plumbing.
* `keepalive.ts`, `double.ts`, and `expiring.ts` still share a visible allocation-task shape: refs, config fallback, apply-detail handling, save/disable/trigger flow, table visibility, model/value labels, and legacy bridge initialization.
* `resources.ts` and `legacy-state.ts` are still large bridge/resource modules, but they are tied to request coalescing and WebUI migration contract tests.

## Assumptions (temporary)

* Best next move is a staged, behavior-preserving refactor across the identified optimization areas, not a whole-project rewrite.
* Each slice should reduce code the project still actively uses, not just move code around.
* Existing contract tests should continue to protect migration boundaries; tests should be updated only when the task intentionally changes a contract.

## Open Questions

* None. User confirmed the full set of identified optimization spaces should be completed in this task.

## Requirements (evolving)

* Preserve current Docker WebUI and backend behavior.
* Avoid changing API response formats, saved config formats, task scheduling semantics, auth/login behavior, or user-facing copy unless explicitly required.
* Complete all three identified behavior-preserving refactor areas:
  * Extract more shared allocation task page mechanics from keepalive, double-card, and expiring-gift pages where the shared shape is still explicit.
  * Simplify one or more WebUI resource/legacy-state boundaries, especially pure helper clusters or bridge responsibilities that can be made clearer without weakening request coalescing/auth/resource contracts.
  * Clean up backend task metadata/routing duplication where inspection finds repeated task maps/switches that can become metadata-driven without hiding task-specific behavior.
* Reduce duplication, module size, or transitional bridge surface in the chosen areas.
* Keep changes small enough to verify with lint, type-check, and contract tests.

## Acceptance Criteria (evolving)

* [x] Full optimization scope is explicitly chosen and documented.
* [x] Frontend allocation task-page duplication is measurably reduced.
* [x] WebUI resource/legacy-state boundary complexity is measurably reduced or clarified.
* [x] Backend task metadata/routing duplication is measurably reduced where a safe target exists.
* [x] Existing behavior is preserved.
* [x] Contract tests are updated only if the chosen refactor changes a migration/maintenance contract.
* [x] `npm run lint`, `npm run type-check`, and relevant tests pass.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI-equivalent commands are green.
* Docs/notes updated if behavior or architecture changes.
* Rollout/rollback risk considered if risky.

## Out of Scope (explicit)

* Broad rewrite of the WebUI, backend runtime, or all legacy bridges in one pass.
* Behavior changes to task execution, scheduling, auth, Douyu API calls, or config persistence.
* Reverting unrelated dirty working-tree changes.
* Repeating the already completed `05-13-code-refactor-optimization` task.

## Technical Approach

Work in dependency/risk order:

1. Inspect the current code to avoid repeating the already archived refactor and identify the exact remaining duplication in each candidate area.
2. Extract frontend allocation page mechanics only where keepalive, double-card, and expiring-gift still share behavior directly.
3. Simplify a safe WebUI resource/legacy-state helper or bridge boundary while preserving request smoothing, auth, and protected-state contracts.
4. Clean up backend task metadata/routing repetition only where a straightforward metadata helper improves clarity.
5. Run lint, type-check, and relevant contract/tests after implementation.

## Decision (ADR-lite)

**Context**: User wants the complete set of optimization opportunities found during planning, not a narrowed MVP.

**Decision**: Implement the full identified scope in staged slices, keeping each change behavior-preserving and bounded by existing tests/contracts.

**Consequences**: The task is broader than a single cleanup slice. Verification must cover frontend and backend contracts, and any risky bridge/resource change should either be backed by existing tests or receive focused contract coverage.

## Technical Notes

* Task directory: `.trellis/tasks/05-13-optimize-simplify-code`
* Previous related task: `.trellis/tasks/archive/2026-05/05-13-code-refactor-optimization/prd.md`
* Relevant maintenance test: `test/project-maintenance-contract.test.js`
* Relevant request smoothing test: `test/request-smoothing-contract.test.js`
* Spec indexes found:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/backend/index.md`
  * `.trellis/spec/guides/index.md`
* Implementation completed:
  * Added shared allocation-page helpers in `src/docker/webui/task-shared.ts` for legacy fan-task deps, paired fan-list messages, trigger refresh lists, table visibility, value labels, and current-config fallback.
  * Reused those helpers from `src/docker/webui/keepalive.ts`, `src/docker/webui/double.ts`, and `src/docker/webui/expiring.ts` while preserving task-specific payloads, copy, validation, and backpack/double-card behavior.
  * Moved the no-cookie resource refresh clearing responsibility in `src/docker/webui/resources.ts` to the protected-state helper by passing `clearCookieBackedData` through `src/docker/webui/actions.ts`.
  * Added `getTaskCron` and consolidated scheduled task startup in `src/docker/runtime-scheduler.ts`; manual trigger dispatch is centralized through `triggerRuntimeTask` in `src/docker/runtime-task-runners.ts`.
  * Updated `test/project-maintenance-contract.test.js` to protect the new resource boundary and metadata-driven scheduling contract.
* Verification completed:
  * `npm run type-check`
  * `npm run lint`
  * `npm run test:contracts`
  * `npm test`

## Research References

* [`research/current-refactor-candidates.md`](research/current-refactor-candidates.md) - Repo-local candidate review after accounting for the already completed refactor task.
