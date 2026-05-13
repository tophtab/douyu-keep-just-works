# Optimize and Simplify Code Plan

## Goal

Design a low-risk refactor plan that reduces duplicated task/page/runtime code while preserving the Docker-first TypeScript backend, Vue-only WebUI, existing API behavior, Chinese user-facing messages, and current build/test contracts.

## What I Already Know

* User wants a plan for optimizing and simplifying code, not implementation yet.
* User explicitly requested no sub-agent usage; all repo inspection was done inline.
* The project is a Node.js 24, TypeScript, Express 5, Vue 3/Vite Docker WebUI app.
* Backend task-wide metadata already has a central home in `src/docker/task-metadata.ts`.
* Frontend shared task helpers already exist in `src/docker/webui/task-shared.ts` and `src/docker/webui/allocation-task.ts`.
* Current contract tests strongly protect Vue-only WebUI ownership, deleted legacy bridge files, Vite build output, Node 24 alignment, and shared resource functions.

## Assumptions

* The refactor should be behavior-preserving unless a bug is discovered while implementing.
* The first pass should prioritize maintainability and code size over architectural novelty.
* No new state-management library, framework, or runtime dependency should be introduced.

## Requirements

* Preserve all current Docker runtime and WebUI behavior.
* Keep public API routes and response shapes stable.
* Keep existing Chinese user-facing messages stable unless the exact duplicate message is being centralized.
* Reduce repeated task/page plumbing in small, reviewable steps.
* Favor existing project patterns over a large rewrite.
* Update contract tests when moving ownership of route, WebUI resource, or task lifecycle behavior.
* MVP scope is the recommended range: backend low-risk cleanup plus WebUI task-page helper extraction.
* Defer `resource-state.ts` module decomposition to a later task unless a tiny helper extraction is required by the MVP.

## Acceptance Criteria

* [ ] `npm run lint` passes.
* [ ] `npm run type-check` passes.
* [ ] `npm test` passes.
* [ ] Refactor keeps `/api/config`, `/api/overview`, `/api/trigger/:type`, fans status, yuba status, and logs behavior compatible.
* [ ] No legacy WebUI bridge files or `window.DOUYU_KEEP_WEBUI_*` globals are reintroduced.
* [ ] No secrets are exposed in config responses, logs, tests, or docs.
* [ ] Contract tests are updated if core file ownership, route helpers, or WebUI resource ownership changes.

## Definition of Done

* Tests added or updated where architecture or behavior contracts move.
* Lint, type-check, and Docker build quality gates are green.
* Refactor is split into small commits/PRs that can be reviewed independently.
* Rollback is simple: each PR should be revertible without depending on later PRs.

## Technical Notes

### Files Inspected

* `package.json` - Node 24, lint/type-check/build/test scripts.
* `README.md` - Docker WebUI is the maintained product surface.
* `.trellis/spec/backend/*` - Docker-first runtime, centralized task metadata, stable JSON error patterns.
* `.trellis/spec/frontend/*` - Vue-only runtime, no global store, keep shared server state in `resource-state.ts`.
* `test/project-maintenance-contract.test.js` - broad architecture contract and deleted legacy file guarantees.
* `src/docker/runtime.ts` - runtime composition, config application, CookieCloud scheduling, task scheduling, API context.
* `src/docker/runtime-scheduler.ts` - task scheduling, locks, status tracking.
* `src/docker/runtime-task-runners.ts` - manual and scheduled task execution.
* `src/docker/task-metadata.ts` - task labels, task list, active checks, schedule summaries.
* `src/docker/server-config-routes.ts` - config/overview/logs routes and validation.
* `src/docker/server-route-utils.ts` - shared JSON error/result helpers.
* `src/docker/webui/resource-state.ts` - shared frontend server state and request coalescing.
* `src/docker/webui/task-shared.ts` - task page save/disable/trigger and card helpers.
* `src/docker/webui/collect.ts`, `keepalive.ts`, `double.ts`, `expiring.ts`, `yuba.ts` - page composables with repeated enable/save/disable/trigger/resource-sync structure.
* `src/docker/webui/allocation-task.ts` - shared allocation row/send-map helpers.

### Main Refactor Hotspots

* `src/docker/webui/resource-state.ts` is the largest single WebUI module and mixes raw config, overview, logs, fans, yuba, invalidation, request tracking, and cookie-backed clearing.
* Task page composables repeat the same structure: local refs, `isUnauthorizedError`, config fallback, `applyResourceState`, save/disable, trigger, task card, toggle handler, and cron preview.
* `keepalive`, `doubleCard`, and `expiringGift` share allocation-task mechanics with small task-specific differences.
* Backend task execution has two switch layers: `triggerRuntimeTask` and scheduler `runScheduledTask`.
* `isTaskActive`, cookie-source checks, and error-message normalization have near-duplicates across backend/frontend modules, though some are intentionally layer-local.
* `server-config-routes.ts` can benefit from extracting validation/payload assembly to keep route handlers thinner.

## Research Notes

### What Similar Local Patterns Suggest

* The codebase already centralizes task metadata instead of scattering task facts.
* The frontend already uses composables and shared helpers rather than a store.
* Route helpers are already small and procedural, so a helper-based refactor fits better than adding a router framework.
* Existing tests prefer architecture contracts over snapshot-style assertions.

### Constraints From Specs

* Keep Docker path working first.
* Do not reintroduce legacy WebUI modules or imperative bridge patterns.
* Do not add a state-management library for local page state.
* Do not duplicate task-wide facts such as labels, schedule summaries, active checks, or not-configured messages.
* Use `unknown` in catches and normalize errors.

## Feasible Approaches

### Approach A: Conservative Helper Extraction (Recommended)

How:

* Add a typed task definition layer for repeated WebUI task-page behavior while keeping each page composable as the owner of its form state and UI-specific computed text.
* Split `resource-state.ts` internally into narrow helper sections or small sibling modules only where ownership is obvious: request tracking, fans resources, yuba resources, logs/raw config/overview orchestration.
* Add backend helper maps for task execution to remove duplicate switches without changing route contracts.
* Extract config payload validation in `server-config-routes.ts` into a dedicated validation helper that returns the first user-facing error.

Pros:

* Lowest behavioral risk.
* Aligns with current specs and existing helper style.
* Easy to review in small PRs.

Cons:

* Does not fully eliminate all task-page boilerplate.
* Some duplication remains where pages have genuinely different copy or UI state.

### Approach B: Task Descriptor Refactor

How:

* Define richer task descriptors that include config key, defaults, cron defaults, route task type, overview keys, trigger refresh resources, and schedule card metadata.
* Drive backend scheduler/runners and frontend task pages from descriptors where possible.

Pros:

* Strong long-term consistency if more tasks are added.
* Removes more switch/case and repeated config fallback code.

Cons:

* Higher type complexity.
* More likely to obscure page-specific behavior, especially `doubleCard` and `expiringGift`.
* Needs broader contract test updates.

### Approach C: Resource-State Decomposition First

How:

* Start by splitting `resource-state.ts` into dedicated modules for core config/overview/logs, fans, yuba, and request tracking.
* Keep task pages mostly unchanged until server-state ownership is clearer.

Pros:

* Directly attacks the largest file.
* Improves navigation and lowers merge conflicts.

Cons:

* Less immediate reduction in repeated task-page code.
* Moving shared refs across files can be noisy and requires careful contract-test updates.

## Recommended Plan

### PR1: Backend Low-Risk Cleanup

* Extract config-section validation from `server-config-routes.ts` into a helper with stable messages.
* Convert scheduler/manual task execution to a single task-runner map where it improves clarity, keeping task-specific cookie/status logic in `runtime-task-runners.ts`.
* Reuse `task-metadata.ts` helpers wherever task labels, active checks, and configured checks are currently repeated.
* Add or update contract tests for route validation and task metadata ownership if file ownership changes.

### PR2: WebUI Task-Page Helper Extraction

* Introduce focused helpers for common task page actions: toggle save/disable, scheduled task card building, common trigger refresh list, and config fallback defaults.
* Keep copy, page-specific computed state, and table row logic in the existing page composables.
* Use `keepalive` as the first migration target, then apply the same pattern to `doubleCard` and `expiringGift`.
* Only migrate `collectGift` and `yubaCheckIn` if the helper remains simpler than the current direct code.

### Deferred: Shared Resource State Tidying

* Extract request-tracking helpers from `resource-state.ts`.
* Consider splitting fans and yuba resource loaders into sibling modules while preserving exported refs/functions expected by current pages and tests.
* Keep the public import surface stable during the first pass, or update `test/project-maintenance-contract.test.js` explicitly if exports move.

### PR3: Final Polish and Contracts

* Remove dead helpers and narrow overly broad types created during migration.
* Add focused contract tests for the new helpers if behavior moved from route/page modules.
* Run full quality gate: `npm run lint`, `npm run type-check`, `npm test`.

## Expansion Sweep

### Future Evolution

* If more task types are likely, reserve room for a task descriptor map, but do not force all current pages through it immediately.
* If WebUI grows more pages, resource ownership should become more modular before `resource-state.ts` becomes a de facto global store.

### Related Scenarios

* Config save, manual trigger, scheduled trigger, and overview refresh should remain consistent.
* Keep `collectGift`, fan tasks, and yuba task behavior visibly aligned without hiding their differences behind a too-generic abstraction.

### Failure and Edge Cases

* Preserve stale-request protection and in-flight request coalescing.
* Preserve unauthorized handling that silently delegates to auth flow.
* Preserve manual-trigger busy handling and scheduled-trigger skip behavior.

## Decision (ADR-lite)

**Context**: The repo already has central metadata and shared frontend helpers, but repeated task plumbing remains across backend scheduler/runners and WebUI task composables.

**Decision**: Use Approach A for the MVP. Implement backend low-risk cleanup plus WebUI task-page helper extraction. Defer full `resource-state.ts` decomposition.

**Consequences**: This should reduce code size and future task-change risk without creating a large descriptor system. Some duplication will remain intentionally where abstraction would make the code harder to read.

## Implementation Summary

* Added `hasActiveTaskConfig` to backend task metadata and reused it from runtime/config overview readiness.
* Extracted config payload validation in config routes into `validateConfigPayload`.
* Replaced scheduler-local scheduled task dispatch with shared `runRuntimeTask` from runtime task runners.
* Added WebUI `task-page-actions.ts` for common task page save/disable/toggle/trigger/card mechanics.
* Migrated `collectGift`, `keepalive`, `doubleCard`, and `expiringGift` task pages to the shared task-page action helpers while keeping page-specific copy and table logic local.
* Updated architecture contract tests for the new helper ownership boundaries.

## Verification

* [x] `npm run lint`
* [x] `npm run type-check`
* [x] `npm test`

## Out of Scope

* Rewriting the WebUI state layer with Pinia/Vuex/React Query/SWR.
* Changing public API routes or response shapes.
* Replacing Express, Vue, Vite, cron, or the JSON config model.
* Visual redesign or UX behavior changes.
* Reworking Douyu core API scraping/business logic unless a concrete duplicate or bug is found during implementation.
* Full `resource-state.ts` decomposition in this MVP.

## Open Questions

* None.
