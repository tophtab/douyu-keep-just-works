# brainstorm: optimize program plan

## Goal

Design a low-risk optimization plan for the current Docker WebUI application that improves maintainability and reduces complexity without changing the existing user-visible behavior, API contracts, saved config format, task scheduling semantics, or Docker-first build/test flow.

## What I already know

* User asked to optimize the program and design a plan.
* User explicitly requested not to use sub-agents; all inspection and research are inline.
* The repository is a Node.js 24 TypeScript app with shared Douyu logic in `src/core/`, Docker backend/runtime code in `src/docker/`, and Vue/Vite WebUI code in `src/docker/webui/`.
* The maintained product surface is the Docker WebUI for NAS/home-server long-running usage.
* Current quality gates are `npm run lint`, `npm run type-check`, `npm run test:contracts`, `npm test`, and Docker/Vite builds through the existing npm scripts.
* Recent archived optimization tasks already centralized task metadata, removed legacy WebUI bridge files, added task-page action helpers, strengthened allocation helpers, and updated maintenance contracts.
* The current largest/high-signal hotspots are `src/docker/webui/resource-state.ts`, `src/core/job.ts`, `src/core/medal-sync.ts`, `src/docker/runtime.ts`, `src/core/api.ts`, `src/docker/webui/cookie.ts`, `src/docker/webui/expiring.ts`, and `src/docker/webui/double.ts`.
* `test/project-maintenance-contract.test.js` strongly protects the Vue-only WebUI boundary and current resource-state ownership assumptions.
* `test/request-smoothing-contract.test.js` protects frontend request coalescing/stale-response behavior and backend cache TTL/pending-promise behavior.

## Assumptions (temporary)

* "优化程序" means maintainability/code-structure optimization first, not changing product behavior or adding features.
* The next useful optimization should avoid repeating the refactors already completed today.
* Behavior-preserving WebUI state cleanup is safer as an MVP than refactoring core task execution in the same pass.
* No new framework, global store, or runtime dependency should be introduced for this optimization.

## Open Questions

* None. User chose to include all identified optimization areas.

## Requirements (evolving)

* Preserve current Docker WebUI behavior and Chinese user-facing copy.
* Preserve public API routes and response shapes.
* Preserve saved config format and existing migration/normalization behavior.
* Preserve task scheduling, manual trigger behavior, cache invalidation, and request coalescing semantics.
* Avoid reintroducing legacy WebUI bridge files, imperative app mounting, or `window.DOUYU_KEEP_WEBUI_*` globals beyond the existing bootstrap.
* Keep changes reviewable and reversible in small slices.
* Update contract tests if ownership boundaries move.
* Include all three optimization areas in this task:
  * split WebUI resource-state ownership while preserving request coalescing and public imports;
  * consolidate nearby frontend helper duplication;
  * refactor core task execution helpers around gift/backpack/double-card flows without changing runtime behavior.

## Acceptance Criteria (evolving)

* [x] Optimization scope is confirmed before implementation.
* [x] Chosen plan avoids repeating recently completed optimization tasks.
* [x] Any WebUI resource-state split preserves existing exports or updates all import sites intentionally.
* [x] Request coalescing and stale-response protections remain covered by tests.
* [x] Core task helper extraction preserves send order, delays, failed-count carry-over, gift-id assignment, double-card filtering, and existing log semantics.
* [x] Focused tests cover extracted core pure helpers where behavior can be verified without live Douyu calls.
* [x] Public behavior, route responses, saved config, and task execution semantics remain compatible.
* [x] `npm run lint` passes after implementation.
* [x] `npm run type-check` passes after implementation.
* [x] `npm test` passes after implementation.

## Definition of Done (team quality bar)

* Tests added/updated where ownership or behavior contracts move.
* Lint, typecheck, and relevant tests are green.
* Docs/notes updated if architecture or behavior contracts change.
* Rollout/rollback considered if risky.

## Research References

* [`research/current-optimization-candidates.md`](research/current-optimization-candidates.md) - Repo-local candidate review after accounting for recent archived optimization tasks.

## Research Notes

### Feasible approaches

**Approach A: WebUI resource-state split + small shared helper cleanup**

* How it works: split `resource-state.ts` by ownership into focused modules while keeping a compatibility facade, then consolidate only nearby shared frontend helpers such as unauthorized/error and cookie-source readiness logic.
* Pros: best maintainability payoff with low user-visible risk; directly targets the largest WebUI file; aligns with Vue-only state guidelines; can be protected by existing contract tests.
* Cons: requires careful import and contract-test updates; still leaves core task execution complexity for a follow-up.

**Approach B: Core task execution cleanup first**

* How it works: refactor `src/core/job.ts` by extracting gift grouping, send-job preparation, active double-card detection, and backpack/gift helper logic into narrower helpers.
* Pros: improves the most business-critical logic and enables focused tests around gift selection.
* Cons: higher risk because it touches real task execution, send order, delays, failure carry-over, and log semantics.

**Approach C: Broad backend + frontend polish pass**

* How it works: apply smaller cleanups across WebUI helpers, backend equality predicates, runtime config-change checks, and remaining duplicate wrappers.
* Pros: lower individual change risk and broad cleanup coverage.
* Cons: can become scattered, harder to review, and less satisfying than a focused high-value slice.

## Decision (ADR-lite)

**Context**: The repo has already completed several low-risk cleanup passes today. The remaining high-value areas are split between WebUI state ownership and core task execution complexity.

**Decision**: Include all identified optimization areas in this task, but implement them as staged slices: WebUI resource-state split first, frontend helper cleanup alongside it, then core task execution helper extraction with focused tests.

**Consequences**: This gives the broadest maintainability improvement, but touches more behavior-adjacent code. Verification must include lint, type-check, full tests, and focused coverage for any extracted core gift/task helpers. Each slice should remain revertible independently.

## Expansion Sweep

### Future evolution

* If more WebUI pages or resources are added, a smaller resource-state ownership model will make additions less risky.
* If more task types are added, core task execution may later need dedicated gift-task primitives and tests.

### Related scenarios

* Config save, CookieCloud sync, overview refresh, task pages, logs, fans status, and yuba status must keep their refresh/invalidation behavior consistent.
* Contract tests should continue to encode migration boundaries so old WebUI bridge patterns do not return.

### Failure and edge cases

* Unauthorized responses should continue to flow through the auth path without noisy duplicate toasts.
* Concurrent refreshes should continue to reuse pending requests and ignore stale responses.
* Missing Cookie/CookieCloud configuration should continue to clear cookie-backed state and show existing guidance.

## Technical Approach

Chosen full-scope plan:

1. Split WebUI resource state into focused modules while keeping `resource-state.ts` as the public facade during the first pass.
2. Move request coalescing/stale-response helpers into a small resource-request helper module and keep tests asserting pending/request-sequence semantics.
3. Move fans and yuba resource state into sibling modules only after the facade contract is clear.
4. Consolidate small duplicated frontend helpers near the touched code, especially unauthorized/error and cookie-source readiness helpers.
5. Extract core gift-task execution helpers from `src/core/job.ts` in a behavior-preserving way, prioritizing pure helper boundaries for gift grouping, gift-id stamping, target-count preparation, and double-card active-room detection.
6. Add focused tests for extracted pure core helpers where practical before or alongside moving behavior.
7. Update `test/project-maintenance-contract.test.js` and `test/request-smoothing-contract.test.js` to reflect the new ownership without weakening current guarantees.

## Implementation Summary

* Split WebUI resource ownership into focused modules:
  * `src/docker/webui/resource-request.ts` for pending-request and stale-response tracking.
  * `src/docker/webui/resource-config.ts` for default/raw config state and config loading.
  * `src/docker/webui/resource-fans.ts` for fans sync/list/status/gift state.
  * `src/docker/webui/resource-yuba.ts` for yuba status state.
  * `src/docker/webui/resource-state.ts` remains the compatibility facade for existing page imports and top-level refresh orchestration.
* Consolidated nearby WebUI helper usage in `cookie.ts` and `yuba.ts` by reusing shared unauthorized and cookie-source helpers.
* Added `src/core/gift-task.ts` for core gift-task helper boundaries:
  * enabled-room filtering for double-card send config;
  * gift send group construction from expiring selection summaries;
  * gift-id stamping for prepared send jobs;
  * positive target counting;
  * active double-card room detection.
* Updated `src/core/job.ts` to use those helpers while preserving task orchestration, send order, sleeps, failed-count carry-over, and log text.
* Added `test/gift-task-contract.test.js` for pure helper behavior.
* Updated maintenance and request-smoothing contract tests for the new resource ownership boundaries.

## Verification

* [x] `npm run type-check`
* [x] `npm run lint`
* [x] `npm run test:contracts`
* [x] `npm test`

## Implementation Plan (small PRs)

### PR1: WebUI resource request and facade split

* Extract request coalescing/stale-response bookkeeping from `resource-state.ts` into a focused helper module.
* Keep `resource-state.ts` exporting the same public names so page modules can migrate gradually.
* Update request smoothing contracts to assert the new helper/facade ownership.

### PR2: WebUI fans/yuba/config state ownership split

* Move fans list/sync/status and yuba status state into sibling modules behind the facade.
* Move raw config/default config/log helpers only where the boundary remains obvious.
* Consolidate duplicated unauthorized/error and cookie-source helper logic while touching these modules.

### PR3: Core task execution helper extraction

* Extract pure or near-pure helper boundaries from `src/core/job.ts` for gift grouping and send-job preparation.
* Keep task orchestration functions, send order, sleeps, and logging behavior stable.
* Add focused tests for helper behavior that does not require live Douyu requests.

### PR4: Final contract polish and verification

* Update maintenance contracts for final module ownership.
* Remove dead wrappers introduced during migration.
* Run `npm run lint`, `npm run type-check`, and `npm test`.

## Out of Scope (explicit)

* Changing Douyu task behavior, send logic, scheduling semantics, cache TTLs, or retry/delay behavior.
* Full rewrite of `src/core/job.ts`; only focused helper extraction is included.
* Adding Pinia/Vuex/React Query/SWR or other state-management/runtime dependencies.
* Visual redesign or UX copy rewrite.
* Changing public API routes, response shapes, saved config shape, or Docker deployment behavior.
* Reintroducing legacy WebUI bridge modules/globals.
