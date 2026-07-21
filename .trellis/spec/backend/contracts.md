# Backend Contracts

> High-risk backend contracts. Read only the section whose trigger matches the
> change.

---

## Contract Map

| Trigger | Section |
|---|---|
| Defaults, config normalization, examples, or login-cookie persistence | [Config And Persistence Contracts](#config-and-persistence-contracts) |
| Runtime retry after login-cookie failures | [Credential Recovery Retry](#credential-recovery-retry) |
| Passport QR login, safeAuth, CookieCloud authority, or Yuba SSO | [Passport, Main-Site, And Yuba Cookie Authority](#passport-main-site-and-yuba-cookie-authority) |
| Backend-owned QR login route/session behavior | [Project-Owned Passport QR Login Snapshots](#project-owned-passport-qr-login-snapshots) |
| Glow-stick double-card detection or Douyu pocket card fields | [Glow-Stick Double-Card Detection](#glow-stick-double-card-detection) |
| Gift send DID lookup reuse or `sendGifts` resolver behavior | [Task-Local Room DID Reuse](#task-local-room-did-reuse) |
| Docker image stages, context, or workflow path filters | [Docker Image Build Cache](#docker-image-build-cache) |
| GitHub Actions validation steps or quality-gate path filters | [Docker CI Quality Gate](#docker-ci-quality-gate) |
| fnOS FPK package source or release workflow | [fnOS FPK Release](#fnos-fpk-release) |
| Docker task labels, schedule summaries, and active checks | [Docker Task Metadata Ownership](#docker-task-metadata-ownership) |

---

## Config And Persistence Contracts

### Default Config Ownership

Trigger: changing Docker/WebUI default task config, cron values, enabled defaults,
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

### Login Cookie Recovery Material

Trigger: adding or changing durable Passport, main-site, or Yuba login cookies.

Contracts:

- Canonical persisted credentials are `DockerConfig.loginCookies` in the order
  `{ passport, main, yuba }`. The complete Passport cookie remains one string;
  recovery parses `LTP0` and `dy_did` from it.
- `normalizeDockerConfig` is the only legacy constructor. It accepts
  `manualCookies`, `manualPassport`, and top-level `cookie` only at disk/API
  boundaries, with canonical values taking precedence.
- CookieCloud persistence writes Passport material to `loginCookies.passport`
  only when fresh data contains `LTP0`, and preserves existing local values when
  a remote snapshot is incomplete.
- Authenticated `/api/config` responses may contain raw saved cookies. Overview,
  diagnostics, logs, and QR status expose only booleans or structural facts;
  `GET /api/config/raw` stays deleted.

Tests: cover canonical ordering, legacy/mixed precedence, partial updates,
authenticated config round trips, secret boundaries, CookieCloud persistence,
and the frontend visible cookie fields.

### Canonical Config And Legacy Boundary

#### 1. Scope / Trigger

Trigger: changing `DockerConfig`, allocation contracts, config loading,
normalization, persistence, API routes, or WebUI config state.

#### 2. Signatures

- `normalizeDockerConfig(input: unknown, options?): DockerConfig`
- `buildConfigWithPartialUpdate(current: DockerConfig | null, updates: DockerConfigUpdate): DockerConfig`
- `loadConfigFromDisk(configPath: string): DockerConfig | null`
- `saveConfigToDisk(configPath: string, config: DockerConfig): void`

#### 3. Contracts

- Public top-level order is `loginCookies`, `cookieCloud`, `ui`,
  `collectGift`, `keepalive`, `doubleCard`, `expiringGift`, `yubaCheckIn`.
- Scheduled task switches use `enabled`. Runtime card state and Vue tab/CSS
  state may still use `active`; do not use `active` for normal config.
- Gift allocation intent is discriminated by `allocationMode` and
  `roomAllocations`. Fixed entries contain only `count` (one optional `-1`),
  weighted entries contain only finite non-negative `weight`.
- Runtime `GiftSendJobs` are created after allocation and contain `roomId`,
  selected `giftId`, and actual `count`; they must not be persisted as config.
- `doubleCard.participatingRoomIds` stores selected rooms. `DoubleCardInfo.active`
  remains runtime detection state.
- Cron remains npm `cron` six-field syntax. Missing keepalive cron and the exact
  old default `0 0 8 */7 * *` normalize to `0 0 8 * * 3`; other expressions are
  trimmed and preserved.
- Successful API responses and disk writes contain canonical fields only.

#### 4. Validation & Error Matrix

- Canonical fields win over legacy aliases when both are present.
- Weighted entries containing `count`, fixed entries containing `weight`,
  non-finite/negative weights, non-integer counts below `-1`, or multiple `-1`
  entries -> `400` validation error.
- Legacy double-card room maps are accepted only at the API/disk boundary and
  are converted to `participatingRoomIds`.
- Invalid cron, task switches, CookieCloud fields, or allocation mode -> `400`;
  no invalid payload reaches persistence.

#### 5. Good/Base/Bad Cases

- Good: WebUI sends canonical config and applies the authoritative normalized
  response; runtime modules consume only `DockerConfig` and `GiftSendJobs`.
- Base: a legacy snapshot is normalized once, then rewritten canonically.
- Bad: a scheduler, task runner, or WebUI state module reads `manualCookies`,
  `model`, `send`, or `active` as a normal configuration field.

#### 6. Tests Required

- Assert canonical top-level/nested order and mixed-precedence fixtures.
- Assert fixed/weighted validation, `-1`, participating rooms, and stable gift
  counts.
- Assert config API validation, canonical response/persistence, Cookie masking,
  WebUI save-response application, and six-field cron migration.
- Run backend/frontend type checks, lint, contract tests, and Docker build.

#### 7. Wrong vs Correct

Wrong:

```json
{ "manualCookies": { "main": "..." }, "keepalive": { "model": 2, "send": {} } }
```

Correct:

```json
{
  "loginCookies": { "passport": "...", "main": "...", "yuba": "..." },
  "keepalive": {
    "enabled": true,
    "cron": "0 0 8 * * 3",
    "allocationMode": "fixed",
    "roomAllocations": { "123456": { "count": -1 } }
  }
}
```

## Credential Recovery Retry

Trigger: a Docker runtime task or WebUI status load fails with a message
classified by `isCookieCredentialMessage`.

Contracts:

- Recovery eligibility is message-based; there is no custom error class
  hierarchy.
- Recovery runs only when CookieCloud is fully configured and enabled or saved
  `loginCookies.passport` exists.
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
  independent write authorities for `loginCookies.main`.
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

- QR login creates project-owned local snapshots in `loginCookies.passport`,
  `loginCookies.main`, and `loginCookies.yuba`; it never writes back to browser
  profiles or CookieCloud.
- `scan_code`, login ticket/code, `LTP0`, raw cookies, and login URLs are
  service-private. Public route responses may expose a rendered QR image data
  URL, derived booleans, status, message, and retry flags only.
- Public status flows `waiting -> scanned -> passport_confirmed -> main_saved
  -> yuba_saved`; `yuba_failed` is retryable only after passport/main saved.
- Backend QR sessions bootstrap browser-like device material before QR
  generation: `dy_did`, `acf_did`, and `game_did` should exist before `LTP0`.
  `passportSaved` means `LTP0` exists, not just device material.
- Passport/main success persists `loginCookies.passport` and
  `loginCookies.main` immediately. Yuba success later persists
  `loginCookies.yuba`.
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

## fnOS FPK Release

### 1. Scope / Trigger

Trigger: changing `packaging/fnos/`, `.github/workflows/fnos-fpk.yml`, or the
`fnos-fpk` caller job in `.github/workflows/docker.yml`.

### 2. Signatures

- Reusable/manual workflow input: `release_tag: string`, matching
  `^[vV][0-9]+\.[0-9]+\.[0-9]+$` and resolving to an existing repository tag.
- Package placeholders: `manifest` owns `version=__VERSION__`; Compose owns
  image tag `__DOCKER_TAG__`. Both are replaced only in a temporary copy.
- fnOS runtime inputs: `TRIM_SERVICE_PORT` maps host port `51417`, and
  `TRIM_PKGVAR` mounts at `/app/config`.
- Release outputs:
  `douyu-keep-just-works-<version>-fnos.fpk` and its `.sha256` file.

### 3. Contracts

- The Docker tag workflow must call the reusable FPK workflow through a job
  that `needs: release-manifest`; independent tag workflows would race the
  multi-architecture image publication.
- The FPK contains no native executable and declares `platform=all`. Before
  packaging, the exact versioned Docker image must expose both `linux/amd64`
  and `linux/arm64` manifests.
- Reusable workflow calls retain the caller's event name. Select the build job
  with non-empty `inputs.release_tag`, not
  `github.event_name == 'workflow_call'`; branch/PR validation uses the empty
  input path and must not publish a Release.
- Official `fnpack` is version-pinned and SHA256-verified before execution.
  Build from a temporary stamped copy and reject unresolved placeholders.
- A direct browser entry uses `type=url` with port `51417`; `type=iframe` is
  an embedded fnOS window and is not interchangeable when the product
  requires a new WebUI page.
- Create or reuse the GitHub Release for the exact tag and upload deterministic
  FPK/checksum assets with idempotent replacement semantics.
- `cmd/main status` checks the stable Compose container name. The other eight
  `fnpack`-required lifecycle scripts remain executable successful no-ops
  because fnOS manages the declared Docker project.

### 4. Validation & Error Matrix

- Invalid or missing tag -> fail before package preparation.
- Exact image missing either required platform -> fail before `fnpack`.
- `fnpack` checksum mismatch -> fail before executing the downloaded tool.
- Unresolved version/image placeholder -> fail before package creation.
- Missing lifecycle file, invalid package metadata, or failed `fnpack` build ->
  no artifact or Release upload.
- Pull request or branch package change -> run package-only validation with
  read-only repository permission; do not enter the build/publish job.

### 5. Good/Base/Bad Cases

- Good: a `v3.9.0` tag publishes the two-platform Docker manifest, then creates
  `douyu-keep-just-works-3.9.0-fnos.fpk` on Release `v3.9.0`.
- Base: a package-source pull request checks static contracts, JSON, and
  Compose rendering without downloading an image or changing a Release.
- Bad: an `iframe` entry keeps the WebUI embedded in fnOS instead of opening
  the external page.
- Bad: a separate tag-triggered FPK workflow starts concurrently, references
  an image tag that is not published yet, or skips because it expects the
  reusable call's event name to be `workflow_call`.

### 6. Tests Required

- `test/fnos-packaging-contract.test.js` must assert package structure,
  executable lifecycle files, synchronized port/container/project values,
  durable config mapping, external URL entry shape, exact image placeholders,
  tool hash, platform checks, release commands, and `release-manifest`
  ordering.
- Run `actionlint` for workflow semantics, render Compose with test fnOS
  environment values, and run a real SHA256-verified `fnpack build` from a
  stamped temporary directory.
- Run the Docker CI quality gate after changing the caller workflow.

### 7. Wrong vs Correct

Wrong:

```yaml
on:
  push:
    tags: ['v*']
jobs:
  build-fpk:
    if: github.event_name == 'workflow_call'
```

Wrong package entry:

```json
{
  "type": "iframe",
  "port": "51417"
}
```

Correct package entry:

```json
{
  "type": "url",
  "port": "51417"
}
```

Correct:

```yaml
# In docker.yml, after the image manifest job:
fnos-fpk:
  needs: [validate, release-manifest]
  uses: ./.github/workflows/fnos-fpk.yml
  with:
    release_tag: ${{ github.ref_name }}

# In the reusable workflow:
build:
  if: inputs.release_tag != ''
```

## Docker Task Metadata Ownership

Trigger: adding or changing Docker task labels, "not configured" messages,
active-state checks, schedule summaries, or task inventory facts.

Contracts:

- Task-wide labels, schedule summaries, active checks, and "not configured"
  messages belong in `src/docker/task-metadata.ts` before they are repeated.
- Use `isTaskEnabled(config)` and `hasEnabledTaskConfig(config)` instead of
  hand-writing enabled checks or task `||` chains. Reserve `active` for runtime
  state such as `DoubleCardInfo.active`.
- Scheduled and manual task dispatch share `runRuntimeTask(type, taskConfig,
  deps)`.
- Keep task-specific cookie/status-cache behavior in `runtime-task-runners.ts`.
  Scheduler code owns cron lifecycle and locks, not task execution switches.
