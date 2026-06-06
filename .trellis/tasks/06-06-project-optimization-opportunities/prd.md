# brainstorm: project optimization opportunities

## Goal

Identify the most valuable optimization opportunities in the current project, with enough codebase-backed evidence to build a reusable optimization roadmap. This task is analysis-only until the user explicitly selects a later implementation task.

## What I already know

* The user asks for an assessment of current project optimization opportunities.
* The user explicitly invoked `trellis-brainstorm`, so this should be handled as requirements discovery before any implementation.
* The user chose "do not rush implementation; continue expanding the optimization analysis list".
* Recent work centered on Douyu Passport QR login, CookieCloud/local snapshot authority, Yuba SSO, runtime cache refresh, and auth cookie lifecycle documentation.
* Current codebase is Docker-first TypeScript backend plus Vue WebUI. Quality scripts include lint, Docker/WebUI type-check, contract tests, and Docker build.
* `npm audit --omit=dev --audit-level=moderate` currently reports 0 vulnerabilities.
* `npm outdated --depth=0` could not complete in this session due `ECONNRESET`; dependency freshness is not fully assessed yet.
* Backend strictness has improved since the older architecture report: `tsconfig.docker.json` now has `strict: true` and `noImplicitAny: true`.
* The old runtime composition-root concern is mostly reduced: `src/docker/runtime.ts` is now 166 lines, while current auth-related concentration moved to `src/docker/runtime-cookie-source.ts` and `src/core/douyu-passport.ts`.
* Largest current files include:
  * `test/douyu-passport-contract.test.js` ~819 lines
  * `test/project-maintenance-contract.test.js` ~552 lines
  * `src/docker/runtime-cookie-source.ts` ~548 lines
  * `src/core/douyu-passport.ts` ~532 lines
  * `src/core/medal-sync.ts` ~359 lines
* Recent lifecycle spec says full Passport recovery should rebuild a coherent main + Yuba set, but `src/docker/runtime-cookie-recovery.ts` currently refreshes only main via safeAuth and preserves the current Yuba cookie.
* WebUI cookie facade is now small (`src/docker/webui/cookie.ts`), because state/actions/copy have already been split into `cookie-source-state.ts`, `cookie-source-actions.ts`, and `cookie-source-copy.ts`.
* Contract tests are valuable but still include many source-text guardrails, especially in `test/project-maintenance-contract.test.js`; some are true forbidden-pattern checks, while others may make safe refactors noisy.

## Assumptions (temporary)

* "Optimization" may include maintainability, reliability, user-facing workflow robustness, test coverage, performance, and code architecture.
* The immediate output should be a ranked set of candidate optimization directions plus one recommended MVP direction.
* No runtime code should be changed until the user chooses a direction.
* The highest-value future implementation optimization is likely risk reduction around auth/cookie recovery rather than a broad architecture cleanup.
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

### A. Auth recovery coherence (recommended)

Focus: align runtime credential recovery with the new `auth-cookie-lifecycle.md` contract.

Evidence:

* `auth-cookie-lifecycle.md` says full recovery should refresh main-site cookies first, then run Yuba SSO with the new main cookie, then persist both snapshots after validation.
* `runtime-cookie-recovery.ts` currently safeAuth-refreshes only `manualCookies.main`, validates main through `getFansList()`, and persists the old/current Yuba cookie.
* This can leave a stale Yuba snapshot paired with a newly minted main snapshot, which the new spec explicitly calls out as a bad case for full recovery.

Expected benefit:

* Better reliability for scheduled tasks and WebUI reads after main-site expiry.
* Less risk of inconsistent local snapshots after Passport-derived refresh.
* Brings implementation, tests, and specs into alignment.

Likely scope:

* Backend only at first: `src/docker/runtime-cookie-recovery.ts`, `src/docker/runtime-cookie-source.ts`, `src/core/douyu-passport.ts` if helper signatures need adjustment, focused contract tests.
* Optional WebUI copy/status improvements if recovery result needs clearer user-facing messaging.

Risk:

* Touches credential recovery; must keep secret-masking and one-retry behavior strict.
* Yuba validation may require carefully chosen lightweight API checks to avoid unnecessary Douyu traffic.

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

### C. Contract-test modernization

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

### D. Fan-backed config normalization cleanup

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

### E. Runtime/WebUI smoke integration

Focus: add a small integration layer beyond contract/source tests.

Evidence:

* Existing tests are contract-heavy; there are no browser-level WebUI smoke tests or full route tests through a live server instance.

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

### H. Dependency maintenance workflow

Focus: make dependency freshness/audit checks more repeatable.

Evidence:

* Current audit passed with 0 vulnerabilities.
* `npm outdated --depth=0` failed in this session due network `ECONNRESET`, so freshness could not be assessed.
* Dockerfile and GitHub workflow already use Node 24 and `npm ci`; release workflow is solid.

Expected benefit:

* Keeps a long-running local WebUI service current without mixing dependency churn into feature tasks.

Likely scope:

* Periodic dependency-maintenance task: retry `npm outdated`, patch safe updates, run lint/type-check/build/tests.
* Optionally add a documented command/checklist, not necessarily CI automation.

Risk:

* Blind dependency upgrades can disturb Vite/Vue/TypeScript tooling. Keep patch/minor updates separated from auth/runtime changes.

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

Expected benefit:

* Easier to reason about "why did the UI show stale data?" without bypassing caches everywhere.
* Better support diagnostics for manual refresh vs automatic load behavior.

Likely scope:

* Add non-secret cache metadata to logs or internal diagnostics, or document cache policy more explicitly.
* Keep normal endpoint behavior unchanged.

Risk:

* Exposing too much internal cache detail can confuse normal users.

### K. Douyu API adapter contract hardening

Focus: reduce breakage when Douyu changes response HTML/JSON/protocol shapes.

Evidence:

* `src/core/api.ts` parses main-site HTML for fans badge table rows and room owner ids.
* `src/core/collect-gift.ts` implements the danmu WebSocket collect flow, including packet encoding/decoding and login response interpretation.
* `src/core/yuba-status.ts` and `src/core/yuba-check-in.ts` support multiple field names and fallbacks, but the current contracts are mostly encoded in code and tests, not a dedicated adapter-contract spec.
* `isCookieCredentialMessage` and retry eligibility still depend on stable error-message text.

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

Recommended follow-up process:

* Pick one candidate direction as the current MVP and keep its scope narrow.
* Move the other candidates into future Trellis tasks when the user wants to work on them.
* Each future task should start from this PRD's candidate notes, then create its own PRD with updated code inspection because the project may have changed.
* Avoid batching unrelated optimization themes into one task. Auth recovery, module boundary cleanup, test modernization, config normalization, and smoke testing should be separate tasks unless a direct dependency forces them together.

Suggested sequencing:

1. Auth recovery coherence.
2. Auth module boundary cleanup, after recovery behavior is aligned and covered.
3. Contract-test modernization, preferably before or alongside larger refactors.
4. Frontend resource-state simplification or fan-backed config normalization cleanup, depending on next visible pain point.
5. Runtime/WebUI smoke integration, when the team wants broader regression coverage.
6. Douyu API adapter hardening and error classification modernization when external endpoint drift becomes the main pain point.
7. Dependency maintenance and observability tasks can be scheduled independently because they have low coupling to feature work.

## Prioritization Matrix

### Highest leverage / near-term

* A. Auth recovery coherence
  * Why now: spec and implementation currently diverge on full recovery semantics.
  * Best next task shape: behavior fix plus focused tests.
* C. Contract-test modernization
  * Why now: it reduces friction for several later cleanup/refactor tasks.
  * Best next task shape: replace a small set of brittle shape checks, not the whole test suite.
* F. Runtime observability and diagnostics polish
  * Why now: auth/cookie support complexity is rising, and safe non-secret diagnostics will help future debugging.
  * Best next task shape: add high-signal recovery/cache/QR logs or diagnostics only.

### Medium leverage / sequence after behavior is stable

* B. Auth module boundary cleanup
  * Depends on A or equivalent behavior tests.
* I. Frontend resource-state simplification
  * Depends on behavior tests or smoke coverage for save/refresh paths.
* D. Fan-backed config normalization cleanup
  * Good maintenance value, but not the current highest user-visible risk.
* K. Douyu API adapter contract hardening
  * High value if endpoint drift continues; can be done anytime with sanitized fixtures.
* L. Error classification modernization
  * Best after A clarifies the desired recovery decision matrix.

### Lower urgency / independent maintenance

* E. Runtime/WebUI smoke integration
  * Useful, but adds infrastructure. Keep first pass tiny.
* G. Config validation and save-path tightening
  * Good if config shape changes resume.
* H. Dependency maintenance workflow
  * Keep independent from feature/auth tasks.
* J. Cache policy explicitness
  * Useful if users keep asking about stale status.
* M. Task execution pacing and rate-safety review
  * Valuable as documentation/guardrails; avoid premature configurability.

## Anti-Optimization Notes

* Do not do a broad "make files smaller" refactor without behavior tests. Current large files are mostly auth and contract-test hotspots, not random clutter.
* Do not add a schema library just to validate the current config shape; start with focused validators/tests.
* Do not make task pacing user-configurable unless there is a concrete user-facing problem.
* Do not replace all source-regex contract tests; keep forbidden-pattern guardrails where they protect architecture boundaries.
* Do not add browser automation to runtime login unless the HTTP-equivalent Passport/Yuba path stops working and a separate PRD scopes the risk.
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
  * `npm outdated --depth=0` -> blocked by network `ECONNRESET`
