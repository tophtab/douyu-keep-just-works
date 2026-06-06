# brainstorm: code reuse and refactor opportunities

## Goal

Identify practical code reuse and refactor opportunities in this repository, with emphasis on reducing repeated code, lowering context footprint, and improving readability without changing runtime behavior.

## What I already know

* The user wants to know whether the current code has reusable/refactorable logic.
* The main motivation is saving lines of code and reducing context noise from repeated logic.
* The repository is a single TypeScript project with backend logic under `src/core/` and `src/docker/`, and a Vue/Vite WebUI under `src/docker/webui/`.
* The previously parallel Toast, inline feedback, and log-surface work has landed in the current workspace state.
* The repository has about 13.9k lines under `src/` after the refresh; largest hotspots are still WebUI resource/page modules and Docker cookie/runtime modules.
* The codebase already has several shared helpers (`resource-request.ts`, `task-shared.ts`, `task-page-actions.ts`, `fans-backed-task-page.ts`, `server-route-utils.ts`, `runtime-task-runners.ts`, `runtime-cache.ts`), so the best refactors should extend existing shared layers rather than invent a new style.
* Latest feedback work added durable page-local error state for fans status and logs, plus short manual-refresh toasts that point users to page feedback.
* `test/webui-error-feedback-contract.test.js` now protects exact WebUI feedback behavior and matches some current function-body source shapes.

## Assumptions (temporary)

* The first output should be an evidence-based refactor opportunity list, not immediate code changes.
* Good candidates should be behavior-preserving and scoped enough to review safely.
* The preferred refactors should reduce duplication without introducing broad abstractions that make code harder to follow.

## Open Questions

* Which refactor category should be prioritized first after the audit?

## Requirements (evolving)

* Inspect the codebase before asking for user input.
* Identify repeated logic and common patterns that can be reused.
* Rank opportunities by expected code reduction, readability improvement, and regression risk.
* Keep recommendations concrete, with files or modules referenced.
* Prefer behavior-preserving refactors that can be verified with existing contract/type checks.
* Refresh the audit against the latest code before starting implementation.
* Preserve the new WebUI feedback contract: automatic loads avoid toasts, manual refresh uses short pointer toasts, and page surfaces hold detailed error text.

## Acceptance Criteria (evolving)

* [x] Produce a ranked list of reuse/refactor opportunities with concrete file references.
* [x] Distinguish high-confidence mechanical reuse from deeper architecture changes.
* [x] Recommend one MVP refactor path for implementation.
* [x] Capture out-of-scope items that are too risky or too broad for the first pass.
* [x] Re-run the audit after Toast, inline feedback, and log-surface changes land.

## Definition of Done (team quality bar)

* Tests added/updated if implementation follows this brainstorm.
* Lint / typecheck / CI green if implementation follows this brainstorm.
* Docs/notes updated if behavior or conventions change.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Changing product behavior during the initial audit.
* Large rewrites whose main benefit is aesthetic rather than measurable reuse.
* Refactoring unrelated generated or vendored code, if any exists.
* Collapsing every Vue page into a generic page factory before proving the smaller logic helpers are worthwhile.
* Starting implementation without updating source-shape contract tests when abstractions intentionally move guarded behavior.

## Technical Notes

* Relevant Trellis guide: `.trellis/spec/guides/code-reuse-thinking-guide.md`.
* Backend spec index: `.trellis/spec/backend/index.md`.
* Frontend spec index: `.trellis/spec/frontend/index.md`.
* Candidate 1: WebUI resource loaders repeat pending request reuse, request sequence guards, loading/error refs, durable error refs, 401 handling, success toast handling, short failure toasts, boolean success/failure returns, and force-refresh URL plumbing across `src/docker/webui/resource-fans.ts`, `src/docker/webui/resource-yuba.ts`, and partly `src/docker/webui/resource-state.ts`. Existing helper: `src/docker/webui/resource-request.ts`.
* Candidate 2: fan-backed task pages repeat config fallback, normalized model application, active/cron/model refs, disable payload construction, card construction, fan-list messages, and toggle wiring across `src/docker/webui/keepalive.ts`, `src/docker/webui/double.ts`, and `src/docker/webui/expiring.ts`; `collect.ts` and `yuba.ts` share a simpler scheduled-task subset.
* Candidate 3: cookie-source classification is implemented in several places: `src/docker/runtime-cookie-source.ts`, `src/docker/server-config-routes.ts`, and frontend `src/docker/webui/task-shared.ts`/`resource-config.ts`. This is less about raw line count and more about one source of truth for "manual vs CookieCloud vs hybrid vs none".
* Candidate 4: small `errorMessage(error: unknown)` helpers are repeated in `src/docker/server-errors.ts`, `src/docker/runtime-cache.ts`, `src/docker/runtime-cookie-source.ts`, `src/docker/runtime-cookie-recovery.ts`, `src/docker/runtime-cookie-cloud-sync.ts`, `src/docker/cron.ts`, `src/docker/runtime-scheduler.ts`, `src/docker/runtime.ts`, `src/core/job.ts`, `src/core/double-card.ts`, and `src/core/yuba-common.ts`. It is easy to centralize but saves little and can create import-boundary churn.
* Candidate 5: Vue templates repeat `TaskStatusCard`, `EnableSwitch`, `CronField`, and `ActionBar` blocks across task pages. This can save lines with a higher readability trade-off because current templates remain explicit.
* Latest tests with source-shape coupling: `test/request-smoothing-contract.test.js`, `test/force-refresh-contract.test.js`, `test/project-maintenance-contract.test.js`, and `test/webui-error-feedback-contract.test.js`. Any resource-loader extraction must update these tests to assert the new helper contract rather than the old inline statements.

## Refactor Opportunity Ranking

### 1. WebUI Resource Loader Helper (Recommended First)

* Scope: `src/docker/webui/resource-request.ts`, `src/docker/webui/resource-fans.ts`, `src/docker/webui/resource-yuba.ts`, and optionally the `loadLogs` portion of `src/docker/webui/resource-state.ts`.
* Why: the same request lifecycle appears at least four times: reuse pending promise, increment `requestSeq`, ignore stale responses, set loading/error refs, ignore 401s, preserve stale visible data, return `true`/`false`/`undefined`, and optionally show short manual-refresh toasts.
* Expected benefit: medium line reduction, high consistency, medium behavior/test risk after the latest feedback contracts.
* Existing tests: `test/request-smoothing-contract.test.js`, `test/force-refresh-contract.test.js`, and `test/webui-error-feedback-contract.test.js` give a verification path but must be updated if logic moves into a helper.
* Recommended shape: first create a small lifecycle helper in `resource-request.ts` that exposes request sequence/pending/stale guards without owning domain-specific state. Then migrate `loadYubaStatus` as the smallest proof, followed by `loadFansList`/`syncFans`, and only then the two-phase `loadFansStatus`.

### 2. Fan-Backed Task Config Helper

* Scope: `src/docker/webui/keepalive.ts`, `src/docker/webui/double.ts`, `src/docker/webui/expiring.ts`, possibly later `collect.ts` and `yuba.ts`.
* Why: the files repeat a common scheduled-task lifecycle: resolve config with fallback, apply active/cron/model refs, build enabled payload, build disabled payload, save/disable/trigger, create overview card.
* Expected benefit: high line reduction, medium readability risk if over-generalized.
* Recommended shape: extract small helpers for disabled payload and scheduled-task card/config state first; avoid a single large generic page factory.
* Latest refresh: still a strong line-reduction target, but it should follow resource-loader cleanup because it touches broader user-facing task flows and has less focused contract coverage.

### 3. Cookie Source Summary Module

* Scope: backend `src/docker/server-config-routes.ts` plus `DockerCookieSourceManager` methods in `src/docker/runtime-cookie-source.ts`; frontend can continue using API result or a matching typed helper.
* Why: "has configured cookie source" and "manual/cookieCloud/hybrid/none" are policy decisions repeated across layers.
* Expected benefit: small-to-medium line reduction, high consistency benefit.
* Risk: backend/frontend type boundaries and response contract need tests.
* Latest refresh: unchanged. Still more valuable for consistency than raw line reduction.

### 4. Shared Error Message Helper

* Scope: repeated `error instanceof Error ? error.message : String(error)` helpers across backend/core modules.
* Why: repeated tiny helper.
* Expected benefit: low line reduction, low conceptual value.
* Risk: import-boundary churn across `core` and `docker`.
* Recommendation: only do this opportunistically when touching nearby files.
* Latest refresh: unchanged, and still not worth making an independent task.

### 5. Template Skeleton Components

* Scope: task page Vue components.
* Why: repeated card/switch/cron/action markup.
* Expected benefit: visible line reduction.
* Risk: can hide page-specific UI flow and make templates less direct.
* Recommendation: defer until logic-layer duplication is reduced.
* Latest refresh: unchanged. The duplicate template skeleton is real, but not the first implementation target because current explicit templates make task-specific UI easy to inspect.

## Latest Refresh Notes (2026-06-06)

### What Changed Since The First Audit

* WebUI error feedback is now more explicit and durable: `fansStatusError`, `logsError`, and `yubaStatusError` drive page-local feedback instead of long automatic toasts.
* Manual refresh now aggregates resource-loader boolean results and shows `刷新失败，请查看页面提示` when a page-level resource reports `false`.
* `loadActiveTabData` now avoids repeatedly auto-loading resources after a page-local error until the user refreshes.
* New tests in `test/webui-error-feedback-contract.test.js` protect this feedback split.

### Impact On Refactor Order

* Resource-loader extraction is still the best first target because the new feedback work made the repeated lifecycle more obvious.
* Its implementation risk is now higher than before because several tests match current source shape. The right fix is to update tests to assert helper behavior and call sites, not to preserve duplicated inline statements.
* Fan-backed task-page extraction remains second because it should not be mixed with request/error feedback movement.

## Implementation Order

### Phase 1: Resource Request Lifecycle Helper

* Extract a small helper around `ResourceRequest` pending reuse, sequence creation, stale-response checks, tracking, and optional force-refresh URL handling.
* Migrate `loadYubaStatus` first because it is single-phase and has the smallest domain state.
* Migrate `loadFansList` and `syncFans` next because they share the same list error/loading pattern.
* Migrate `loadFansStatus` last because it has two-phase base/details behavior and stale data preservation.
* Update `request-smoothing`, `force-refresh`, and `webui-error-feedback` tests to assert the new helper contract and preserve the visible feedback behavior.

### Phase 2: Log Loader Alignment

* Consider moving `loadLogs` onto the same helper only after Phase 1 proves the shape works.
* Keep `clearLogs` toast-only because the latest contract explicitly distinguishes log-load failures from clear-log failures.

### Phase 3: Fan-Backed Task Config Helper

* Extract smaller helpers for repeated disabled payload construction, scheduled task card construction, and model-change row rebuilding across `keepalive`, `double`, and `expiring`.
* Avoid a single generic page factory unless repeated code remains large after the small helpers.

### Phase 4: Cookie Source Summary Module

* Centralize backend cookie source classification and masking only after WebUI request/task cleanup is stable.
* Add or update route contract tests for `cookieSaved`, `cookieSource`, and masked credential fields.

### Deferred

* Shared tiny `errorMessage` helper.
* Template skeleton components for repeated `TaskStatusCard`/`EnableSwitch`/`CronField`/`ActionBar` markup.

## Research Notes

### Future Evolution

* If more task pages are added, the fan-backed task config helper becomes more valuable.
* If cookie authentication keeps evolving, cookie source classification should be centralized before adding another source or recovery mode.

### Related Scenarios

* Resource request behavior must stay consistent with auth/session handling because 401s dispatch global unauthorized UI.
* Backend overview/config summary and frontend credential gating should agree on cookie-source readiness.

### Failure and Edge Cases

* Resource loader refactors must preserve stale-response suppression and in-flight request coalescing.
* Task-page refactors must preserve disabled payload fields so disabling a task does not erase user configuration.
* Cookie-source refactors must preserve legacy `config.cookie` fallback and CookieCloud readiness semantics.

## Recommended MVP

Start with Candidate 1, the WebUI resource loader helper. It still has the best balance of reuse and correctness payoff, but the implementation should be staged to preserve the newly landed page-feedback behavior and update source-shape contract tests intentionally.

## Current Decision

The audit has been refreshed against the latest code after Toast, inline feedback, and log-surface changes. Recommended implementation order is:

1. Resource request lifecycle helper, staged from `loadYubaStatus` to fans loaders.
2. Log loader alignment if the helper remains readable after Phase 1.
3. Fan-backed task config helper.
4. Cookie source summary module.

Do not begin implementation until this refreshed order is accepted.
