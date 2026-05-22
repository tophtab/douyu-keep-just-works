# brainstorm: code optimization opportunities

## Goal

Implement two practical code optimizations in this repository: a focused frontend task-page abstraction and a backend config-route async/error-handling cleanup, without changing user-facing behavior.

## What I already know

* User asked via `trellis-brainstorm` for possible code optimizations.
* Repository is Trellis-managed and currently has no active implementation task.
* Working tree already had unrelated `.trellis/` modifications before this brainstorm started.
* Project is a TypeScript Docker-first app with Vue/Vite WebUI.
* Quality gates already exist: `npm run lint`, `npm run type-check`, contract tests via `node --test`, and Docker build through `npm run test`.
* Maintained code is split across `src/core/`, `src/docker/`, and `src/docker/webui/`.
* Existing contract tests intentionally guard recent architecture choices such as Vue-only WebUI, request coalescing, and shared task metadata.

## Assumptions (temporary)

* "Code optimization" may include maintainability, reliability, performance, type safety, testability, and workflow ergonomics.
* The first useful output is a prioritized set of candidate improvements, not immediate code changes.

## Open Questions

* None for MVP implementation.

## Requirements (evolving)

* Inspect the codebase before asking the user for context.
* Produce concrete optimization candidates with trade-offs.
* Implement candidate A: frontend task-page abstraction.
* Implement candidate B: backend route async/error handling cleanup.
* Preserve existing Docker-first build and contract-test expectations.

## Candidate Optimizations

### A. Frontend task-page abstraction (recommended first)

* Evidence: `keepalive.ts`, `double.ts`, and `expiring.ts` repeat the same shape: local refs for overview/config/fans/loading state, `applyResourceState`, payload building, save/disable/trigger handlers, task card computed state, fan-list messages, table visibility, cron preview, and watcher registration.
* Likely implementation: introduce a small composable/factory for common fans-backed scheduled task state, while keeping task-specific payload, validation, labels, and extra computed state local.
* Benefit: reduces duplicate code in the largest WebUI task modules without changing user-facing behavior.
* Risk: over-abstracting can make page-specific behavior harder to read; should be done incrementally and backed by contract tests.

### B. Backend route async/error handling cleanup

* Evidence: `server-fans-routes.ts` and `server-cookie-source-routes.ts` already use `sendJsonResult`, while `server-config-routes.ts` still mixes sync handlers, manual `try/catch`, and `.then().catch()`.
* Likely implementation: extend route utilities for common `{ ok, data }` responses and convert config mutation routes to `async`/`await`.
* Benefit: fewer inconsistent 500/400 paths and easier future route additions.
* Risk: route status/error semantics are user-visible; needs focused contract coverage.

### C. Shared utility consolidation

* Evidence: `errorMessage(error: unknown)` appears in multiple backend/core modules, and `jsonEquals` appears in both runtime scheduling and runtime config logic.
* Likely implementation: move tiny stable helpers to shared backend/core utility modules, only where reuse is already proven.
* Benefit: small maintainability gain and fewer copy-paste fixes.
* Risk: too many generic utility modules can reduce locality; keep this opportunistic, not a broad cleanup.

### D. Runtime cache and scheduling tests

* Evidence: `runtime-cache.ts` contains non-trivial TTL, generation, pending-promise, and concurrency logic; `runtime-scheduler.ts` handles lock, restart, and status updates. Existing tests assert structure but not much behavior.
* Likely implementation: add behavior-level contract tests around cache invalidation/coalescing and scheduler reload decisions.
* Benefit: enables safer future refactors and catches race regressions.
* Risk: mocking cron and async timing can make tests brittle if not kept narrowly scoped.

### E. Contract-test maintainability pass

* Evidence: `project-maintenance-contract.test.js` is a large structural test that reads many files and asserts broad patterns.
* Likely implementation: split high-level architecture contracts from WebUI migration guardrails and helper utilities.
* Benefit: easier review when architecture intentionally changes.
* Risk: splitting without reducing over-specific assertions does not improve much; needs careful naming and scope.

## Acceptance Criteria (evolving)

* [x] Candidate optimizations are grounded in inspected files, configs, or existing specs.
* [x] MVP scope is explicit.
* [x] Out-of-scope items are recorded.
* [x] Selected optimization has a small implementation surface and a clear verification command.
* [x] Common fans-backed task-page state is extracted without hiding page-specific behavior.
* [x] `server-config-routes.ts` no longer mixes `.then().catch()` with route-local async handling for `/api/config`.
* [x] Existing WebUI behavior, route response shapes, and Docker build flow remain compatible.

## Definition of Done (team quality bar)

* Tests added/updated if implementation follows.
* Lint / typecheck / CI green if implementation follows.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Large rewrites without a narrower follow-up implementation task.
* Replacing current framework/build tooling.
* Adding new dependencies unless a selected MVP explicitly requires it.
* Candidate C, D, and E unless needed to support candidates A/B.

## Technical Approach

* Add a narrow WebUI helper/composable for common fans-backed scheduled task page state used by keepalive, double-card, and expiring-gift pages.
* Keep task-specific config normalization, payload creation, validation, copy, and special computed state in each existing page module.
* Extend or reuse backend route helpers so `/api/config` can be expressed as an async route with centralized JSON error response handling.
* Update structural contract tests only where they intentionally track the new helper/route shape.

## Decision (ADR-lite)

**Context**: The repository already has quality gates and recent architecture guardrails; optimization should reduce duplication without broad rewrites.

**Decision**: Implement candidate A and candidate B together as the MVP.

**Consequences**: This improves maintainability in two high-signal areas while leaving deeper runtime behavior tests, broad utility consolidation, and contract-test splitting for later tasks.

## Technical Notes

* Initial task path: `.trellis/tasks/05-22-code-optimization-opportunities`.
* Inspected `package.json`, `README.md`, `eslint.config.mjs`, `vite.config.ts`, backend/frontend spec indexes.
* Inspected WebUI task modules: `src/docker/webui/keepalive.ts`, `src/docker/webui/double.ts`, `src/docker/webui/expiring.ts`, `src/docker/webui/task-shared.ts`, `src/docker/webui/task-page-actions.ts`, `src/docker/webui/resource-fans.ts`.
* Inspected backend/runtime modules: `src/docker/server-config-routes.ts`, `src/docker/server-route-utils.ts`, `src/docker/runtime-scheduler.ts`, `src/docker/runtime-cache.ts`, `src/docker/runtime-task-runners.ts`.
* Inspected contract tests: `test/project-maintenance-contract.test.js`, `test/request-smoothing-contract.test.js`, `test/core-api-sorting-contract.test.js`, `test/gift-task-contract.test.js`.
* Optimization should account for existing tests that intentionally prevent legacy WebUI reintroduction, client cooldowns, Express rate limiter dependency, and task scheduler duplication.
* Implemented `src/docker/webui/fans-backed-task-page.ts` for shared fans-backed task-page resource state.
* Updated `keepalive.ts`, `double.ts`, and `expiring.ts` to use the shared helper while keeping task-specific payloads, validation, text, and computed state local.
* Added `sendJsonOk` in `src/docker/server-route-utils.ts` and converted config mutation routes in `src/docker/server-config-routes.ts` to async shared-error-helper style.
* Updated `test/project-maintenance-contract.test.js` to cover the new helper ownership and backend route helper contract.
* Verification passed: `npm run lint`, `npm run type-check`, `npm run test:contracts`, `npm test`, and `git diff --check`.
