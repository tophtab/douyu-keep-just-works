# Current Optimization Candidates

## Context

The user asked for an optimization plan and explicitly requested no sub-agent usage. This review was done inline against the current repository state on 2026-05-13.

The project is a Node.js 24 TypeScript app with:

* shared Douyu API and task logic in `src/core/`
* Docker runtime, Express routes, scheduling, config IO, cache, and logs in `src/docker/`
* Vue/Vite Docker WebUI in `src/docker/webui/`
* contract tests in `test/`

Recent archived tasks already completed several cleanup passes:

* `05-13-code-refactor-optimization`
* `05-13-optimize-simplify-code`
* `05-13-optimize-code-plan`

Those tasks centralized task metadata, removed legacy WebUI bridge files, added `task-page-actions.ts`, strengthened allocation helpers, and protected the Vue-only WebUI boundary with contract tests.

## Files and Signals Inspected

* `package.json`
* `README.md`
* `.trellis/spec/backend/index.md`
* `.trellis/spec/frontend/index.md`
* `test/project-maintenance-contract.test.js`
* `test/request-smoothing-contract.test.js`
* `src/docker/webui/resource-state.ts`
* `src/docker/webui/cookie.ts`
* `src/docker/webui/yuba.ts`
* `src/docker/webui/double.ts`
* `src/docker/webui/expiring.ts`
* `src/docker/runtime.ts`
* `src/docker/runtime-scheduler.ts`
* `src/docker/runtime-cache.ts`
* `src/core/job.ts`
* `src/core/api.ts`
* `src/core/medal-sync.ts`

Largest current source hotspots by line count:

* `src/docker/webui/resource-state.ts` - 680 lines
* `src/core/job.ts` - 415 lines
* `src/core/medal-sync.ts` - 361 lines
* `src/docker/runtime.ts` - 335 lines
* `src/core/api.ts` - 327 lines
* `src/docker/webui/cookie.ts` - 325 lines
* `src/docker/webui/expiring.ts` - 320 lines
* `src/docker/webui/double.ts` - 318 lines

## Current Constraints

* Keep Docker WebUI as the maintained product surface.
* Keep Vue-only WebUI runtime; do not reintroduce legacy bridge modules or global imperative WebUI hooks.
* Keep API routes, saved config shape, task scheduling semantics, and user-facing Chinese copy stable unless a specific bug requires a compatible internal fix.
* Preserve request coalescing and stale-response protection in WebUI resource loading.
* Preserve backend cache TTLs and pending-promise coalescing as the authoritative throttle layer.
* Avoid adding new framework/state-management/runtime dependencies for cleanup work.

## Candidate A: Split WebUI Resource State by Ownership

### What

`src/docker/webui/resource-state.ts` currently owns raw config, overview, logs, fans list/sync/status, yuba status, request coalescing, stale-response tracking, cookie-backed clearing, and active-tab loading. It is the largest WebUI module and is heavily asserted by contract tests.

Split it by stable ownership while preserving import compatibility through a facade:

* `resource-request.ts` for request coalescing and stale-response tracking
* `resource-config.ts` for raw config/default config helpers
* `resource-fans.ts` for fans sync/list/status/gift state
* `resource-yuba.ts` for yuba status state
* keep `resource-state.ts` as a facade re-exporting the existing public surface during migration

### Pros

* Directly reduces the largest current file.
* Lowers merge conflicts and makes future state changes easier.
* Preserves existing page imports if facade exports remain stable.

### Cons

* Contract tests will need careful updates to assert the facade/new ownership without weakening the request smoothing guarantees.
* The migration can become noisy if done all at once.

## Candidate B: Extract Core Gift-Task Execution Helpers

### What

`src/core/job.ts` mixes task orchestration, backpack status loading, gift candidate selection, gift send loops, double-card detection, logging text, and yuba dispatch. Some repetition remains around:

* loading gift/backpack state
* sleeping before gift send
* computing gift groups then applying `giftId`
* target-count logging before `sendGifts`
* expiring and double-card limited-time gift grouping

Extract narrow helpers without changing behavior:

* `src/core/gift-task.ts` or sibling helpers for gift group construction and send-job finalization
* a helper for "compute jobs, stamp giftId, log target count, send"
* a helper for active double-card room detection if it stays readable

### Pros

* Reduces risk in the most business-critical long file by isolating pure-ish transformations.
* Enables focused unit tests around candidate grouping and send-job preparation.
* Makes task behavior easier to review before future Douyu API changes.

### Cons

* Higher behavioral risk than pure WebUI file splitting because it touches task execution.
* Must be very careful not to change send order, retry carry-over, delays, or log semantics.

## Candidate C: Consolidate Shared Frontend Error/Credential Helpers

### What

Small duplicates remain across WebUI composables:

* `isUnauthorizedError` wrappers in `cookie.ts`, `yuba.ts`, and `resource-state.ts`
* cookie-source readiness logic in both `cookie.ts` and shared task/resource helpers
* repeated task config fallback structures in yuba/double/expiring modules

Move only clearly shared helpers into existing `task-shared.ts` or a focused `cookie-source.ts`.

### Pros

* Low-risk cleanup with small diff size.
* Reduces subtle drift in credential readiness checks.
* Easier to verify with lint/type-check and existing WebUI contract tests.

### Cons

* Smaller payoff than `resource-state.ts` ownership split.
* Over-centralizing page-specific copy or defaults would hurt readability.

## Candidate D: Backend Runtime Comparison and Config Helpers

### What

`runtime.ts`, `runtime-scheduler.ts`, and `config-store.ts` each use JSON-based equality or related config comparison helpers. Runtime config application also contains several stateful branches for cookie source changes, task changes, and cache invalidation.

Consider extracting:

* a shared internal `jsonEquals` or config equality helper
* named predicates for "cookie source changed", "fans task config changed", and "yuba config changed"

### Pros

* Clarifies runtime reload decisions.
* Reduces repeated equality helpers.

### Cons

* Payoff is modest.
* Any overly abstract diff helper could obscure important runtime behavior.

## Recommended MVP

Use a two-slice optimization plan:

1. **Resource-state ownership split** using a compatibility facade. This has the best maintainability payoff and avoids changing user-visible behavior.
2. **Small shared frontend helper cleanup** while touching WebUI state imports. This removes nearby duplication without broadening into core business logic.

Defer core gift-task execution refactor to a separate follow-up unless the user explicitly wants task execution internals included now. It deserves isolated review and tests because it controls real send behavior.

## Suggested Follow-Up

After the WebUI state split is stable, run a separate task for `src/core/job.ts`:

* add focused tests for pure selection/grouping helpers first
* extract gift-group/send-job preparation second
* keep send order, sleeps, failed-count carry-over, and log text unchanged
