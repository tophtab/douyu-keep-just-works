# Backend Maintainability Refactor

## Goal

Complete the backend maintainability optimization plan in one session, using an isolated git worktree and merging back after verification. The refactor should prioritize changes that reduce repeated code and reduce how much context future Codex sessions need to load when modifying a specific backend feature.

## What I already know

* The backend is Docker-first: shared Douyu logic lives in `src/core/`, runtime/routes/scheduling/config live in `src/docker/`.
* Current task-wide facts are partially centralized in `src/docker/task-metadata.ts`, but repeated task fields still appear in `server-config-routes.ts`, `config-store.ts`, `runtime-app-context.ts`, `runtime-config-service.ts`, `runtime-task-runners.ts`, and scheduler-related code.
* `DockerCookieSourceManager` currently owns CookieCloud cache, QR login state, effective cookie resolution, persistence, diagnostics, and recovery adaptation.
* `src/core/job.ts` currently owns all task execution flows; double-card and expiring-gift flows are long enough to benefit from task-scoped files.
* Small utilities such as `errorMessage` and `mapWithConcurrency` are repeated in multiple backend modules.
* `/api/config/raw` exposes raw config secrets under the existing authenticated raw-config contract; any security-boundary change may require frontend coordination.
* User wants optimizations judged by whether they reduce repeated code and reduce the amount of context future Codex sessions need to load.
* This task should run in a separate git worktree so the user's frontend work in the main worktree stays isolated.

## Assumptions

* This task should not change public API shapes, route names, persisted config semantics, cron behavior, task labels, or Chinese user-facing messages.
* Existing contract tests are the right safety net; add or update focused contract checks only if needed to protect the registry behavior.
* `/api/config/raw` should be changed only if it can be done without colliding with the user's concurrent frontend work, or after explicitly verifying the frontend impact.

## Requirements

* Introduce a task definition registry or equivalent richer metadata structure in `src/docker/task-metadata.ts`.
* Reuse the registry to remove repeated task key branching where practical and low-risk.
* Extract repeated low-risk helpers such as error normalization and concurrency mapping into appropriate shared modules.
* Split `DockerCookieSourceManager` into focused modules/services that reduce the amount of unrelated cookie-source logic needed for QR login, CookieCloud cache, effective cookie resolution, and persistence changes.
* Split `src/core/job.ts` into task-focused files while preserving shared gift-send helpers and public exports.
* Evaluate `/api/config/raw`; either tighten the boundary with matching frontend/test updates or record why it remains unchanged in this pass.
* Keep TypeScript type safety at least as strong as the current implementation.
* Preserve config normalization, validation-before-save, scheduler reconciliation, manual trigger behavior, cache invalidation, and overview response shape.
* Avoid touching frontend implementation files unless a backend API/security change requires it.
* Keep WebUI and Docker build paths compatible with existing `npm` scripts.

## Acceptance Criteria

* [ ] Task labels, log categories, not-configured messages, active checks, schedule summaries, and simple task config selectors are owned by the registry.
* [ ] Backend modules that currently repeat task keys use registry helpers where practical.
* [ ] Repeated `errorMessage` / concurrency helper logic is reduced without introducing dependency cycles.
* [ ] Cookie source responsibilities are split so QR login, CookieCloud cache, effective cookie resolution, and persistence can be understood independently.
* [ ] Task execution logic is split from `src/core/job.ts` into task-scoped modules without changing runtime runner imports/behavior.
* [ ] `/api/config/raw` is either safely updated with tests/frontend compatibility or explicitly left unchanged with rationale.
* [ ] Existing contract tests pass, or any necessary test updates preserve current behavior.
* [ ] `npm run type-check:docker` passes.
* [ ] Relevant contract tests pass; run broader checks before merge if frontend/API shape is touched.
* [ ] Work is performed on a separate git worktree/branch and merged back only after verification.

## Definition of Done

* Backend refactor completed with no accidental behavior changes.
* Lint/type/test status is recorded.
* Git diff is reviewed so user frontend changes are not mixed into backend commit/merge.

## Out of Scope

* Frontend redesign or WebUI task page changes.
* Adding new tasks or changing task cron defaults.
* Changing Douyu API semantics, cookie recovery rules, or scheduler timing behavior except as required to preserve existing contracts through refactoring.

## Technical Notes

* Relevant specs: backend directory structure, database/config persistence, error handling, testing, logging, quality guidelines.
* Shared guides: code reuse and cross-layer thinking.
* Candidate files: `src/docker/task-metadata.ts`, `src/docker/server-config-routes.ts`, `src/docker/config-store.ts`, `src/docker/runtime-app-context.ts`, `src/docker/runtime-config-service.ts`, `src/docker/runtime-task-runners.ts`, `src/docker/runtime-scheduler.ts`, `src/docker/cron.ts`, `src/docker/runtime-cookie-source.ts`, `src/docker/runtime-cookie-recovery.ts`, `src/core/job.ts`, shared backend utilities, backend contract tests.
