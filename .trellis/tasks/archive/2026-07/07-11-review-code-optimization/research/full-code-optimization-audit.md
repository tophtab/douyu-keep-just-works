# Full Code Optimization Audit

Date: 2026-07-11

## Scope And Baseline

This audit was performed independently across the main application domains rather than as a delta review of the previous task:

- shared task and Douyu integration code under `src/core/`
- Docker runtime, scheduling, caching, config, cookie-source, and route code under `src/docker/`
- Vue WebUI resources, composables, pages, and components under `src/docker/webui/`
- contract tests under `test/`
- package scripts, TypeScript/Vite/ESLint configuration, Docker files, and GitHub Actions

Security auditing is explicitly excluded.

Baseline results:

- `npm run lint`: passed
- `npm run type-check`: passed
- `npm run test:contracts`: 33 passed, 0 failed
- `npm run build:docker`: passed in about 7.45 seconds locally
- WebUI output: 154.39 kB JavaScript / 51.40 kB gzip; 20.62 kB CSS / 4.93 kB gzip
- backend `noUnusedLocals` / `noUnusedParameters`: passed

## Preliminary Findings

### P1 — Enforce the existing contract suite in CI

Evidence:

- `.github/workflows/docker.yml:61-70` installs dependencies, runs lint, type checks, and builds, but never runs `npm run test:contracts` or `npm test`.
- `.github/workflows/docker.yml:9-19` and `:22-32` do not include `test/**` or `eslint.config.mjs` in path filters, so test-only and lint-config-only changes may not trigger validation.
- `package.json:18-19` already defines 33 lightweight contract tests and a combined test/build command.

Impact: application changes can merge or publish while the repository's behavioral contracts are broken. Existing test investment is not part of the automated quality gate.

Direction: run contract tests in the validate job and include test/lint configuration inputs in workflow path filters. Keep Docker image compilation in its existing job; avoid adding a separate heavyweight CI system.

### P1 — Reuse room `did` resolution within one multi-gift execution

Evidence:

- `src/core/job-gift-utils.ts:63-71` calls `getDid()` before every attempted send.
- `src/core/expiring-gift-job.ts:60-78` calls `sendGifts()` once per gift type.
- `src/core/double-card-job.ts:79-99` does the same for limited-time double-card gift groups.

Impact: for `G` gift types and `R` target rooms, the task can fetch and parse the same room HTML up to `G × R` times before sending. The owner UID is room-scoped and stable during one task execution, so repeated requests add latency and external request volume without adding useful freshness.

Direction: introduce a task-local room-ID-to-`did` resolver/cache and share it across gift groups. Preserve serial gift sends and all existing two-second inter-request spacing.

Validation prerequisite: add focused behavior coverage for `sendGifts` carry-over, spacing, resolver reuse, and failure behavior.

### P2 — Make logs truly lazy after authentication

Evidence:

- `src/docker/webui/resource-state.ts:227-233` loads config, overview, and up to 500 log entries on every authenticated bootstrap.
- `src/docker/webui/resource-state.ts:161-177` already contains active-tab lazy loading for logs.
- `src/docker/webui/logs-resource.ts:35-46` already refreshes logs only while the logs tab is active.

Impact: users who never open the logs page still pay the request, parsing, allocation, and reactive-state cost for the full log list during login.

Direction: remove logs from the unconditional bootstrap batch and rely on the existing active-tab loader. Preserve overview recent logs and logs-page auto refresh.

### P2 — Centralize WebUI config mutation response application

Evidence:

- `src/docker/webui/cookie-source-actions.ts:117-139` posts manual-cookie config and applies the returned full config.
- `src/docker/webui/cookie-source-actions.ts:229-266` repeats the same transport and response-application shape for CookieCloud.
- `src/docker/webui/theme.ts:71-95` repeats it for theme changes.
- `src/docker/webui/task-shared.ts:225-246` owns a task-specific variant.

Impact: response typing, raw-config replacement, and error behavior are maintained in several places. Future changes to the config response envelope or invalidation rules can drift between callers.

Direction: add a small `saveConfigPatch` helper beside `resource-config.ts` that owns the `/api/config` mutation envelope and raw-config replacement. Keep feature-specific form updates, cache invalidation, toasts, and rollback behavior in their current modules; do not introduce a broad generic resource framework.

### P2 — Add targeted behavior tests before the two runtime/UI changes

Evidence:

- `test/gift-task-contract.test.js:24` covers pure gift preparation only; no test references `sendGifts`, `executeKeepaliveJob`, `executeDoubleCardJob`, or `executeExpiringGiftJob`.
- No test references `resource-state.ts`, `resource-fans.ts`, `cookie-source-actions.ts`, `loadConfig`, or `refreshOverviewSurface`.
- The current suite is fast (about 2.3 seconds), so a small number of dependency-injected behavior tests should remain lightweight.

Impact: the most valuable optimization candidates touch request sequencing and reactive orchestration, where type checking and builds cannot detect regressions.

Direction: test helpers/composables through injected request/delay/resolver functions; avoid snapshot-heavy component tests or a large browser-test stack.

### P3 — Remove unused request timestamps and consolidate only proven hot parsing

Evidence:

- `src/docker/webui/resource-request.ts:1-23` writes `fetchedAt`, but no production or test code reads it.
- `src/core/api.ts:23-36` reparses a complete Cookie header for every `getCookieValue` call; diagnostics and recovery paths sometimes request many keys from the same string.
- `src/core/api.ts:4` and `src/core/double-card.ts:5` duplicate the same user-agent constant.

Impact: low. These are small ownership and allocation costs, not current bottlenecks.

Direction: remove `fetchedAt`; share the existing user-agent/header helper; parse Cookie records once inside loops that request multiple keys. Do not build a generalized cookie abstraction.

## Changes Not Justified

- No global frontend store: the current Vue refs/composables remain appropriate for the application size.
- No WebUI code splitting solely for size: the 51.40 kB gzip JavaScript bundle is modest.
- No broad file split based only on line count: `douyu-passport.ts` and the recovery modules remain domain-cohesive and have stronger contract coverage than most modules.
- No increased concurrency for scheduled Douyu gift/double-card operations without a separate product decision about platform rate-control risk.
- No schema framework or broad response-decoder project as part of this optimization batch.
- No cache/database/service-layer rewrite: runtime caches are bounded and durable state is a small JSON config file.

## Coverage Notes

- Core task allocation, gift selection, backpack parsing, double-card detection, Yuba status/check-in, CookieCloud, Passport, config normalization, and collection flow were inspected.
- Docker runtime composition, scheduler, task registry, config application, status caches, cookie-source resolution/recovery, fan reconciliation, Passport QR flow, and route boundaries were inspected.
- WebUI auth, navigation, resource orchestration, fans/Yuba loaders, task pages, cookie-source flows, theme, logs, and presentational component structure were inspected.
- Build scripts, Docker context/stages, CI path filters, and contract-test architecture were inspected.

