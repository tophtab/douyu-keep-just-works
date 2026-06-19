# Backend Contracts

> High-risk backend contracts. Read only the section whose trigger matches the
> change.

---

## Contract Map

| Trigger | Section |
|---|---|
| Defaults, config normalization, examples, or manual passport persistence | [Config And Persistence Contracts](#config-and-persistence-contracts) |
| Runtime retry after login-cookie failures | [Credential Recovery Retry](#credential-recovery-retry) |
| Passport QR login, safeAuth, CookieCloud authority, or Yuba SSO | [Passport, Main-Site, And Yuba Cookie Authority](#passport-main-site-and-yuba-cookie-authority) |
| Backend-owned QR login route/session behavior | [Project-Owned Passport QR Login Snapshots](#project-owned-passport-qr-login-snapshots) |
| Glow-stick double-card detection or Douyu pocket card fields | [Glow-Stick Double-Card Detection](#glow-stick-double-card-detection) |
| Docker image stages, context, or workflow path filters | [Docker Image Build Cache](#docker-image-build-cache) |
| Docker task labels, schedule summaries, and active checks | [Docker Task Metadata Ownership](#docker-task-metadata-ownership) |

---

## Config And Persistence Contracts

### Default Config Ownership

Trigger: changing Docker/WebUI default task config, cron values, active defaults,
CookieCloud defaults, or `config.example.json`.

Contracts:

- `src/core/task-defaults.ts` owns default values through
  `createDefaultRawDockerConfig()`.
- WebUI fallback state must call a core factory or consume a backend response
  derived from core defaults; do not hand-write a second `DEFAULT_RAW_CONFIG`.
- Runtime user config is user-owned state. Default changes must not overwrite
  saved cron or active settings.
- `config.example.json` is sample input, not runtime state; keep it aligned
  with core default cron constants through contract tests.
- Missing saved fields may be filled by normalization; existing saved values are
  preserved.

Tests: assert example cron fields match `DEFAULT_*_CRON`, assert WebUI imports
the core default factory, and type-check WebUI when browser-safe defaults change.

### Manual Passport Recovery Material

Trigger: adding or changing durable Passport recovery material for manual-cookie
mode.

Contracts:

- Store the visible `passport.douyu.com` cookie string in
  `DockerConfig.manualPassport.cookie`; parse `LTP0` and `dy_did` from that
  cookie during recovery.
- Do not add a standalone `dy_did` field.
- CookieCloud persistence writes complete passport-domain material into
  `manualPassport.cookie` when the fresh snapshot contains `LTP0`, and preserves
  an existing manual passport cookie when remote material is absent or lacks
  `LTP0`.
- `normalizeDockerConfig` trims `manualPassport.cookie`; blank values remove the
  field. Legacy `manualPassport.ltp0` may migrate to `manualPassport.cookie`.
- `buildConfigWithPartialUpdate` preserves existing `manualPassport` across
  unrelated writes and replaces it only when the update payload includes it.
- Authenticated `/api/config` read/save responses are the complete editable
  config contract and may return raw saved cookies. Summary/status routes,
  diagnostics, logs, and QR status responses expose only booleans or structural
  facts.
- `GET /api/config/raw` must stay deleted.

Tests: cover shared types, normalization, partial updates, authenticated config
read/save, summary secret boundaries, CookieCloud passport persistence, and the
frontend visible textarea.

## Credential Recovery Retry

Trigger: a Docker runtime task or WebUI status load fails with a message
classified by `isCookieCredentialMessage`.

Contracts:

- Recovery eligibility is message-based; there is no custom error class
  hierarchy.
- Recovery runs only when CookieCloud is fully configured and active or saved
  `manualPassport.cookie` exists.
- `DockerRuntimeCookieRecoveryService` owns runtime retry eligibility, logging,
  and delegation to `DockerCookieSourceManager.recoverCredentialSnapshot(...)`.
  Task runners use `RuntimeTaskRunnerDeps.refreshCookieSourceAfterFailure`;
  they do not call `safeAuth`, inspect `LTP0`, or implement Yuba refresh.
- Recovery validates the current main cookie first with required-key checks and
  `getFansList()`.
- CookieCloud mode may force-persist the effective snapshot, then validate the
  synced main cookie before retrying.
- Passport `safeAuth` may run only when `LTP0` and `dy_did` are available from
  CookieCloud passport material, manual passport material, or the local main
  cookie. Persist the refreshed main snapshot only after validation passes.
- Yuba-related failures pass `recoverYubaCookie: true`; recovery reuses
  `fetchDouyuYubaCookiesWithPassport` and persists the refreshed Yuba snapshot
  with the validated main snapshot.
- If Yuba SSO fails after main recovery succeeds, keep the existing Yuba cookie,
  report the reason, and retry once only if the main snapshot changed.
- The original operation is retried exactly once.
- Recovery never writes refreshed cookies to CookieCloud/browser storage and
  never logs raw cookies, `LTP0`, passwords, or returned auth token values.

Tests: assert shared retry hooks exist, task runners do not directly reference
Passport refresh internals, recovery validates before persisting, safeAuth/Yuba
paths are covered, missing `dy_did` is explicit, and fan reconcile merges the
latest local cookie snapshot.

## Passport, Main-Site, And Yuba Cookie Authority

Trigger: changing Passport QR login, CookieCloud persistence, credential
recovery, task cookie selection, or Yuba SSO behavior.

Contracts:

- Passport `LTP0` plus matching device material (`dy_did`, `acf_did`,
  `game_did`) is the upstream Web SSO credential.
- `LTP0` is long-lived but not permanent. SafeAuth/QR flow validity is proven
  only when complete downstream fields are returned and validated.
- Main-site `www.douyu.com` business cookies are downstream snapshots. Runtime
  fields include `acf_uid`, `dy_did`, `acf_auth`, `acf_stk`, `acf_ltkid`,
  `acf_biz`, and `acf_ct`.
- Yuba `yuba.douyu.com` cookies are downstream snapshots minted through
  Passport plus a current main-site login. Runtime fields include
  `acf_yb_auth`, `acf_yb_uid`, and `acf_yb_t`.
- Observed lifetimes: QR `LTP0` around 182.5 days; main-site and Yuba auth/JWT
  around 6.125 browser-cookie days and about 7 JWT days; `acf_yb_t` around 1
  day. Do not assume safeAuth refreshes `LTP0`.
- Main-site business cookies are effectively single-active for the observed
  Passport/device flow. A newly minted main snapshot supersedes previous local
  or browser snapshots and should invalidate local caches.
- CookieCloud/browser snapshots and backend Passport refresh are not equal
  independent write authorities for `manualCookies.main`.
- Full recovery should rebuild a coherent set: refresh main from Passport,
  validate it, run Yuba SSO with that main snapshot, validate Yuba, then persist
  both snapshots together.
- Specs, tests, logs, public/status APIs, and diagnostics may include cookie
  names, max-age/expires metadata, validation status, and missing fields, never
  raw cookie values. Authenticated `/api/config` editing remains the exception.

Tests: cover QR material classification, main cache invalidation after Passport
refresh, full Passport main+Yuba recovery, no public secret leakage, and
centralized ownership in cookie-source/recovery services.

## Project-Owned Passport QR Login Snapshots

Trigger: changing WebUI Passport QR login, `/api/cookie-source/passport-login/*`,
or local passport/main/Yuba snapshot persistence.

Contracts:

- QR login creates project-owned local snapshots in
  `manualPassport.cookie`, `manualCookies.main`, and `manualCookies.yuba`; it
  never writes back to browser profiles or CookieCloud.
- `scan_code`, login ticket/code, `LTP0`, raw cookies, and login URLs are
  service-private. Public route responses may expose a rendered QR image data
  URL, derived booleans, status, message, and retry flags only.
- Public status flows `waiting -> scanned -> passport_confirmed -> main_saved
  -> yuba_saved`; `yuba_failed` is retryable only after passport/main saved.
- Backend QR sessions bootstrap browser-like device material before QR
  generation: `dy_did`, `acf_did`, and `game_did` should exist before `LTP0`.
  `passportSaved` means `LTP0` exists, not just device material.
- Passport/main success persists `manualPassport.cookie` and
  `manualCookies.main` immediately. Yuba success later persists
  `manualCookies.yuba`.
- Normalize the QR main login URL before requesting it: preserve returned query
  fields, add missing `callback=appClient_json_callback`, and add missing
  `_=<timestamp>`.
- Full Yuba SSO uses Passport `safeAuth` with `client_id=5`, follows and
  validates the `https://yuba.douyu.com/ybapi/authlogin` redirect, and requests
  that full one-time URL. `client_id=1` is the main-site bridge and must not be
  treated as Yuba SSO.
- Fresh Yuba SSO must not send previous local full Yuba snapshots into
  `safeAuth`; stale Yuba cookies can produce HTTP 400. Seed only current-run
  Yuba material and merge returned `acf_yb_auth` / `acf_yb_uid`.
- QR main-site missing-cookie errors identify the QR main-login exchange, not
  centralized safeAuth recovery.
- If Yuba SSO fails after main success, preserve the previous Yuba snapshot and
  expose retryability; do not discard working local Yuba cookies.
- CookieCloud persistence remains completeness-aware: incomplete fresh snapshots
  do not overwrite complete local main/Yuba snapshots.

Tests: cover QR session device material, public secret boundaries, QR main URL
normalization, `client_id=5` Yuba SSO redirect handling, stale Yuba exclusion,
passport/main persistence before Yuba, retryable Yuba failure, local Yuba
preservation, and route ownership in cookie-source services.

## Glow-Stick Double-Card Detection

Trigger: changing glow-stick double-card detection, active room filtering,
intimacy multiplier interpretation, or gift-scope behavior in
`src/core/double-card.ts`, `src/core/double-card-job.ts`, or related tests.

Source status: live Douyu API observations from June 7, 2026. Re-check APIs
before broadening accepted card types.

Contracts:

- `anchorPocket` and `effective` use the same observed `pid`, `type`, and
  `name` semantics. Prefer `pid` over `name` when distinguishing cards.
- `anchorPocket` returns full definitions including `intro` and usually `ext`.
  `effective` returns active records with `pid`, `type`, `name`, `tid`,
  `ctime`, and `expireTime`, but observed active records do not include `ext`.
- `ext.multiple` is the percentage multiplier (`200` means 2x). `ext.limitFactor`
  is the daily intimacy cap percentage, not the per-gift multiplier.
- For glow-stick jobs, treat only active `effective` records with `type === 1`
  and a future numeric `expireTime` as useful double-card state.
- Ignore `type === 22` for normal glow-stick users; observed copy limits it to
  diamond-fan users.
- Ignore `type === 32`; observed copy applies to gift-panel ordinary gifts or
  diamond-fan opening and excludes backpack props. Glow sticks use backpack
  donation behavior (`propId: 268`).
- Ignore `type === 2`, `24`, `30`, and `36` for glow-stick multiplier detection.
- Do not broaden detection to names containing double-card wording without API
  proof that the current user class and glow-stick gift path are eligible.

Tests: cover active future `type: 1`, expired/malformed `type: 1`, inactive
types `22`, `32`, and `2`, malformed `expireTime`, and the distinction between
Douyu card `type` values and project allocation `model` values.

## Docker Image Build Cache

Trigger: editing `Dockerfile`, `.dockerignore`, `.github/workflows/docker.yml`,
package metadata, TypeScript/Vite build config, or Docker image inputs.

Contracts:

- Docker context should be an allowlist aligned to Dockerfile inputs:
  `Dockerfile`, `.dockerignore`, `package.json`, `package-lock.json`,
  `tsconfig.docker.json`, `tsconfig.webui.json`, `vite.config.ts`, and `src/**`.
- Dependency install happens in a package-file-only stage before `COPY src`.
- Production dependency pruning derives from the dependency stage, not from a
  post-source build stage.
- Runtime copies production-pruned `node_modules` and compiled `build/docker`
  output from prior stages; it must not run a second runtime `npm ci`.
- Branch and pull request workflow triggers use path filters for image-affecting
  files while release tag and manual dispatch behavior remain available.

Tests: update `test/project-maintenance-contract.test.js` for Dockerfile stages,
`.dockerignore` allowlist, or workflow path filters. Verify lint, type-check,
contract tests, Docker WebUI build, and local Docker build when available.

## Docker Task Metadata Ownership

Trigger: adding or changing Docker task labels, "not configured" messages,
active-state checks, schedule summaries, or task inventory facts.

Contracts:

- Task-wide labels, schedule summaries, active checks, and "not configured"
  messages belong in `src/docker/task-metadata.ts` before they are repeated.
- Use `isTaskActive(config)` and `hasActiveTaskConfig(config)` instead of
  hand-writing `config && config.active !== false` checks or task `||` chains.
- Scheduled and manual task dispatch share `runRuntimeTask(type, taskConfig,
  deps)`.
- Keep task-specific cookie/status-cache behavior in `runtime-task-runners.ts`.
  Scheduler code owns cron lifecycle and locks, not task execution switches.
