# medal sync config normalization cleanup

## Goal

Reduce duplicated send-map normalization and fan reconciliation logic in `src/core/medal-sync.ts` for keepalive, double-card, and expiring-gift task configs while preserving existing behavior.

## What I Already Know

* The broader optimization PRD identifies fan-backed config normalization cleanup as a focused maintainability opportunity.
* The user asked to avoid `test/project-maintenance-contract.test.js` and backend testing spec edits because another session is modernizing contract tests.
* `src/core/medal-sync.ts` already has shared low-level send-map helpers, but keepalive, double-card, and expiring-gift still repeat task-level normalize/reconcile scaffolding.
* `test/config-guardrails-contract.test.js` already exercises config normalization and reconciliation behavior through `loadTypeScriptModule(...)`.

## Requirements

* Keep runtime behavior unchanged.
* Focus only on keepalive, double-card, and expiring-gift send map / normalize / reconcile similarity in `src/core/medal-sync.ts`.
* Prefer a small shared helper/descriptor that follows the existing `src/core` style and does not create new module boundaries unless needed.
* Add or extend focused config behavior tests, preferably in `test/config-guardrails-contract.test.js`.
* Do not modify `test/project-maintenance-contract.test.js`.
* Do not modify `.trellis/spec/backend/testing-guidelines.md` or other backend testing spec files.

## Acceptance Criteria

* [x] Normalizing existing task config preserves active, cron fallback, model fallback, send item fallback, legacy `percentage`, and task-specific fields.
* [x] Reconciling with fans drops stale rooms and creates missing fan rooms with the same default send weights as before.
* [x] Expiring-gift default fan weights remain first-room `1`, other rooms `0`.
* [x] Double-card `enabled` migration from legacy `send` remains unchanged.
* [x] Focused config behavior tests pass without editing project-maintenance contract tests.
* [x] Lint and type-check pass.

## Out of Scope

* Contract-test modernization outside the focused config behavior coverage.
* Backend testing spec changes.
* WebUI or route behavior changes.
* Config shape or persisted migration changes.

## Technical Notes

* Relevant code: `src/core/medal-sync.ts`.
* Relevant focused tests: `test/config-guardrails-contract.test.js`.
* Relevant guidelines read before implementation: backend index, testing guidelines, quality guidelines, directory structure, and code reuse thinking guide.
