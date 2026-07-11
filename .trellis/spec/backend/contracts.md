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
| Gift send DID lookup reuse or `sendGifts` resolver behavior | [Task-Local Room DID Reuse](#task-local-room-did-reuse) |
| Docker image stages, context, or workflow path filters | [Docker Image Build Cache](#docker-image-build-cache) |
| GitHub Actions validation steps or quality-gate path filters | [Docker CI Quality Gate](#docker-ci-quality-gate) |
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
  field. Recovery material uses the current complete-cookie shape only.
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

### Current Config Shape And Retired Legacy Fields

#### 1. Scope / Trigger

Trigger: changing `DockerConfig`, `SendGift`, `DoubleCardConfig`, config-file
loading, normalization, or persisted config examples.

#### 2. Signatures

- `normalizeDockerConfig(config: DockerConfig, options?): DockerConfig`
- `reconcileDockerConfig(config: DockerConfig, fans: Fans[]): DockerConfig`
- `loadConfigFromDisk(configPath: string): DockerConfig | null`

#### 3. Contracts

- Config normalization lives in `src/core/config-normalization.ts`.
- Send allocation uses `SendGift.weight`; `percentage` is not part of the
  current shape and is ignored if it appears in untyped JSON.
- Manual Passport recovery material uses `manualPassport.cookie` containing the
  complete visible cookie string; `manualPassport.ltp0` is not converted.
- Double-card selection uses explicit `doubleCard.enabled` values. Missing
  entries normalize to `false`; membership in `doubleCard.send` does not imply
  selection.
- The top-level `cookie` field remains part of the current Docker config
  contract and must not be removed as part of legacy-field cleanup.
- Missing current fields may still receive task defaults during normalization.

#### 4. Validation & Error Matrix

- Missing or non-finite `weight` -> use the task's current weight fallback.
- Blank `manualPassport.cookie` -> omit `manualPassport` from the normalized
  snapshot.
- Missing `doubleCard.enabled[roomId]` -> normalized value is `false`.
- Invalid current task fields such as cron/model/threshold -> existing
  normalization and route validation rules still apply.

#### 5. Good/Base/Bad Cases

- Good: `send[roomId].weight` and `doubleCard.enabled[roomId]` are explicit,
  and `manualPassport.cookie` contains `LTP0` plus available device material.
- Base: optional current fields are missing and normalization fills defaults.
- Bad: a snapshot relies only on `percentage`, `manualPassport.ltp0`, or a
  `send` entry to select a double-card room; those retired shapes are not
  migrated.

#### 6. Tests Required

- Assert current-shape normalization preserves explicit weights and enabled
  values while filling task defaults.
- Assert fan reconciliation preserves current settings and adds new rooms with
  task-specific defaults.
- Assert `manualPassport.cookie` is trimmed and blank material is removed.
- Run backend/frontend type checks after changing shared config interfaces.

#### 7. Wrong vs Correct

Wrong:

```json
{ "manualPassport": { "ltp0": "..." }, "doubleCard": { "send": { "100": {} } } }
```

Correct:

```json
{
  "manualPassport": { "cookie": "dy_did=...; LTP0=..." },
  "doubleCard": {
    "enabled": { "100": true },
    "send": { "100": { "roomId": 100, "number": 0, "giftId": 268, "weight": 1 } }
  }
}
```

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

## Task-Local Room DID Reuse

### 1. Scope / Trigger

Trigger: changing `sendGifts`, `getDid` lookup ownership, or multi-gift loops in
the expiring-gift and limited-time double-card jobs.

### 2. Signatures

- `createRoomDidResolver(cookie: string): (roomId: number) => Promise<string>`
- `sendGifts(..., options?: { resolveDid?: RoomDidResolver }): Promise<void>`

### 3. Contracts

- A resolver cache belongs to one task execution and is shared across gift
  groups in that task.
- Cache only fulfilled DID values. A rejected lookup is not retained and may be
  retried by a later gift group.
- Actual gift sends stay serial. Preserve failed-count carry-over, two-second
  spacing between attempts, and no delay after the final attempt.
- Do not put room DID values in the Docker runtime cache or increase Douyu
  request concurrency as part of lookup reuse.

### 4. Validation & Error Matrix

- Successful room lookup -> reuse the DID for later gift groups in the task.
- Failed room lookup -> current send attempt fails and carries its count; later
  groups may resolve the room again.
- Missing `sid` / `dy` -> keep the existing early log-and-return behavior.
- Failed gift send -> carry the attempted count to the next room exactly once.

### 5. Good/Base/Bad Cases

- Good: three gift groups targeting one room perform one successful room-page
  lookup and three serial gift sends.
- Base: a single-group keepalive task uses the default task-local resolver with
  no observable behavior change.
- Bad: caching a rejected promise permanently suppresses recovery, or sharing a
  cache across scheduled runs makes room ownership stale.

### 6. Tests Required

- Assert one successful DID lookup per room across multiple `sendGifts` calls.
- Assert failed DID lookup is retried.
- Assert send ordering, failed-count carry-over, and delay placement.

### 7. Wrong vs Correct

Wrong:

```typescript
for (const group of giftGroups) {
  await sendGifts(group.jobs, cookie, log) // resolves the same room every group
}
```

Correct:

```typescript
const resolveDid = createRoomDidResolver(cookie)
for (const group of giftGroups) {
  await sendGifts(group.jobs, cookie, log, group.label, group.taskLabel, { resolveDid })
}
```

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

## Docker CI Quality Gate

### 1. Scope / Trigger

Trigger: changing `.github/workflows/docker.yml`, contract-test inputs, lint
configuration, or the commands that gate Docker image publication.

### 2. Signatures

- Validation commands: `npm run lint`, `npm run type-check`,
  `npm run test:contracts`, `npm run build:docker`.
- Workflow inputs include application/build files plus `test/**` and
  `eslint.config.mjs`.

### 3. Contracts

- The existing `validate` job runs the lightweight contract suite before the
  Docker runtime build.
- Use `npm run test:contracts`, not `npm test`, because `npm test` would run
  `build:docker` and duplicate the workflow build step.
- Changes to tests or lint configuration must trigger validation.
- Preserve Docker tags, platforms, cache scopes, publish conditions,
  provenance, and SBOM behavior unless a separate release task changes them.

### 4. Validation & Error Matrix

- Lint/type/test/build failure -> validation job fails and Docker jobs do not
  proceed through the `needs: validate` dependency.
- Test-only change -> workflow validation is triggered.
- Release tag with green validation -> existing multi-platform publication
  continues unchanged.

### 5. Good/Base/Bad Cases

- Good: a contract regression fails before image publication.
- Base: an application change runs the same four quality commands in one
  validation job.
- Bad: calling `npm test` and then `npm run build:docker`, or omitting `test/**`
  so test changes bypass CI.

### 6. Tests Required

- Run the four validation commands locally before committing workflow changes.
- Review workflow path filters and confirm the contract-test step is in the
  `validate` job before `Build Docker runtime`.

### 7. Wrong vs Correct

Wrong:

```yaml
- run: npm test
- run: npm run build:docker
```

Correct:

```yaml
- run: npm run test:contracts
- run: npm run build:docker
```

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
