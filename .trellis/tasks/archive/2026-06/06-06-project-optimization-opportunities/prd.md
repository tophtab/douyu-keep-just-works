# brainstorm: project optimization opportunities

## Goal

Identify the most valuable optimization opportunities in the current project, with enough codebase-backed evidence to build a reusable optimization roadmap. This task is analysis-only until the user explicitly selects a later implementation task.

## What I already know

* The user asks for an assessment of current project optimization opportunities.
* The user explicitly invoked `trellis-brainstorm`, so this should be handled as requirements discovery before any implementation.
* The user chose "do not rush implementation; continue expanding the optimization analysis list".
* Recent work centered on Douyu Passport QR login, CookieCloud/local snapshot authority, Yuba SSO, runtime cache refresh, and auth cookie lifecycle documentation.
* Current codebase is Docker-first TypeScript backend plus Vue WebUI. Quality scripts include lint, Docker/WebUI type-check, contract tests, and Docker build.
* Production and full dependency audits currently report 0 vulnerabilities.
* Dependency freshness has been assessed. The conservative dev/tooling update batch has been completed; remaining direct-depth decisions are only `axios`, `vue-tsc`, and intentionally deferred Node 25 typings.
* Backend strictness has improved since the older architecture report: `tsconfig.docker.json` now has `strict: true` and `noImplicitAny: true`.
* The old runtime composition-root concern is mostly reduced: `src/docker/runtime.ts` is now 166 lines, while current auth-related concentration moved to `src/docker/runtime-cookie-source.ts` and `src/core/douyu-passport.ts`.
* Largest current files include:
  * `test/douyu-passport-contract.test.js` ~896 lines
  * `test/project-maintenance-contract.test.js` ~552 lines
  * `src/docker/runtime-cookie-source.ts` ~549 lines
  * `src/core/douyu-passport.ts` ~532 lines
  * `src/docker/runtime-cookie-recovery.ts` ~347 lines
  * `src/core/medal-sync.ts` ~359 lines
* `06-06-auto-recover-yuba-cookie` has completed the earlier auth recovery coherence gap in commit `6667455 fix: recover yuba cookie from passport`.
* WebUI cookie facade is now small (`src/docker/webui/cookie.ts`), because state/actions/copy have already been split into `cookie-source-state.ts`, `cookie-source-actions.ts`, and `cookie-source-copy.ts`.
* Contract-test modernization has already completed a taxonomy pass and a first behavior-replacement pass; remaining work should be treated as optional follow-up, not as a prerequisite for every refactor.
* Fan-backed config normalization cleanup has completed in the archived `06-06-medal-sync-config-normalization-cleanup` task.

## Assumptions (temporary)

* "Optimization" may include maintainability, reliability, user-facing workflow robustness, test coverage, performance, and code architecture.
* The immediate output should be a ranked set of candidate optimization directions plus one recommended MVP direction.
* No runtime code should be changed until the user chooses a direction.
* The highest-value future implementation optimizations are now likely WebUI smoke-findings cleanup, Douyu adapter contract hardening, auth module boundary cleanup, or safe runtime diagnostics. Auth recovery coherence, initial contract-test modernization, fan-backed config normalization, and the safe dependency-tooling batch are no longer first-order roadmap items.
* For this current planning task, the output should remain a roadmap and not flip to `in_progress`.

## Open Questions

* Which level of detail should the final roadmap use: ranked short list, full backlog, or phased release plan?

## Requirements (evolving)

* Inspect current repo structure, recent task history, specs, and code hotspots before recommending options.
* Prefer focused, testable optimization work over broad rewrites.
* Preserve existing Docker-first runtime, Vue WebUI, local snapshot authority, and secret-handling boundaries.
* Candidate work should preserve the recently documented Passport/main/Yuba lifecycle contracts.
* Do not start implementation or activate this task in the current turn.

## Candidate Optimization Directions

### A. Auth recovery coherence (completed by separate task)

Focus: align runtime credential recovery with the new `auth-cookie-lifecycle.md` contract.

Evidence:

* `auth-cookie-lifecycle.md` says full recovery should refresh main-site cookies first, then run Yuba SSO with the new main cookie, then persist both snapshots after validation.
* This used to be a gap: `runtime-cookie-recovery.ts` safeAuth-refreshed only `manualCookies.main`, validated main through `getFansList()`, and preserved the old/current Yuba cookie.
* Separate task `06-06-auto-recover-yuba-cookie` completed this work in commit `6667455 fix: recover yuba cookie from passport`.
* Current recovery now supports `recoverYubaCookie`, reuses `fetchDouyuYubaCookiesWithPassport`, keeps the old Yuba cookie only when Yuba SSO fails after main recovery, and does not claim recovery when an already-valid main cookie cannot refresh Yuba.

Expected benefit:

* Better reliability for scheduled tasks and WebUI reads after main-site expiry.
* Less risk of inconsistent local snapshots after Passport-derived refresh.
* Brings implementation, tests, and specs into alignment.

Actual scope:

* Updated `src/docker/runtime-cookie-recovery.ts`, `src/docker/runtime-cookie-source.ts`, `.trellis/spec/backend/error-handling.md`, and `test/douyu-passport-contract.test.js`.
* Verified with type-check, lint, contract tests, and Docker build through `npm test`.

Remaining follow-up:

* Treat this as done unless live usage reveals an edge case around Yuba SSO failure, retry messaging, or stale Yuba snapshot retention.

### B. Auth module boundary cleanup

Focus: split `src/docker/runtime-cookie-source.ts` and possibly `src/core/douyu-passport.ts` into smaller services/helpers without changing behavior.

Evidence:

* `runtime-cookie-source.ts` owns CookieCloud effective-cookie resolution, QR session lifecycle, persistence, cache invalidation, diagnostics, and recovery delegation.
* `douyu-passport.ts` owns QR challenge/polling, main login URL normalization, cookie merging, Yuba SSO bridge, and safeAuth.

Expected benefit:

* Easier future auth work and smaller review surfaces.
* Better unit-level tests around pure pieces like session state transitions and cookie merge policy.

Likely scope:

* Extract QR session workflow and effective-cookie resolution into focused modules behind the existing public manager API.

Risk:

* Refactor-only tasks can burn time and destabilize well-tested working code unless tightly scoped.
* Should follow or accompany behavior tests, not precede them blindly.

### C. Contract-test modernization (MVP completed; long-tail optional)

Focus: convert the most brittle source-regex tests into behavior-level tests while preserving true architecture guardrails.

Evidence:

* `test/project-maintenance-contract.test.js` is large and reads many source files with regex assertions.
* Some checks are useful forbidden-pattern rules, but others assert exact implementation shape and could block safe module extractions.

Expected benefit:

* Refactors become safer and less noisy.
* The quality gate checks behavior/contracts instead of incidental code shape.

Likely scope:

* Identify 3-5 brittle assertions, add behavior-level replacements, keep forbidden-pattern checks labeled.

Risk:

* If done too broadly, test refactor may weaken guardrails. Needs surgical selection.

Execution record on 2026-06-06:

* `5b74733 test: document contract test taxonomy` added the backend testing taxonomy and labels in `test/project-maintenance-contract.test.js`.
* `c2a60c8 test: modernize contract route coverage` completed the first behavior-replacement slice, including route-level config and CookieCloud coverage plus clearer maintenance-contract grouping.
* The archived tasks `06-06-contract-test-modernization-rethink` and `06-06-contract-test-behavior-modernization` mean this candidate should not be scheduled again as a generic prerequisite. Future test work should be scoped to a specific feature or brittle assertion.

### D. Fan-backed config normalization cleanup (completed by separate task)

Focus: revisit `src/core/medal-sync.ts` repeated normalization/reconciliation logic.

Evidence:

* The older architecture analysis flagged repeated send-map normalization and task-shape logic across keepalive, double-card, and expiring gift.
* File is still one of the larger core modules, though not the hottest recent change area.

Expected benefit:

* Reduced drift risk when adding or changing fan-backed task fields.

Likely scope:

* Small descriptor/helper for send-map normalization with regression tests around legacy fields.

Risk:

* Lower immediate value than auth recovery because the current user-visible churn is in login/cookie reliability.

Execution record on 2026-06-06:

* Archived task `06-06-medal-sync-config-normalization-cleanup` reduced duplicated keepalive, double-card, and expiring-gift normalization/reconciliation logic while preserving behavior.
* Acceptance coverage included legacy field migration, send-map defaults, stale-room removal, missing-room creation, and expiring-gift first-room weight behavior.
* Treat this as done unless a future config feature exposes a new duplication pattern.

### E. Runtime/WebUI smoke integration

Focus: add a small integration layer beyond contract/source tests.

Evidence:

* Existing tests are contract-heavy; there are no browser-level WebUI smoke tests or full route tests through a live server instance.

Read-only Runtime/WebUI smoke verification on 2026-06-06:

* Method: started the existing `build/docker` runtime locally on port `51419` with `CONFIG_PATH=/dev/null` and `WEB_PASSWORD=smoke-pass`, then used Playwright CLI for manual browser checks. The service and browser were stopped afterward, and generated Playwright CLI artifacts were cleaned up. No source, test, package, or task files were changed during the smoke run.
* Covered flows: login page, wrong-password path, successful login, navigation, overview refresh, login configuration page, passport QR login panel, QR cancel, manual Cookie save, CookieCloud sync/check, invalid-cookie error paths, logs page, manual log refresh, log clearing, several task configuration pages, and logout.
* Passed:
  * Login page rendered normally; correct password entered the app; logout returned to the login shell.
  * Navigation between overview, login, task configuration pages, Yuba, and logs worked and kept the visible page mostly aligned with the URL.
  * Manual Cookie save updated login status to ready and passport status to configured.
  * Cookie check gave useful missing-field diagnostics for incomplete fake cookies.
  * QR login panel displayed a QR image, progress states, polling, and a cancel action; cancel removed the QR image and cancel button and left a clear cancelled state.
  * Logs page loaded entries, manual refresh updated the refreshed timestamp, and clear logs showed the empty state.
* Findings:
  * Wrong-password feedback is present in the DOM (`登录失败：密码错误`) but invisible because `#login-error` remains `display: none`; `.auth-error { display:none }` appears to conflict with Vue `v-show`.
  * The unauthenticated login shell still lets hidden configuration components request protected `/api/cron-preview` endpoints. Those 401 results can leave CookieCloud cron preview stuck on `cron 校验失败：请先登录` after a successful login; the top-right refresh did not clear it, but a hard browser reload did.
  * Overview shows invalid-cookie failures mainly via toast. The page body falls back to `待刷新` / `尚未加载粉丝牌状态`, while pages such as keepalive show a more useful inline error.
* Follow-up suggestions:
  * Fix the login error visibility issue first because it blocks the most basic failure feedback.
  * Prevent protected cron-preview requests before authentication, or reset/reload cron preview state after authentication succeeds.
  * Add a persistent inline error state to overview's fans-status area so failed refreshes remain understandable after the toast disappears.

Expected benefit:

* Catches UI/auth/navigation regressions that type-check and source contracts miss.

Likely scope:

* One backend route smoke around auth/masking/config save, or one Playwright smoke for login shell/navigation.

Risk:

* Adds test infrastructure and CI runtime cost; should be opt-in or very small.

### F. Runtime observability and diagnostics polish

Focus: make runtime state transitions easier to reason about without exposing secrets.

Evidence:

* `src/docker/logger.ts` keeps only an in-memory 500-entry log buffer and writes the same message to `console.log`.
* Runtime recovery, QR login, CookieCloud sync, cache invalidation, and scheduled/manual task retry flows are now complex enough that diagnosing issues often depends on reading scattered logs.
* Existing specs allow cookie names, missing keys, max-age metadata, and validation status, but forbid raw cookie values.

Expected benefit:

* Easier support/debugging for login expiry, CookieCloud import, and Yuba SSO issues.
* Better future bug reports without asking users for raw cookies.

Likely scope:

* Add structured-but-still-human log reasons for recovery decisions, cache invalidation, and QR/Yuba retry outcomes.
* Possibly expose non-secret diagnostic fields in existing status endpoints.

Risk:

* Logging must avoid raw cookies, QR codes, login URLs, LTP0, JWTs, and CookieCloud credentials.
* Too much log noise can hurt WebUI readability.

### G. Config validation and save-path tightening

Focus: make config payload validation more structural and easier to extend.

Evidence:

* `src/docker/server-config-routes.ts` owns broad payload validation and masking.
* `src/docker/config-validation.ts` validates task shapes but mostly trusts normalized object shapes after shallow checks.
* `buildConfigWithPartialUpdate` is explicit and stable, but every new config field needs edits across validation, masking, summaries, defaults, and tests.

Expected benefit:

* Lower risk when future config shape changes.
* Clearer error messages for malformed WebUI/API payloads.

Likely scope:

* Add focused validation tests for malformed nested payloads.
* Consider small helper maps for task config validators and maskers, without introducing a full schema library.

Risk:

* A schema-library migration would be overkill for current project size.
* Tightening validation can reject previously tolerated malformed user configs if not scoped to API payloads.

### H. Dependency maintenance workflow (safe batch completed; remaining optional splits)

Focus: make dependency freshness/audit checks more repeatable.

Read-only assessment on 2026-06-06:

* Commands run: `node -v`, `npm -v`, `npm audit --omit=dev --audit-level=moderate --json`, `npm audit --audit-level=moderate --json`, `npm outdated --depth=0 --json`, and `npm ls --depth=0 --json`.
* Local toolchain observed: Node `v24.14.1`, npm `11.15.0`.
* Project runtime constraint is Node `>=24 <25` in `package.json`; the package-lock root entry carries the same Node engine constraint.
* This assessment did not upgrade dependencies and must not modify `package.json`, `package-lock.json`, or source files.
* `npm outdated --depth=0 --json` exits with code 1 because direct outdated packages exist; the JSON output completed normally.

Audit result:

* Production audit: `npm audit --omit=dev --audit-level=moderate --json` reported 0 vulnerabilities.
* Full audit including dev/tooling dependencies: `npm audit --audit-level=moderate --json` reported 0 vulnerabilities.
* Audit metadata counted 117 production dependencies, 380 dev dependencies, 33 optional dependencies, 2 peer dependencies, and 496 total dependencies.

Outdated direct dependencies:

| Area | Package | Current | Wanted | Latest | Assessment |
| --- | --- | ---: | ---: | ---: | --- |
| Production | `axios` | `1.16.0` | `1.17.0` | `1.17.0` | Minor production update; reasonable but should be isolated and validated against auth/API HTTP flows. |
| Dev/tooling | `@types/node` | `24.12.3` | `24.13.1` | `25.9.2` | Safe only within Node 24 line: update to `24.13.1`, do not move to Node 25 typings. |
| Dev/tooling | `@vitejs/plugin-vue` | `6.0.6` | `6.0.7` | `6.0.7` | Safe patch candidate; verify WebUI type-check/build. |
| Dev/tooling | `eslint` | `10.3.0` | `10.4.1` | `10.4.1` | Safe same-major tooling candidate; verify lint because rules/parser behavior can still shift. |
| Dev/tooling | `vite` | `8.0.12` | `8.0.16` | `8.0.16` | Safe patch candidate; verify WebUI build and Docker build. |
| Dev/tooling | `vue` | `3.5.34` | `3.5.35` | `3.5.35` | Safe patch candidate; declared as dev dependency but affects the bundled WebUI output. |
| Dev/tooling | `vue-tsc` | `3.2.8` | `3.3.3` | `3.3.3` | Cautious tooling update; type checker changes can surface new diagnostics. |

Packages not reported outdated at direct depth include `cron`, `cron-parser`, `express`, `qrcode`, `ws`, `typescript`, `@antfu/eslint-config`, `@types/express`, `@types/qrcode`, and `@types/ws`; no maintenance action is needed for those from this scan alone.

Safe patch/minor candidates:

* `@types/node` `24.12.3` -> `24.13.1`, explicitly staying on the Node 24 typings line.
* `@vitejs/plugin-vue` `6.0.6` -> `6.0.7`.
* `eslint` `10.3.0` -> `10.4.1`, with lint verification.
* `vite` `8.0.12` -> `8.0.16`, with WebUI and Docker build verification.
* `vue` `3.5.34` -> `3.5.35`, with WebUI type-check/build verification.

Cautious candidates:

* `axios` `1.16.0` -> `1.17.0`: same major and likely acceptable, but it is a production HTTP dependency used by runtime/auth/API paths. Update separately from tooling churn and verify with contract tests plus a focused auth/API smoke if possible.
* `vue-tsc` `3.2.8` -> `3.3.3`: dev-only, but compiler tooling can change diagnostics. Update in the tooling batch only if the current tree is otherwise clean and failures can be attributed clearly.

Not recommended now:

* Do not upgrade `@types/node` to latest `25.9.2` or any Node 25 line while the project engine remains Node `>=24 <25`.
* Do not run `npm audit fix --force`; there are currently no audit findings and force can introduce unrelated major changes.
* Do not run a broad, unreviewed dependency sweep that mixes production and tooling updates in one task.
* Do not update direct dependencies that `npm outdated --depth=0` did not report unless a specific bug, security advisory, or compatibility issue requires it.

Execution record on 2026-06-06:

* Created a separate maintenance task: `.trellis/tasks/06-06-dependency-maintenance-workflow/`.
* Updated only the conservative dev/tooling batch:
  * `@types/node` `24.12.3` -> `24.13.1`.
  * `@vitejs/plugin-vue` `6.0.6` -> `6.0.7`.
  * `eslint` `10.3.0` -> `10.4.1`.
  * `vite` `8.0.12` -> `8.0.16`.
  * `vue` `3.5.34` -> `3.5.35`.
* Updated `package.json` and `package-lock.json`; no runtime source files were changed for this dependency batch.
* Confirmed retained versions after the update:
  * `axios` remains `1.16.0`.
  * `vue-tsc` remains `3.2.8`.
  * `@types/node` resolves to `24.13.1`; Node 25 typings remain intentionally unselected.
* `npm outdated --depth=0 --json` now reports only:
  * `@types/node` current/wanted `24.13.1`, latest `25.9.2`.
  * `axios` current `1.16.0`, wanted/latest `1.17.0`.
  * `vue-tsc` current `3.2.8`, wanted/latest `3.3.3`.
* Validation results:
  * `npm run lint` passed.
  * `npm run type-check` passed.
  * `npm run test:contracts` passed with 45 tests passing.
  * `npm test` passed with 45 contract tests passing and Docker/WebUI build completing through `vite v8.0.16`.
* `npm audit fix --force` was not run.

Remaining decisions after execution:

* `axios` `1.16.0` -> `1.17.0` remains a separate cautious production-dependency task. It should be validated against HTTP/auth/API flows rather than mixed into tooling maintenance.
* `vue-tsc` `3.2.8` -> `3.3.3` remains a separate cautious compiler-tooling task because it can change diagnostics and should be easier to attribute in isolation.
* Node 25 typings remain not recommended while `package.json` and package-lock root engines target Node `>=24 <25`; a Node 25 typings update should wait for a separate runtime-version decision.

Expected benefit:

* Keeps a long-running local WebUI service current without mixing dependency churn into feature tasks.

Likely scope:

* Periodic dependency-maintenance task: run prod-only audit, full audit, and direct-depth outdated checks; classify results into production vs dev/tooling before touching dependencies.
* First batch: safe dev/tooling patch/minor candidates, keeping `@types/node` on Node 24.
* Separate batch: `axios` production minor update, if desired, with HTTP/auth-oriented verification.
* Verification for any actual update: `npm run lint`, `npm run type-check`, `npm run test:contracts`, and `npm test`.
* Optionally add a documented command/checklist, not necessarily CI automation.
* Keep dependency updates out of auth/runtime/refactor commits unless a specific bug fix requires a single package change.

Risk:

* Blind dependency upgrades can disturb Vite/Vue/TypeScript tooling. Keep patch/minor updates separated from auth/runtime changes.
* Node-major-adjacent packages need extra care: the repo targets Node 24, so `@types/node` should not jump to the Node 25 line without a separate runtime-version decision.
* Production dependency updates, even same-major ones, can change HTTP behavior in ways that contract tests may not fully cover without a small runtime/auth smoke.

### I. Frontend resource-state simplification

Focus: reduce subtle state drift in fans/status/config refresh flows.

Evidence:

* Resource ownership is already split into `resource-config`, `resource-fans`, `resource-yuba`, and `resource-state`.
* `resource-fans.ts` still coordinates multiple loading flags, request sequence tracking, partial fans-status base/details loading, and managed config/fans application.
* `resource-state.ts` orchestrates top-level refresh behavior and force-refresh mapping.

Expected benefit:

* Fewer UI stale-state bugs after saves, force refresh, tab switches, and auth changes.

Likely scope:

* Small behavior tests around save response application, fans status base/details transitions, and stale request suppression.
* Only refactor state helpers after behavior tests exist.

Risk:

* Frontend refactor without browser smoke can miss visual/interaction regressions.

### J. Cache policy explicitness

Focus: make runtime cache TTL and invalidation policy more visible and easier to validate.

Evidence:

* `src/docker/runtime-cache.ts` owns 60s fans list, 5m fans status, and 10m Yuba status caches.
* Force refresh was recently added and covered by contract tests.
* TTLs and invalidation scopes are currently constants in code, not surfaced as status metadata.
* Read-only cache-backed routes support `?force=1` / `?force=true`, but force refresh is intentionally wired only through WebUI's top-right manual refresh path.
* Backend and WebUI pending-promise coalescing both take priority over force refresh: a force request bypasses a fresh completed snapshot, but it does not cancel or replace an already-running request.
* Backend invalidation is scoped and mostly coherent: cookie-source changes clear fans list plus all status caches; fans task changes and fans task execution invalidate fans status; Yuba task changes and Yuba task execution invalidate Yuba status.
* WebUI automatic loading and tab switching use frontend `loaded` flags. Once data is loaded in memory, switching back to a tab may not make a new backend request, so backend TTLs only take effect when some UI action actually requests the endpoint again.
* Task-save refresh paths are conservative. Fans-backed task saves can apply the returned reconciled fans immediately, then refresh the surface without force; the reconcile/save path itself may reuse the 60s fans-list cache.

Expected benefit:

* Easier to reason about "why did the UI show stale data?" without bypassing caches everywhere.
* Better support diagnostics for manual refresh vs automatic load behavior.
* Clearer user expectations around "refresh": current-tab force refresh, automatic lazy load, task-save refresh, and background task invalidation are different paths.

Likely scope:

* Add non-secret cache metadata to logs or internal diagnostics, or document cache policy more explicitly.
* Keep normal endpoint behavior unchanged.
* Document the current contract first: TTLs, force semantics, pending coalescing, invalidation scopes, and which WebUI paths use force.
* Consider exposing per-resource last-refreshed/cache-age metadata in the WebUI so users can distinguish "freshly fetched" from "showing last result".
* Consider a small tab-switch revalidation policy that asks the backend again after frontend data is older than the backend TTL, while still letting backend cache coalescing protect Douyu from duplicate requests.
* Decide explicitly whether fans reconcile/task-save should force the fans list when the user expectation is "sync latest fans now"; if changed later, keep it scoped because it increases Douyu-facing requests.

Risk:

* Exposing too much internal cache detail can confuse normal users.
* Current frontend `loaded` flags can let visible data outlive backend TTLs because TTL is enforced only when the endpoint is requested.
* A manual force refresh can still wait for an older in-flight non-force request, which may feel stale if the UI presents it as an absolute refresh.
* Making more paths force refresh by default could increase Douyu request volume and reduce the value of pending coalescing.

### K. Douyu API adapter contract hardening

Focus: reduce breakage when Douyu changes response HTML/JSON/protocol shapes.

Evidence:

* `src/core/api.ts` parses main-site HTML for fans badge table rows and room owner ids.
* `src/core/collect-gift.ts` implements the danmu WebSocket collect flow, including packet encoding/decoding and login response interpretation.
* `src/core/yuba-status.ts` and `src/core/yuba-check-in.ts` support multiple field names and fallbacks, but the current contracts are mostly encoded in code and tests, not a dedicated adapter-contract spec.
* `isCookieCredentialMessage` and retry eligibility still depend on stable error-message text.

Read-only assumption review on 2026-06-06:

* The current review was static and local only: no live Douyu requests were made, no fixtures/tests were added, and no raw cookie, LTP0, JWT, QR code, login ticket, or other sensitive value was recorded.
* Highest-risk assumptions found:
  * Fans badge parsing depends on the main-site HTML table still exposing `fans-badge-list`, row cells, and `data-anchor_name` / `data-fans-room` / `data-fans-level` / `data-fans-rank` attributes.
  * Gift sending depends on room pages still exposing `owner_uid = ...;` or `owner_uid: ...,` so `getDid()` can derive the owner id.
  * Backpack status depends on `japi/prop/backpack/web/v5` and `v1` returning `{ error, data: { list } }`, with gift id/count/name/expiry fields close enough to the current normalizer.
  * Glow-stick collection depends on the danmu WebSocket endpoint, packet framing, `loginreq`, `roomgroup@=1`, and `h5ckres` protocol messages staying compatible.
  * Yuba status/check-in depends on the current dy-token construction from main-site `acf_*` fields, Yuba follow/head/sign/fastSign/supplement payload shapes, SSO redirect behavior, and several Chinese error-message substrings.
* Brittle-point priority for future hardening: fans badge HTML parser, danmu WebSocket collect protocol, room owner id parser, Yuba check-in payload/message handling, Yuba dy-token/SSO chain, backpack payload parser, then credential-error classification.
* Suggested implementation shape: create a separate follow-up task that adds sanitized offline fixtures and parser/protocol contract tests only. Do not use live-network tests in CI, and do not store real authentication material in fixtures or logs.

Expected benefit:

* Better resilience and faster diagnosis when Douyu changes page markup or internal endpoints.
* Clearer split between "remote adapter changed" and "local config/cookie invalid".

Likely scope:

* Add focused parser fixtures/tests for fans HTML, room owner extraction, Yuba status payload variants, and danmu response parsing.
* Document adapter assumptions in `.trellis/spec/backend`.
* Avoid live-network tests in CI; use sanitized fixtures.

Risk:

* Capturing fixtures must avoid raw user cookies and sensitive payloads.
* Too many fixtures can fossilize outdated endpoint behavior if not curated.

### L. Error classification modernization

Focus: make credential-retry eligibility less dependent on fragile Chinese message substrings.

Evidence:

* Runtime recovery is triggered through `isCookieCredentialMessage(message)`.
* Core API helpers throw plain `Error` by design, with user-facing Chinese messages.
* Specs intentionally avoid a custom error hierarchy today, but auth recovery is now more complex and may benefit from a narrow internal classification helper or tagged result.

Expected benefit:

* Fewer false positives/negatives for recovery retry.
* Easier to distinguish "cookie expired", "remote endpoint changed", "Gee/CAPTCHA", and "business no-op".

Likely scope:

* Start with helper-level classification tests and a central list of credential/error phrases.
* Consider lightweight internal error metadata only if message classification becomes insufficient.

Risk:

* Introducing a broad error class hierarchy would conflict with current backend error-handling conventions.
* Public API error response shapes should remain stable.

### M. Task execution pacing and rate-safety review

Focus: review request pacing, concurrency, and retry behavior for Douyu-facing tasks.

Evidence:

* Gift sending sleeps 2 seconds between sends.
* Yuba sign interval randomizes between 5-8 seconds, with supplementary attempts capped at 10.
* Fans status double-card checks use concurrency 4.
* These values are hard-coded and not summarized in docs/specs.

Expected benefit:

* More deliberate rate-safety defaults for long-running NAS deployments.
* Clearer future tuning without scattering magic numbers.

Likely scope:

* Document current pacing constants and why they exist.
* Add tests that guard caps/concurrency if they are important.
* Defer user-configurable pacing unless a real need appears.

Risk:

* Making pacing configurable too early adds UI/config complexity.
* Over-optimizing speed may increase platform risk.

## Future Work Handling

This brainstorm task acts as an optimization roadmap and candidate pool. "MVP" means the smallest useful optimization to execute in the current implementation task, not the only optimization worth doing.

Completed optimization work that should not be re-scheduled:

* A. Auth recovery coherence: completed by `06-06-auto-recover-yuba-cookie` / `6667455 fix: recover yuba cookie from passport`.
* C. Contract-test modernization MVP: taxonomy and first behavior-route modernization completed by `5b74733` and `c2a60c8`; only feature-specific follow-up remains.
* D. Fan-backed config normalization cleanup: completed by archived `06-06-medal-sync-config-normalization-cleanup`.
* E. Focused WebUI smoke-finding fixes: completed by `06-06-focused-webui-smoke-finding-fixes` / `f7427f2 fix: prevent pre-auth cron preview state leak`.
* H. Dependency maintenance safe dev/tooling batch: completed by `06-06-dependency-maintenance-workflow` / `0f506a6 chore: update dev tooling dependencies`; remaining `axios` and `vue-tsc` decisions are separate optional tasks.

Final roadmap decision:

* E was selected as the only follow-up implementation task from this roadmap and has been completed.
* K/G/M/H and the other remaining candidates are not scheduled now. Keep them as reference notes only, to revisit if a concrete user-visible issue, dependency/security need, or future implementation change makes one relevant.
* No parallel optimization work is needed after E. This roadmap task can be archived after recording that conclusion.

Recommended follow-up process:

* Do not create additional optimization tasks from this roadmap by default.
* Move a remaining candidate into a future Trellis task only when the user explicitly selects it or a concrete bug/maintenance need appears.
* Each future task should start from this PRD's candidate notes, then create its own PRD with updated code inspection because the project may have changed.
* Avoid batching unrelated optimization themes into one task. Auth module boundary cleanup, WebUI smoke-finding fixes, diagnostics, adapter contracts, cache policy, and frontend resource-state work should be separate tasks unless a direct dependency forces them together.

Cross-session usage:

* A future session may reference this roadmap PRD directly and choose one or more candidate directions from it.
* Prefer one new Trellis task per optimization direction so scope, tests, commits, and rollback remain clear.
* Combining two directions is acceptable only when they are tightly coupled and touch the same implementation surface, for example fixing the WebUI login error visibility before adding a tiny Playwright smoke that asserts the same behavior.
* Avoid running two sessions that edit overlapping files in the same worktree at the same time. If true parallel work is needed, use separate branches/worktrees or finish and commit one direction before starting another overlapping direction.
* Before starting any future direction, re-check the current code and recent commits because this roadmap is a snapshot, not a frozen source of truth.

Parallelization guidance:

* Best serial sequence for user-visible polish: fix E's WebUI smoke findings first, then decide whether to add a tiny smoke/integration test around the fixed flow. The bug fix defines the stable behavior the smoke should assert.
* Best serial sequence for auth maintainability: K Douyu API adapter contract hardening -> L error classification modernization -> B auth module boundary cleanup. Fixture/parser contracts and narrower error classification reduce the risk of later auth refactors.
* Best serial sequence for cache/resource-state clarity: J cache policy explicitness -> I frontend resource-state simplification. J defines expected refresh/cache semantics before I changes frontend state orchestration.
* Safe-ish parallel pair in separate worktrees: E WebUI smoke-finding fixes + K Douyu API adapter contract hardening. They touch different surfaces: WebUI/runtime route behavior versus core parser/fixture contracts.
* Safe-ish parallel pair in separate worktrees: G config validation tightening + M task execution pacing/rate-safety review, if M remains documentation/tests around constants and G stays in config route validation.
* Safe-ish parallel pair in separate worktrees: H optional dependency splits + any read-only report. Once `axios` or `vue-tsc` is actually updated, keep it isolated from feature/refactor commits.
* Avoid parallelizing B auth module cleanup with F diagnostics, K adapter contracts, or L error classification in the same worktree; all can touch auth/runtime/core contract files or depend on the same error semantics.
* Avoid parallelizing J cache policy with I frontend resource-state simplification unless J is documentation-only; otherwise the semantics and frontend implementation may chase each other.
* Avoid running multiple write sessions in the same worktree. Use separate branches/worktrees for true parallel work, and merge one completed task at a time.

Final sequence after the 2026-06-06 completed work:

1. E focused WebUI smoke-finding fixes were completed in a separate task.
2. K/G/M/H and the other remaining candidates are deferred. Do not open parallel sessions for them unless the user makes a new explicit selection.
3. The roadmap has served its purpose and should be archived after this final PRD update.

Independent / read-only task guidance:

* Fully independent read-only tasks can run in a separate session because they do not edit source files. Examples: quality verification report, dependency audit/outdated report without upgrading packages, manual/WebUI smoke validation report, cache-policy review, and Douyu API assumption review with sanitized notes only.
* Read-only validation tasks should produce either a chat/report summary or a docs/task note; they should not silently change code, tests, package files, or lockfiles.
* Test-writing tasks are not read-only. Adding smoke tests, parser fixture tests, or contract-test replacements is safer than runtime code changes, but still modifies files and should be coordinated like normal implementation work.
* Dependency maintenance is independent only while it is audit/report-only. Once it updates `package.json` or `package-lock.json`, it becomes a separate implementation task and should not be mixed with feature/refactor work.

Optional copy-paste prompts for future read-only sessions, only if the user asks to revisit the topic:

1. Quality and dependency verification report: run the current quality gate and dependency checks, then report findings only. Do not modify files or upgrade packages.
2. Manual/WebUI smoke validation report: run the app if needed, inspect the WebUI/login/navigation/config/refresh flow, and report findings only. Do not add tests or modify files.
3. Cache policy review: inspect runtime/WebUI cache TTL, force-refresh, and invalidation behavior, then report whether the current behavior is coherent. Do not modify files.
4. Douyu API assumption review: inspect current Douyu endpoint, HTML, payload, and protocol assumptions, identify brittle spots, and report suggested future hardening only. Do not add fixtures/tests or modify files.

Current scheduling decision:

1. E is done.
2. No further roadmap-derived optimization task is scheduled.
3. Remaining candidates stay in this PRD as reference material, not as a backlog to execute automatically.

## Prioritization Matrix

### Completed / no longer near-term

* E. Focused WebUI smoke-finding fixes
  * Status: completed by `06-06-focused-webui-smoke-finding-fixes`.
  * Outcome: this was the only selected implementation task after the roadmap review.

### Deferred reference candidates

* K. Douyu API adapter contract hardening
  * Deferred because there is no current Douyu adapter breakage requiring preemptive fixture work.
* B. Auth module boundary cleanup
  * Deferred because no immediate auth refactor is needed after E.
* L. Error classification modernization
  * Deferred unless future failures show message-based classification is insufficient.
* F. Runtime observability and diagnostics polish
  * Deferred unless support/debugging pain becomes concrete.
* J. Cache policy explicitness
  * Deferred unless stale-status confusion becomes a repeated issue.
* I. Frontend resource-state simplification
  * Deferred unless new UI state drift appears.

### Not scheduled now

* G. Config validation and save-path tightening
  * Not needed unless config schema/save behavior changes resume.
* M. Task execution pacing and rate-safety review
  * Not needed unless request pacing or concurrency becomes a real issue.
* H. Optional dependency splits
  * Not needed now; `axios` and `vue-tsc` can wait for a security, bug, or maintenance-window reason.
* C/D completed follow-ups
  * Do not schedule generic contract-test modernization or fan-backed normalization again; only reopen them for a concrete new brittle assertion or new config duplication.

## Anti-Optimization Notes

* Do not do a broad "make files smaller" refactor without behavior tests. Current large files are mostly auth and contract-test hotspots, not random clutter.
* Do not add a schema library just to validate the current config shape; start with focused validators/tests.
* Do not make task pacing user-configurable unless there is a concrete user-facing problem.
* Do not replace all source-regex contract tests; keep forbidden-pattern guardrails where they protect architecture boundaries.
* Do not add broad browser automation to runtime login; if smoke coverage is added, keep it narrow and tied to a confirmed WebUI defect or navigation contract.
* Do not combine dependency upgrades with auth/runtime behavior changes.

## Acceptance Criteria (evolving)

* [ ] Candidate optimization opportunities are grounded in current repo files, specs, or recent tasks.
* [ ] Each candidate includes expected benefit, risk, and likely scope.
* [ ] One recommended future MVP direction is proposed without starting implementation.
* [ ] Out-of-scope items are explicit.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* Implementing code changes before the MVP direction is confirmed.
* Activating this task for implementation in the current turn.
* Rewriting the project architecture wholesale.
* Adding browser/CookieCloud write-back or credential flows outside the established auth boundaries.
* Large dependency upgrade work unless selected as a separate maintenance task.
* Completing every candidate optimization in one task.

## Technical Notes

* Task directory: `.trellis/tasks/06-06-project-optimization-opportunities`
* Initial context to inspect: README, package scripts, `src/`, tests, `.trellis/spec/`, archived optimization/auth tasks.
* Files inspected:
  * `package.json`
  * `README.md`
  * `tsconfig.docker.json`
  * `tsconfig.webui.json`
  * `src/core/douyu-passport.ts`
  * `src/docker/runtime-cookie-source.ts`
  * `src/docker/runtime-cookie-recovery.ts`
  * `src/docker/webui/cookie.ts`
  * `test/project-maintenance-contract.test.js`
  * `.trellis/tasks/archive/2026-05/05-29-full-code-architecture-optimization-analysis/optimization-analysis.md`
  * `.trellis/spec/backend/auth-cookie-lifecycle.md`
  * `.trellis/spec/backend/error-handling.md`
  * `.trellis/spec/backend/database-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
* Commands run:
  * `find src/test ...`
  * `wc -l` hotspot scan
  * `rg` for auth/cache/strictness markers
  * `npm audit --omit=dev --audit-level=moderate` -> 0 vulnerabilities
  * `npm outdated --depth=0 --json` -> later completed; safe dev/tooling batch was executed, leaving only optional `axios`, `vue-tsc`, and Node 25 typings decisions
* Re-check context on 2026-06-06:
  * Current git status: clean before this PRD update; `master` was ahead of `origin/master` by 17 commits.
  * Active Trellis tasks: only `.trellis/tasks/06-06-project-optimization-opportunities/` in planning state.
  * Recent completed optimization commits include `6667455`, `5b74733`, `c2a60c8`, `0f506a6`, and archived task commits for the corresponding tasks.
* Final roadmap close-out on 2026-06-06:
  * E completed in `f7427f2 fix: prevent pre-auth cron preview state leak` and was archived in `2ad3e78`.
  * User decision: do not schedule K/G/M/H or other parallel optimization tasks now.
  * This roadmap task is ready to archive after this PRD update is committed.
