# Full Code and Architecture Optimization Analysis

Date: 2026-05-29

Last updated: 2026-05-30

## Scope

This analysis inspected the maintained Docker-first runtime and WebUI path:

* Backend/runtime: `src/core/`, `src/docker/`
* Frontend: `src/docker/webui/`
* Quality/build: `package.json`, TypeScript configs, ESLint, Dockerfile, GitHub workflow, contract tests
* Trellis specs: backend and frontend guideline indexes plus relevant quality/state/directory guides

The original pass did not change business code. Follow-up implementation already completed the Batch 1 hardening work, and subsequent login-cookie tasks changed the current baseline in two important ways:

* `fix: merge passport cookie into login cookie panel` moved `manualPassport.cookie` into the main login Cookie panel and saves it together with `manualCookies`.
* `fix: persist CookieCloud passport cookie` makes CookieCloud persistence store complete `passport.douyu.com` material into `manualPassport.cookie` when `LTP0` is present, and preserves existing passport recovery material when the remote snapshot is incomplete.

## Current Quality Signals

### Checks Run

* `npm run lint` passed.
* `npm run type-check` passed.
* `npm run test:contracts` passed in the original analysis: 24 tests, 24 passed.
* After the follow-up passport-cookie tasks, `npm run test:contracts` passed on 2026-05-30: 25 tests, 25 passed.
* After Batch 2 test guardrails were added, `npm run test:contracts` passed on 2026-05-30: 29 tests, 29 passed.
* `npm audit --omit=dev --audit-level=moderate` initially found 2 moderate production dependency advisories:
  * `qs` 6.11.1-6.15.1, transitive, remotely triggerable DoS advisory.
  * `ws` 8.0.0-8.20.0, uninitialized memory disclosure advisory.
* Batch 1 patched the audited production dependencies; `npm audit --omit=dev --audit-level=moderate` passed on 2026-05-30 with 0 vulnerabilities.
* `npm outdated --depth=0` shows small patch updates available, including `ws` 8.21.0, `vite` 8.0.14, `vue` 3.5.35, `axios` 1.16.1, `vue-tsc` 3.3.2.

### Strengths Worth Preserving

* The project has a clear Docker-first boundary documented in specs and `CONTRIBUTING.md`.
* Backend route registration is modular through `register*Routes(app, ctx)`.
* Task-wide metadata is centralized in `src/docker/task-metadata.ts`.
* Scheduler lifecycle and task execution have already been split into `runtime-scheduler.ts` and `runtime-task-runners.ts`.
* Cookie credential recovery is centralized instead of being copied into each task runner.
* Passport recovery material now has one durable config field, `manualPassport.cookie`, shared by manual entry and CookieCloud persistence.
* WebUI is Vue-only with a clear composition root in `App.vue`.
* Frontend resource ownership is already split into focused modules (`resource-config`, `resource-fans`, `resource-yuba`, `resource-request`).
* Contract tests lock several important architecture guarantees, especially Vue-only runtime, request coalescing, credential recovery, config save flows, passport-cookie masking/persistence, and task metadata ownership.

## Findings and Recommendations

### P0: Dependency Security Patch

**Finding**

Production dependency audit reports two moderate advisories:

* `ws` currently resolves to 8.20.0; `npm outdated` says 8.21.0 is available.
* `qs` is present through the dependency tree and has a moderate advisory for affected versions.

**Risk**

This is the only security-related issue found by the automated audit. The app is a long-running WebUI service exposed on a local/NAS port, so moderate network-facing dependency issues should be patched promptly even if exploitability is limited by deployment topology.

**Recommendation**

Create a small dependency-maintenance task:

1. Run `npm audit fix`.
2. Confirm `package-lock.json` changes are patch-only and compatible with Node 24.
3. Run `npm run lint`, `npm run type-check`, `npm run test:contracts`, and `npm run build:docker`.
4. If `qs` remains due to an upstream cap, document the transitive owner and decide whether to wait or override.

### P1: Runtime Composition Root Is Carrying Too Many Responsibilities

**Evidence**

`src/docker/runtime.ts` is 402 lines and currently owns:

* global runtime state: `currentConfig`, `activeConfigPath`, CookieCloud sync job state
* CookieCloud sync job lifecycle
* credential recovery retry wiring
* config diffing and cache invalidation
* scheduler reconciliation decision flow
* fans reconciliation and config persistence
* Express `AppContext` construction
* process signal handling

Key areas are concentrated around `applyConfig` and context construction.

**Risk**

The file is still understandable, but every new runtime feature must reason across config persistence, cache invalidation, scheduler state, cookie recovery, and route context. That increases regression risk and makes isolated testing harder.

**Recommendation**

Do not rewrite the runtime. Split only stable sub-responsibilities:

* Extract CookieCloud scheduled sync into a `DockerCookieCloudSyncService` or `runtime-cookie-cloud-sync.ts`.
* Extract config application/diffing into a `DockerRuntimeConfigService` or pure helpers that return `{ cacheInvalidation, schedulerAction, logMessage }`.
* Keep `startDockerRuntime()` as the composition root that wires services and Express context.
* Add contract tests for the extracted config-application behavior before moving code.

### P1: Config Normalization and Reconciliation Duplicate Shape Logic

**Evidence**

`src/core/medal-sync.ts` is 378 lines and has parallel concepts:

* default config builders for keepalive/double/expiring
* `reconcile*Config` functions for fan-aware configs
* `normalize*Config` functions for persisted configs
* repeated `send` normalization loops for keepalive, double-card, and expiring gift

The current code is correct enough, but changes to one task shape can require touching multiple similar sections.

**Risk**

The main risk is drift. A future task-field addition can update default/reconcile but miss normalize, or update backend config shape without matching frontend assumptions.

**Recommendation**

Create a focused config-shape refactor:

* Introduce a small internal descriptor per fan-backed task, not a broad framework.
* Reuse one helper for `normalizeSendMap`.
* Keep task-specific behavior explicit for double-card `enabled` and expiring default first-row weight.
* Add tests around normalize/reconcile for missing fields, legacy `percentage`, expiring first-row default, and double-card enabled migration.

### P1: Backend Type Strictness Is Weaker Than the Codebase Standard

**Evidence**

`tsconfig.docker.json` has `"strict": true` but also `"noImplicitAny": false`.

Only one explicit `any` was found in source:

* `src/core/double-card.ts` uses `(item: any) => ...`.

**Risk**

The codebase is already mostly typed, so allowing implicit any is a quiet regression path rather than an immediate bug. It can let future Douyu response parsing changes bypass narrowing.

**Recommendation**

Separate this into a small hardening task:

1. Replace the explicit `any` in `double-card.ts` with a local response interface or `Record<string, unknown>` narrowing.
2. Flip backend `noImplicitAny` to `true`.
3. Run type-check and fix surfaced issues.
4. Keep `skipLibCheck` unchanged unless there is a separate dependency-type cleanup task.

### P1: WebUI Cookie Login Module Has Too Many Concerns

**Evidence**

`src/docker/webui/cookie.ts` is still a large page-facing facade and currently owns:

* manual cookie form state
* manual passport form state, now saved with the login Cookie form instead of a standalone panel
* CookieCloud form state
* cron preview binding
* save flows
* CookieCloud persist/sync/check flow
* diagnostics text formatting
* login status card state
* protected-resource invalidation and overview refresh

**Risk**

This module is a frequent change point for login/CookieCloud behavior. The recent passport-cookie merge improved the UI information architecture, but it also tightened the coupling between manual cookie saves, masked `/api/config` responses, local raw-config state, CookieCloud persist responses, and cross-page refresh side effects. That makes future changes riskier, especially around secret handling and partial failure behavior.

**Recommendation**

Split only the non-UI state/effects:

* `cookie-source-state.ts`: form refs/reactive state and `applyRawConfig`.
* `cookie-source-actions.ts`: save/sync/check API effects.
* `cookie-source-copy.ts`: `buildCookieCheckText` and status-card formatting.
* Keep `useCookieLoginPage()` as the page-facing facade to avoid churn in `LoginConfigPage.vue`.
* Before splitting, keep or add behavior-level tests that prove masked `/api/config` responses do not overwrite the raw passport textarea value and that CookieCloud persist can update `manualPassport.cookie`.

### P1: Contract Tests Are Valuable but Some Are Too Source-Text Coupled

**Evidence**

`test/project-maintenance-contract.test.js` and `test/request-smoothing-contract.test.js` assert many implementation details by regex against source files. The follow-up passport-cookie tasks added useful coverage in `test/douyu-passport-contract.test.js`, including behavior-level checks for manual passport normalization, public config masking, credential recovery, and CookieCloud passport persistence.

**Risk**

These tests are effective at preserving architecture decisions, but they can block safe refactors by requiring exact source shapes. This is already visible in the WebUI/runtime architecture contracts. Heavy refactoring will need test rewrites before behavior changes. The regex tests are still useful for forbidden patterns, but they should be clearly labeled so future refactors know which checks are architecture guardrails and which are replaceable shape checks.

**Recommendation**

Keep architecture contract tests, but convert the most brittle checks into exported behavior tests where possible:

* Prefer testing helper outputs and route behavior through lightweight in-memory contexts.
* Keep regex tests only for true forbidden patterns, such as no legacy WebUI bridge and no direct `safeAuth` in task runners.
* Add a short comment per regex block explaining the architectural rule it protects.
* Add route-level tests through `createServer(ctx)` for auth boundaries and config masking, instead of only invoking route installers by hand.

### P2: Runtime Equality Uses `JSON.stringify`

**Evidence**

Runtime config diffing uses `jsonEquals` with `JSON.stringify` in `src/docker/runtime.ts` and `src/docker/runtime-scheduler.ts`. Config persistence equality also uses stringify in `config-store.ts`.

**Risk**

For current normalized config objects this is acceptable. The risk appears if future config values include non-JSON data, unstable key ordering, or larger data sets. Today this is a low-priority maintenance issue.

**Recommendation**

Leave it unless refactoring config application. If touching that area, introduce a small `config-equality.ts` helper and keep the comparison explicitly scoped to normalized JSON config.

### P2: Frontend Template Markup Repetition

**Evidence**

`AppShell.vue` manually lists every tab panel. Table components repeat fixed `<col>` definitions and several page components use repeated inline margin styles.

**Risk**

Current scale is manageable. The risk grows when adding more pages or tables.

**Recommendation**

Do not refactor for its own sake. If a new page is added, consider introducing:

* a page panel descriptor in `AppShell.vue`, or
* a small `PagePanel.vue` wrapper that owns `role="tabpanel"`, `aria-labelledby`, `hidden`, and active classes.

For tables, keep fixed dimensions but consider replacing inline `<col style="width:...">` with named CSS classes if table changes become frequent.

### P2: No Runtime Integration or WebUI Interaction Tests

**Evidence**

Existing tests are contract tests and source architecture checks. There is no full automated runtime suite, and no browser-level WebUI tests.

**Risk**

The app can pass type-check and contract tests while missing regressions in auth session flow, route middleware ordering, WebUI navigation, or save/sync UI behavior.

**Recommendation**

Add one small integration layer before larger refactors:

* Backend: instantiate `createServer(ctx)` with a fake `AppContext` and test route auth/masking/config saves without binding a port.
* Frontend: add Playwright smoke coverage for login screen render, navigation shell, and one config form path. This should be opt-in or CI-safe depending on runtime cost.

### P2: Build and Dependency Maintenance Can Be More Explicit

**Evidence**

`npm test` includes contract tests and Docker build. CI separately runs lint, type-check, and build. Docker release workflow is complete and multi-arch for release tags.

**Risk**

Local contributors may run only `npm test` and miss lint/type-check if relying on the test script alone, although `CONTRIBUTING.md` documents the full gate.

**Recommendation**

Optionally add a `npm run check` script:

```json
"check": "npm run lint && npm run type-check && npm run test:contracts && npm run build:docker"
```

Leave `npm test` unchanged because existing contract tests assert its current meaning.

## Suggested Roadmap

### Batch 1: Low-Risk Hardening

1. Dependency security patch (`npm audit fix`, validate lockfile).
2. Remove explicit `any`; enable backend `noImplicitAny`.
3. Add `npm run check` if desired, without changing `npm test`.

Status: implemented in this task for items 1 and 2. Item 3 remains optional and was not added.

### Batch 2: Guardrails Before Refactor

1. Add behavior-level tests for config normalization/reconciliation.
2. Add route-level tests for config masking and auth boundary.
3. Document which regex contract tests are forbidden-pattern checks vs refactorable shape checks.

Status: implemented in this task.

### Batch 3: Focused Architecture Cleanup

1. Extract CookieCloud scheduled sync from `runtime.ts`.
2. Extract runtime config application/diffing helpers.
3. Refactor `medal-sync.ts` shared send-map normalization.
4. Split `cookie.ts` into state/actions/copy modules behind the same `useCookieLoginPage()` facade.

### Batch 4: Optional UX/Test Coverage

1. Add Playwright smoke tests for WebUI render and navigation.
2. Remove repeated tab panel/table markup only when adding or changing pages.

## Recommended MVP for the Next Implementation Task

Batch 1 and Batch 2 are complete. The next MVP is the first low-risk Batch 3 extraction:

* start with the smallest stable extraction behind the new guardrails,
* prefer behavior-preserving CookieCloud sync or config-application helpers before broader WebUI splitting,
* run lint, type-check, and contract tests after each extraction.

## Implementation Notes: Batch 1

Implemented after the initial analysis:

* `npm audit fix` updated `qs` from 6.15.1 to 6.15.2 and `ws` from 8.20.0 to 8.21.0 in `package-lock.json`.
* `tsconfig.docker.json` now sets `noImplicitAny` to `true`.
* `src/core/double-card.ts` replaced the explicit `any` with local response interfaces and a type guard.
* `src/core/api.ts` narrows backpack list data as `unknown[]` before filtering/mapping/sorting.
* `.trellis/spec/backend/quality-guidelines.md` now records the backend `noImplicitAny` and external-response narrowing convention.

Verification:

* `npm run lint` passed.
* `npm run type-check` passed.
* `npm run test:contracts` passed with 24 tests.
* `npm audit --omit=dev --audit-level=moderate` passed with 0 vulnerabilities.
* `npm run build:docker` passed.

Batch 2 now precedes the larger runtime/config/WebUI module splits as intended.

## Implementation Notes: Batch 2

Implemented after the follow-up passport-cookie tasks:

* Added behavior-level config guardrails for `normalizeDockerConfig` and `reconcileDockerConfig`, covering missing defaults, legacy `percentage`, double-card enabled migration, stale fan-room removal, and expiring-gift first-row weight defaults.
* Added route-level `createServer(ctx)` tests with a fake `AppContext`, covering auth protection for config routes, public config masking, raw config protection, and manual passport masking in config mutation responses.
* Added a shared TypeScript module loader for Node contract tests so behavior tests can load TypeScript modules without duplicating VM/transpile setup.
* Annotated source-regex contract tests to distinguish forbidden-pattern checks, cross-layer behavior boundaries, and refactorable shape checks.
* Updated backend quality guidance to prefer `createServer(ctx)` route tests for auth/masking boundaries and the shared TypeScript module loader for direct TypeScript module tests.

Verification:

* `npm run test:contracts` passed with 29 tests.
* `npm run lint` passed.
* `npm run type-check` passed.
