# Focused Architecture Cleanup

## Goal

Implement Batch 3 from the archived architecture optimization report with behavior-preserving module splits. The goal is to reduce responsibility concentration in the Docker runtime, core config normalization, and WebUI login-cookie composable while keeping the existing Docker-first runtime and public behavior unchanged.

## Requirements

- Extract CookieCloud scheduled sync ownership out of `src/docker/runtime.ts` into a focused runtime module or service.
- Extract runtime config application/diffing behavior out of `src/docker/runtime.ts` into focused helpers while keeping `startDockerRuntime()` as the composition root.
- Refactor shared send-map normalization in `src/core/medal-sync.ts` without turning task-specific defaults into a broad framework.
- Split non-UI login-cookie state/effects/copy helpers out of `src/docker/webui/cookie.ts` while keeping `useCookieLoginPage()` as the page-facing facade consumed by `LoginConfigPage.vue`.
- Preserve existing API shapes, config persistence behavior, secret masking, user-facing text, scheduler behavior, and WebUI component contracts.

## Acceptance Criteria

- [ ] CookieCloud scheduling lifecycle can be understood and tested independently from `runtime.ts`.
- [ ] Runtime config apply/reconcile decisions are isolated behind a small helper/service and retain current cache invalidation and scheduler reload semantics.
- [ ] `medal-sync.ts` uses one shared send-map normalization path for keepalive, double-card, and expiring-gift task send maps while preserving legacy `percentage`, expiring first-row defaults, and double-card enabled migration.
- [ ] `cookie.ts` remains the single exported `useCookieLoginPage()` facade, with state/actions/copy moved to focused sibling modules.
- [ ] Existing contract tests continue to pass; add/update architecture guardrails only where file ownership moves.
- [ ] `npm run lint`, `npm run type-check`, and `npm run test:contracts` pass.

## Definition of Done

- Tests added or adjusted for moved behavior and architectural ownership.
- Lint, type-check, and contract tests are green.
- No secrets are exposed in logs, public config responses, test fixtures, or UI copy.
- Docker WebUI remains Vue-only and built through Vite.
- Any useful architecture convention learned during the split is considered for `.trellis/spec/` updates.

## Technical Approach

Use incremental, behavior-preserving extractions:

1. Inspect current runtime, config, normalization, and WebUI cookie modules plus existing contract guardrails.
2. Add small modules that own stable responsibilities, then make current composition roots delegate to them.
3. Keep exported API and facade names stable to minimize component churn.
4. Update architecture tests for new ownership locations rather than deleting guardrails.

## Decision (ADR-lite)

Context: The archived report identified responsibility concentration but explicitly warned against a broad rewrite.

Decision: Perform narrow extractions behind existing public entry points. `runtime.ts` and `cookie.ts` stay as composition/facade files, while extracted modules own CookieCloud sync, runtime config application, cookie source state/actions/copy, and repeated send-map normalization.

Consequences: This reduces local complexity and makes future tests easier, but source-text architecture tests may need targeted updates because ownership paths move.

## Out of Scope

- No API behavior changes, config shape changes, or new migrations.
- No visual redesign or WebUI component layout changes.
- No Playwright/browser smoke suite in this task.
- No dependency upgrades or release workflow changes.

## Technical Notes

- Source report: `.trellis/tasks/archive/2026-05/05-29-full-code-architecture-optimization-analysis/optimization-analysis.md`.
- Relevant specs: backend directory/database/error/logging/quality; frontend directory/component/hook/state/type-safety/quality; shared code-reuse and cross-layer thinking guides.
- User request on 2026-05-30: "干第三项：重点架构拆分".
