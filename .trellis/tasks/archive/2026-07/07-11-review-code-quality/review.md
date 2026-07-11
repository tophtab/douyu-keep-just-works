# Code Optimization Review

Date: 2026-07-11

## Executive Summary

The codebase is in generally good condition: lint, strict backend/frontend type checks, all 33 contract tests, and the Docker build pass. The WebUI bundle is modest (154.39 kB JavaScript, 51.40 kB gzip), and backend caches are fixed-size rather than unbounded. Broad rewrites, a global frontend store, or bundle splitting are not justified.

The review identified several targeted opportunities. User decisions kept Douyu requests serial, deferred new tests and WebUI response decoding, and approved config ownership cleanup, same-file credential recovery stages, the gift-delay improvement, and the dependency security update.

## Prioritized Opportunities

### P1: Add behavioral tests before refactoring frontend resource and gift-task flows

Evidence:

- `package.json:18-19` runs only Node contract tests and a build; there is no frontend unit/component test command.
- `src/docker/webui/resource-fans.ts:176-347` contains coalescing, stale-response guards, partial/base-to-details loading, error preservation, and multiple loading flags without direct tests.
- `src/docker/webui/resource-state.ts:181-224` coordinates config reload, tab-dependent parallel requests, toast aggregation, and refresh coalescing without direct tests.
- `src/core/job-gift-utils.ts:53-88` owns retry carry-over, ordering, delays, and failure behavior, but no test references `sendGifts` or the three gift job executors.

Current cost: these are exactly the modules most likely to be optimized, but regressions can currently pass lint, type checking, build, and the existing contract suite.

Direction: add focused behavior tests for `resource-request`, fans base/details transitions, refresh coalescing, unauthorized/stale responses, and `sendGifts` retry/delay semantics. Prefer testing composables/helpers with injected request and delay functions over snapshot-heavy component tests.

Benefit: high. Effort: medium. Regression risk: low.

### P1: Reuse bounded concurrency for double-card room status checks

Evidence:

- `src/core/double-card-job.ts:57-71` checks every enabled room sequentially.
- `src/docker/runtime-cache.ts:196-211` already performs the same `checkDoubleCard` operation with `mapWithConcurrency` and a concurrency of 4.
- `src/core/async.ts:1-23` already provides the required order-preserving concurrency helper.

Current cost: task duration grows by the full network latency of every room. With many fan rooms, the scheduler lock remains occupied unnecessarily and manual triggers stay unavailable longer.

Direction: reuse `mapWithConcurrency` with a conservative shared concurrency constant, returning room status results and logging after collection. Preserve per-room failure isolation and deterministic logs where useful.

Benefit: high for accounts with many rooms. Effort: low to medium. Regression risk: medium; add job-level tests first.

### P1: Replace compile-time-only WebUI response assertions with endpoint decoding

Evidence:

- `src/docker/webui/request.ts:68-89` parses JSON as `unknown` and returns `data as T`; callers can claim any response type without validation.
- `src/docker/webui/resource-config.ts:7-28` models response fields as `unknown` and then casts `data.data as DockerConfig`.
- There are 18 typed `requestJson<T>` call sites across auth, config, resource, CookieCloud, and task flows.
- `src/docker/webui/resource-state.ts:69-79` already demonstrates the safer local-normalization pattern for logs.

Current cost: the type checker gives false confidence at the API boundary. A backend response drift can fail later inside state/computed logic, making refactors harder to diagnose.

Direction: keep `requestJson` responsible for transport, but add either an optional decoder `(unknown) => T` or small endpoint-specific decode functions. Start with config, overview, fans status, and auth responses; do not introduce a large schema framework unless the number of decoders justifies it.

Benefit: high maintainability and safer cross-layer changes. Effort: medium. Regression risk: low when introduced endpoint by endpoint.

### P2: Move configuration normalization out of the former `medal-sync.ts`

Evidence:

- The former `src/core/medal-sync.ts` owned task defaults, config normalization, CookieCloud normalization, manual cookie/passport normalization, task reconciliation, and default Docker config creation.
- The module has been renamed to `src/core/config-normalization.ts` to match that ownership.
- Docker runtime modules import it as their configuration authority (`src/docker/config-store.ts:3`, `src/docker/runtime-config-service.ts:1`, and `src/docker/runtime-fans-sync.ts:1`).

The current config shape now uses `weight`, `manualPassport.cookie`, and explicit `doubleCard.enabled`; the retired legacy conversions for `percentage`, `manualPassport.ltp0`, and selection inferred from `send` have been removed.

Direction: first rename/split into a clear configuration domain such as `config-normalization.ts` plus a smaller fan-backed task reconciler. Preserve public behavior and migrate tests without combining this change with format changes.

Benefit: high maintainability. Effort: medium. Regression risk: medium because config migration is sensitive; existing config contract tests provide a good base.

### P2: Refactor credential recovery into explicit stages

Evidence:

- `src/docker/runtime-cookie-recovery.ts:203-344` is a single 142-line orchestration function.
- It tracks four pieces of mutable progress state and has many early returns across local validation, CookieCloud refresh, safeAuth, Yuba recovery, persistence, and user-facing reason construction.
- Repeated source-dependent reason expressions appear around `src/docker/runtime-cookie-recovery.ts:259-261`, `302-312`, and `330-342`.

Current cost: adding another recovery source or changing persistence rules requires reasoning across the entire function. Message construction and transition logic are interleaved.

Direction: model small stage results such as `validateLocalMain`, `refreshFromCookieCloud`, `refreshMainWithPassport`, and `recoverYuba`, then keep the top-level function as a linear pipeline. Centralize reason formatting without hiding state transitions in a generic state-machine framework.

Benefit: medium to high maintainability. Effort: medium to high. Regression risk: medium; the existing passport/recovery tests are strong but should be split into focused fixtures during the refactor.

### P3: Avoid sleeping after the final gift send and make delays injectable

Evidence:

- `src/core/job-gift-utils.ts:62-82` waits two seconds after every attempted send, including the final attempt.
- The helper has no direct behavior tests, and delay behavior is tied to the concrete `sleep` import.

Current cost: every successful gift task holds its scheduler lock for an unnecessary final two seconds. Tests for this helper would also be slow if added naively.

Direction: filter positive jobs, delay only between attempts, and inject or parameterize the delay function for tests. Preserve the intentional rate limit between Douyu requests.

Benefit: small but concrete runtime improvement and better testability. Effort: low. Regression risk: low after adding tests.

### Supporting maintenance: update the production dependency chain

Evidence:

- `package.json:29` allows Axios updates, but the lockfile currently resolves `axios@1.16.0` and `form-data@4.0.5`.
- `npm audit --omit=dev --audit-level=moderate` reports one high-severity `form-data` CRLF-injection advisory and recommends an available fix.
- `npm outdated` reports `axios@1.18.1` as the current wanted/latest compatible version.

Direction: update Axios/lockfile, rerun the full suite and audit, and verify request/multipart behavior. Keep this as a small dependency-maintenance change rather than mixing it into structural refactors.

## Lower-Value Changes To Avoid For Now

- Do not add Pinia/Vuex or a broad resource framework. Existing focused Vue modules and request coalescing are appropriate for the current scale.
- Do not split the WebUI bundle solely for size. The production JavaScript is 154.39 kB (51.40 kB gzip), which is not a current bottleneck.
- Do not replace fixed-slot runtime caches with LRU/Redis. `DockerRuntimeCache` owns three bounded entries, so there is no unbounded-memory problem.
- Do not optimize `jsonEquals` or synchronous config-file I/O without profiling. Config objects are small and these paths are infrequent.
- Do not split files based on line count alone. `douyu-passport.ts` is large but still domain-cohesive; split only when a planned change needs a narrower cookie/header, QR, or Yuba SSO boundary.

## Recommended Sequence

1. Keep double-card checks serial and defer new frontend/job tests.
2. Defer WebUI endpoint response decoding.
3. Use `config-normalization.ts` as the config ownership module and retain only the current config shape.
4. Keep credential recovery stages in one file behind the existing public function.
5. Preserve serial gift sends while delaying only between requests.
6. Keep the production dependency audit clean through the lockfile update.

## User Decisions And Applied Changes

- No new automated tests will be added for this work.
- Double-card status checks will remain serial because reducing request frequency is preferred for Douyu platform risk-control compatibility.
- Credential recovery is split into same-file stages while preserving the public function and existing behavior.
- WebUI endpoint decoding remains an explanatory observation only; it is not implementation work in this task.
- Gift sends remain serial with a two-second delay between attempts, but the final unnecessary delay has been removed in `src/core/job-gift-utils.ts`.
- The production dependency lock now resolves `form-data@4.0.6` instead of `4.0.5`; Axios remains at `1.16.0` and `npm audit` reports zero vulnerabilities.

## Verification

- `npm run lint`: passed.
- `npm run type-check`: passed.
- `npm run test:contracts`: 33 passed, 0 failed.
- `npm run build:docker`: passed.
- WebUI output: JS 154.39 kB / 51.40 kB gzip; CSS 20.62 kB / 4.93 kB gzip.
- `npm audit --omit=dev --audit-level=moderate`: passed with zero vulnerabilities after updating `form-data` to `4.0.6`.
