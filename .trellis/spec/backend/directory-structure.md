# Directory Structure

> How backend code is organized in this project.

---

## Overview

This repository currently has one supported runtime:

- `src/docker/`: Express-based WebUI and scheduler for Docker deployments
- `src/core/`: Shared Douyu business logic used by the Docker runtime

The important rule is to keep runtime-specific wiring out of `src/core/`. HTTP routes, config file IO, scheduler assembly, browser launch flags, and log buffering belong in `src/docker/`; reusable Douyu API calls and gift workflows belong in `src/core/`.

---

## Directory Layout

```text
src/
├── core/
│   ├── api.ts
│   ├── collect-gift.ts
│   ├── double-card.ts
│   ├── gift.ts
│   ├── job.ts
│   └── types.ts
├── docker/
│   ├── cron.ts
│   ├── config-store.ts
│   ├── index.ts
│   ├── logger.ts
│   ├── runtime.ts
│   ├── server.ts
│   ├── webui.ts
│   └── webui/
│       └── index.html
```

---

## Module Organization

- Put Douyu-specific API calls, gift computation, and scheduling logic in `src/core/`.
- Put Docker-only bootstrapping, in-memory logs, config file IO, and Express routes in `src/docker/`.
- Keep shared runtime/domain types in `src/core/types.ts`; `src/docker/` imports from there.
- Prefer thin entrypoints that assemble dependencies and call shared functions.

Examples:

- `src/docker/index.ts` owns environment parsing and calls the Docker runtime.
- `src/docker/runtime.ts` owns startup, cron creation, and `AppContext` assembly.
- `src/docker/config-store.ts` owns config file IO and config-update assembly.
- `src/docker/server.ts` is limited to HTTP route registration and delegates work through `AppContext`.
- `src/docker/webui/index.html` owns the Docker WebUI document and client-side script.
- `src/docker/webui.ts` owns template loading plus runtime injection for app version and page routes.
- `src/core/job.ts` runs the gift workflow without knowing which HTTP route or scheduler triggered it.

---

## Naming Conventions

- Use lowercase kebab-free filenames with short nouns: `server.ts`, `logger.ts`, `job.ts`, `gift.ts`.
- Use `index.ts` only for runtime entrypoints such as `src/docker/index.ts`.
- Use verb-first exported function names for actions: `executeKeepaliveJob`, `createServer`, `parseDyAndSidFromCookie`.
- Use interface names in PascalCase and shared aliases in camelCase when the project already does so, for example `DockerConfig`, `JobConfig`, `sendConfig`.

---

## Examples

- Shared business logic: `src/core/job.ts`, `src/core/api.ts`, `src/core/gift.ts`
- Docker runtime wiring: `src/docker/index.ts`, `src/docker/runtime.ts`, `src/docker/server.ts`, `src/docker/logger.ts`, `src/docker/webui.ts`, `src/docker/webui/index.html`

---

## Anti-Patterns

- Do not put Electron-only APIs such as `BrowserWindow`, `ipcMain`, or `session` into `src/core/`.
- Do not reintroduce `src/main/`, `src/renderer/`, Electron packaging config, or desktop-only dependencies unless desktop support is explicitly restored.
- Do not duplicate Douyu API parsing logic in Docker route handlers when it can live in `src/core/api.ts`.
- Do not make route handlers contain large business workflows; keep those in reusable functions.

---

## Scenario: Docker-Only Runtime Boundary

### 1. Scope / Trigger

- Trigger: Any change that adds a runtime entrypoint, package script, build config, or dependency.
- Scope: The supported deployable is the Docker WebUI compiled by `npm run build:docker`.

### 2. Signatures

```json
{
  "scripts": {
    "build": "npm run build:docker",
    "build:docker": "rm -rf build/docker && tsc -p tsconfig.docker.json",
    "type-check": "tsc -p tsconfig.docker.json --noEmit"
  }
}
```

### 3. Contracts

- `tsconfig.docker.json` includes only `src/core/**/*.ts` and `src/docker/**/*.ts`.
- Docker image build copies `src/` and runs `npm run build:docker`.
- Runtime entrypoint remains `node dist/docker/index.js` inside the container.
- Local compiled entrypoint is `node build/docker/docker/index.js` before the Dockerfile copy step.

### 4. Validation & Error Matrix

| Case | Expected result |
|------|-----------------|
| New Docker route/service code | Compiles through `npm run build:docker` |
| New shared core code | Compiles through `npm run build:docker` and remains free of Express/runtime wiring |
| New Electron/Vue desktop code | Reject unless desktop support has been explicitly restored |
| New dependency | Verify it is imported by `src/core` or `src/docker`, not by deleted desktop paths |

### 5. Good/Base/Bad Cases

- Good: Add Express route handling in `src/docker/server.ts` and shared API parsing in `src/core/api.ts`.
- Base: Add a config field in `src/core/types.ts`, normalize it in `src/core/medal-sync.ts`, and expose it through Docker routes.
- Bad: Add `electron`, `vite`, `vue`, `src/main`, or `src/renderer` for behavior only used by Docker WebUI.

### 6. Tests Required

- Run `npm run build:docker`.
- Run `npm run type-check` when TypeScript contracts changed.
- Run `npm run lint` for touched TypeScript and config files.

### 7. Wrong vs Correct

#### Wrong

```text
src/main/main.ts
src/renderer/App.vue
electron-builder.json
```

#### Correct

```text
src/core/<shared-domain>.ts
src/docker/<runtime-boundary>.ts
```

## Scenario: Browserless Collect-Gift Runtime

### 1. Scope / Trigger

- Trigger: Any change to `src/core/collect-gift.ts`, Docker runtime dependencies, or the Docker image browser/system packages.
- Scope: The Docker runtime claims daily glow sticks by simulating Douyu live-room entry through the danmu WebSocket protocol, not by launching a browser.

### 2. Signatures

```typescript
export async function collectGiftViaDanmu(cookie: string, roomId: number | string): Promise<void>
```

```json
{
  "dependencies": {
    "ws": "<current>"
  }
}
```

### 3. Contracts

- `executeCollectGiftJob()` fetches the user's fans medal rooms with `getFansList()`, randomly selects one room, then calls `collectGiftViaDanmu(cookie, roomId)` before querying backpack status.
- `collectGiftViaDanmu()` opens `wss://wsproxy.douyu.com:6672`, sends `loginreq`, then sends `h5ckreq` after a successful `loginres`.
- A collect attempt succeeds only after receiving `type@=h5ckres`.
- The collect room must come from the current fans medal room list; do not hard-code a public room id.
- Runtime dependencies must stay lightweight: use `ws` for the WebSocket connection.
- The Docker image must not install Chromium or Puppeteer for collect-gift behavior unless the browser-based path is explicitly restored.
- Cookie values must only be sent to Douyu request headers/protocol payloads; never log full cookies.

### 4. Validation & Error Matrix

| Case | Expected result |
|------|-----------------|
| WebSocket handshake fails | Throw `领取荧光棒失败: <connection error>` |
| No expected Douyu response before timeout | Throw timeout error and close the socket |
| Fans medal list cannot be loaded | Throw collect failure before opening WebSocket |
| Fans medal list is empty | Throw collect failure before opening WebSocket |
| Selected room id is invalid | Throw invalid fans room error before opening WebSocket |
| `loginres` does not include `roomgroup@=1` | Throw Cookie danmu auth failure, including missing required cookie key names when known |
| `h5ckres` received | Resolve and let caller query backpack count |
| Docker image build | Runtime `node_modules` includes `ws`; Chromium/Puppeteer are absent |

### 5. Good/Base/Bad Cases

- Good: Keep Douyu packet encoding/decoding in `src/core/collect-gift.ts`; choose the room from `getFansList()` in `src/core/job.ts`.
- Base: If Douyu changes the room-entry protocol, update `collectGiftViaDanmu()` and preserve explicit timeout/auth errors.
- Bad: Re-add `puppeteer`, install Chromium in `Dockerfile`, or hide WebSocket failures by treating them as a successful collect.

### 6. Tests Required

- Run `npm run type-check`.
- Run `npm run lint`.
- Run `npm run build:docker`.
- Run `make docker-build` and verify Docker history has no Chromium install layer.
- Start the local image with `make docker-up` and verify the WebUI boots.

### 7. Wrong vs Correct

#### Wrong

```dockerfile
RUN apt-get update && apt-get install -y chromium --no-install-recommends
```

#### Correct

```typescript
const fans = await getFansList(cookie)
await collectGiftViaDanmu(cookie, fans[0].roomId)
```

## Scenario: Docker WebUI External Status Request Guardrails

### 1. Scope / Trigger

- Trigger: Any change to Docker WebUI routes or client flows that fetch Douyu-backed status/list data, especially fans, backpack, double-card, or Yuba status.
- Scope: Request throttling belongs in `src/docker/runtime.ts` at the Docker runtime boundary. Douyu parsing remains in `src/core/`; route registration remains thin in `src/docker/server.ts`; client-side lazy loading belongs in `src/docker/webui/index.html`.

### 2. Signatures

```typescript
AppContext.fetchFansStatusBase(): Promise<FansStatusResponse>
AppContext.fetchFansStatusDetails(): Promise<FansStatusResponse>
AppContext.fetchFansStatus(): Promise<FansStatusResponse>
AppContext.fetchYubaStatus(): Promise<YubaStatusResponse>
```

### 3. Contracts

- Docker WebUI status endpoints that fan out to multiple Douyu requests must use bounded in-memory cache slots instead of persistent storage or unbounded per-key caches.
- Each cached status endpoint may keep only the latest snapshot, an expiry timestamp, and at most one pending promise for request coalescing.
- General WebUI initialization must not eagerly fetch Yuba status. Load Yuba status only when the user opens the Yuba page or after Yuba-specific task actions.
- Cache invalidation must happen when cookies, CookieCloud-derived login state, related task configuration, fan-room synchronization, or status-changing tasks mutate the data shown by the endpoint.
- Response shapes must stay compatible with the existing Docker routes; caching must not add wrapper fields that the WebUI has to understand.
- Progressive fans status may split the read path into a list phase and a detail phase. The list phase may return `FanStatus` rows without `doubleActive` and with `complete: false`; the detail phase fills `doubleActive`, `doubleExpireTime`, and `gift`, stores the same full snapshot used by `/api/fans/status`, and returns `complete: true`.
- The list phase must not wait for backpack or per-room double-card calls when no complete status snapshot is fresh. It should use only the shared medal-list cache so large fan lists render quickly.
- Do not add Redis, databases, LRU libraries, or background polling for this guardrail unless requirements explicitly change.

### 4. Validation & Error Matrix

| Case | Expected result |
|------|-----------------|
| First status request and no valid cache | Fetch Douyu-backed status, store one snapshot, return existing response shape |
| Progressive base request and no complete cache | Return medal rows after the shared fan-list read; do not call backpack or double-card APIs |
| Progressive details request and no complete cache | Fetch backpack plus bounded double-card fan-out, store one complete snapshot, and return it |
| Progressive base request while complete cache is fresh | Return the complete snapshot immediately and let the client skip the detail request |
| Repeated request before TTL expiry | Return the cached snapshot without new Douyu requests |
| Concurrent requests while fetch is pending | Share the same pending promise; do not start duplicate upstream fan-out |
| TTL expires but no user requests status | Do nothing; do not refresh in the background |
| Cookie or CookieCloud login state changes | Clear fans and Yuba status caches |
| Fans/double/expiring task configuration changes | Clear fans status cache |
| Yuba task configuration changes | Clear Yuba status cache |
| Status-changing task completes or fails | Clear the relevant status cache in `finally` so later UI reads are not stale |

### 5. Good/Base/Bad Cases

- Good: `/api/fans/status` keeps one short-lived snapshot and coalesces overlapping WebUI refreshes.
- Good: WebUI overview calls `/api/fans/status/base` first, renders the table, then calls `/api/fans/status/details` to fill backpack and double-card state.
- Base: `/api/yuba/status` is loaded lazily from the Yuba page and uses a longer TTL because it can fan out across many followed groups.
- Base: Existing callers can continue to call `/api/fans/status` for the full response shape.
- Bad: WebUI startup calls fans status and Yuba status for every page load, or each browser tab starts its own full Douyu fan-out while another identical request is still in flight.
- Bad: The base phase calls `getGiftStatus()` or `checkDoubleCard()` before returning list rows.

### 6. Tests Required

- Run `npm run type-check`.
- Run `npm run lint`.
- Run `npm test` when Docker runtime wiring or build output may be affected.
- Review the client flow so non-Yuba page initialization does not call `/api/yuba/status`.
- Review invalidation paths for cookie save, CookieCloud persistence/sync, task config saves, fan sync, scheduled task execution, and manual task execution.

### 7. Wrong vs Correct

#### Wrong

```typescript
fetchYubaStatus: async () => {
  const groups = await getFollowedYubaStatusesWithDyToken(yubaCookie, mainCookie)
  return { groups }
}
```

#### Correct

```typescript
fetchYubaStatus: async () => {
  return await getCachedStatus(yubaStatusCache, YUBA_STATUS_CACHE_TTL_MS, async () => {
    const groups = await getFollowedYubaStatusesWithDyToken(yubaCookie, mainCookie)
    return { groups }
  })
}
```

## Scenario: Row-Level Backpack Status and Expiring Gift Budget

### 1. Scope / Trigger

- Trigger: Any change to Douyu backpack parsing, `/api/fans/status` gift fields, or expiring-gift send budgeting.
- Scope: Backpack parsing belongs in `src/core/api.ts`; expiring candidate selection belongs in `src/core/job.ts`; Docker routes and WebUI must consume normalized fields instead of raw Douyu payloads.

### 2. Signatures

```typescript
export async function getBackpackStatus(cookie: string, candidateRoomIds?: number[]): Promise<BackpackStatus>
export async function getGiftStatus(cookie: string, candidateRoomIds?: number[]): Promise<GiftStatus>
export function selectExpiringGiftCandidates(status: BackpackStatus, options: {
  thresholdHours: number
  now?: number
}): ExpiringGiftSelection
```

### 3. Contracts

- `getBackpackStatus()` returns normalized row data only: `giftId`, `name`, `count`, optional `expiry`/`expiryDays`, optional absolute millisecond `expireTime`, `batchInfoPresent`, `isValuable`, `price`, and `intimacy`.
- Absolute expiry fields must be normalized from known Douyu fields such as `expireTime`, `expire_time`, `expireAt`, `expiresAt`, `met`, or `endTime`. Unix seconds are converted to milliseconds.
- `getGiftStatus()` remains backward-compatible by returning the glow-stick summary as `count` and earliest glow-stick `expireTime`, while also exposing `rows` and `totalRows` for observability.
- `/api/fans/status` may return `gift.error` when backpack lookup fails after the fan list succeeds; failure must not be converted to `count: 0`.
- Expiring-gift jobs must budget from selected expiring rows, not from all visible glow-stick inventory after the earliest row enters the threshold.
- Automatic expiring-gift sending has no gift-ID whitelist. Any positive-count row with a normalized absolute `expireTime` inside `thresholdHours` is a candidate.
- Candidate counts are grouped by `giftId`; each group uses the existing room allocation settings and generated send jobs must set that group's `giftId`.
- The send API cannot target a backpack batch. Logs and UI must describe that only the candidate count is limited; Douyu controls the actual deduction order.

### 4. Validation & Error Matrix

| Case | Expected result |
|------|-----------------|
| Backpack body has non-zero Douyu `error`/`code` | Throw an actionable backpack error with upstream code/message |
| Backpack list is malformed | Throw an actionable format error |
| Row has no positive `count` | Exclude from expiring selection |
| Row has no absolute `expireTime` | Count as skipped without expiry; do not auto-send |
| Row expires after `thresholdHours` | Count as skipped not-expiring; do not include in budget |
| Multiple rows share `giftId` | Sum only candidate row counts for the send budget |
| Multiple candidate `giftId` values exist | Compute allocation separately per gift group and send each group with its own `giftId` |

### 5. Good/Base/Bad Cases

- Good: Parse every backpack `data.list[]` item once in `src/core/api.ts`, then reuse normalized rows for summary cards, WebUI tables, and expiring selection.
- Base: Single visible gift row behaves like the MVP: when it enters the threshold, its full visible count becomes the budget.
- Bad: Use `status.count` from `getGiftStatus()` as the expiring send budget after only `status.expireTime` enters the threshold.

### 6. Tests Required

- Run `npm run lint`.
- Run `npm run type-check`.
- Run `npm run build:docker`.
- For parser/selection changes, cover or manually verify: single gift row, multiple rows with only one expiring, multiple candidate gift IDs, missing absolute expiry, malformed backpack response, and Douyu business-error response.
- For WebUI changes, verify the expiring table shows per-row threshold status and auto-release status without a skip/release reason column, raw cookies, or raw backpack payloads.

### 7. Wrong vs Correct

#### Wrong

```typescript
if (status.expireTime && status.expireTime - Date.now() <= thresholdMs) {
  jobs = await computeGiftCountOfPercentage(status.count, send)
}
```

#### Correct

```typescript
const selection = selectExpiringGiftCandidates(backpackStatus, {
  thresholdHours,
})
jobs = await computeGiftCountOfPercentage(selection.budgetCount, send)
```

## Scenario: Docker-Only Edge/Latest Publishing

### 1. Scope / Trigger

- Trigger: Any change to package version metadata, release scripts, or workflow tag expectations.
- Scope: This is a Docker-only project. Default-branch pushes publish the moving development Docker tag `edge`; explicit semver git tags publish immutable numeric Docker tags and move `latest`. npm version/release helper scripts and Docker Hub tag queries are intentionally absent.

### 2. Signatures

```json
{
  "version": "2.2.0",
  "scripts": {
    "build": "npm run build:docker",
    "build:docker": "rm -rf build/docker && tsc -p tsconfig.docker.json",
    "type-check": "tsc -p tsconfig.docker.json --noEmit"
  }
}
```

```yaml
on:
  push:
    branches: [master]
    tags: ['V*.*.*', 'v*.*.*']
  pull_request:
    branches: [master]
```

```text
default branch push  -> edge
Vx.y.z tag build     -> exact x.y.z, latest
vx.y.z tag build     -> exact x.y.z, latest
pull request build   -> build only, no Docker Hub login or push
```

### 3. Contracts

- `package.json` and root `package-lock.json` version metadata must stay in sync.
- `package.json.version` is project metadata only; default-branch Docker publishing must not read it to decide image tags.
- Do not keep or add `version:*` or `release:*` package scripts. Docker image publishing is owned by `.github/workflows/docker.yml`.
- Ordinary `build`, `build:docker`, `test`, `type-check`, `lint`, and `start` scripts must not mutate package versions, create commits, create tags, or publish artifacts.
- Default-branch push builds must publish only the moving `edge` Docker tag.
- Default-branch push builds must not query Docker Hub for existing tags or auto-increment patch versions.
- Default-branch push builds must not publish `latest`.
- Manual release tag builds accept either `Vx.y.z` or `vx.y.z` and publish the exact numeric `x.y.z` Docker tag plus `latest`.
- Docker publishing must not create or publish major/minor aliases such as `2.1` or `2`.
- Docker publishing must not create or publish commit aliases such as `sha-*`.
- Pull request builds must validate the Docker image build without logging in to Docker Hub or pushing tags.
- The workflow must use least-privilege permissions and run lint, type-check, and Docker runtime build before Buildx publishing.
- Normal pull request and default-branch Docker builds must build only `linux/amd64`.
- Release tag Docker builds must publish a multi-arch manifest for `linux/amd64` and `linux/arm64`.
- Release tag Docker builds should build each architecture in a separate job:
  - `linux/amd64` on `ubuntu-latest`
  - `linux/arm64` on `ubuntu-24.04-arm`
- Do not use QEMU for normal Docker builds. Prefer native arm64 GitHub-hosted runners for release arm64 builds.
- Buildx Docker builds should use the GitHub Actions cache backend with platform-scoped caches such as `cache-from: type=gha,scope=docker-amd64` and `cache-to: type=gha,mode=max,scope=docker-amd64`.
- Release multi-arch publishing may push per-platform images by digest first, then combine them with `docker buildx imagetools create` for the public release tags.
- Pushed Docker builds may request Buildx SBOM and provenance output when supported without extra release steps.

### 4. Validation & Error Matrix

| Case | Expected result |
|------|-----------------|
| `master` push with package `2.2.0` | Publish `edge` only |
| `V2.2.0` tag push | Publish `2.2.0` and `latest` only |
| `v2.2.0` tag push | Publish `2.2.0` and `latest` only |
| `V2.1` or malformed release tag | Workflow rejects the tag |
| Pull request | Build validates, no Docker Hub login, no push |
| Workflow contains `2.1` or `2` tag aliases | Reject as moving major/minor aliases |
| Workflow contains `sha-*` publishing | Reject as unsupported commit aliases |
| Default-branch path reads `package.json.version` or queries Docker Hub tags | Reject as unsupported auto-patch publishing |
| Pull request or default-branch build enables `linux/arm64` | Reject because normal builds must stay amd64-only |
| Normal build sets up QEMU | Reject because QEMU is only a fallback for non-native multi-arch release builds |
| Release tag build publishes only one architecture | Reject because release tags must resolve to a multi-arch manifest |
| Release arm64 build runs on an amd64 runner through QEMU | Reject unless native arm64 hosted runners are unavailable and the fallback is intentional |
| Release platform jobs push public tags directly before manifest merge | Reject because public release tags should be written by the manifest job |
| Docker build omits Buildx GHA cache | Review why cache is intentionally disabled |

### 5. Good/Base/Bad Cases

- Good: A normal `master` push publishes `tophtab/douyu-keep-just-works:edge` only.
- Base: A pushed `v2.2.0` tag publishes `2.2.0` plus `latest`.
- Bad: Add npm release helper scripts for Docker publishing.
- Bad: Query Docker Hub to invent the next numeric patch tag on a branch push.
- Bad: A stable release publishes `2.1` or `2` aliases.
- Bad: A branch build publishes `latest` or a numeric Docker tag.
- Bad: A normal branch build spends CI time on QEMU-backed arm64 image construction.

### 6. Tests Required

- Run `npm run lint`.
- Run `npm run type-check`.
- Run `npm run build:docker`.
- Run `npm test`.
- Validate workflow YAML syntax.
- Simulate default-branch Docker tag preparation and verify it publishes `edge` only.
- Simulate manual `Vx.y.z` and `vx.y.z` tag preparation.
- Simulate pull request tag preparation and verify `push=false`.
- Verify pull request and default-branch Docker builds use `platforms: linux/amd64` only.
- Verify release tag builds cover both `linux/amd64` and `linux/arm64`.
- Verify release arm64 builds use `ubuntu-24.04-arm` or another native arm64 runner label when available.
- Verify release manifest creation combines per-platform digests with `docker buildx imagetools create`.
- Verify Docker Buildx steps include `cache-from: type=gha` and `cache-to: type=gha`.
- Search the workflow for forbidden published aliases such as `sha-*` and major/minor-only Docker tags.
- Search the workflow to verify it does not read `package.json.version` or query Docker Hub during tag preparation.
- Verify `package.json` has no `version:*` or `release:*` scripts.
- Verify `package.json`, `package-lock.json`, and `package-lock.json#packages[""].version` match.
- Verify QEMU is not used for normal Docker builds.
- Verify no git commit, git tag, GitHub Release, or Docker image was created unless the user explicitly requested publishing.

### 7. Wrong vs Correct

#### Wrong

```yaml
tags: |
  type=raw,value=latest,enable={{is_default_branch}}
  type=semver,pattern={{major}}.{{minor}}
  type=semver,pattern={{major}}
```

#### Correct

```text
master branch -> edge
V2.2.0        -> 2.2.0, latest
v2.2.0        -> 2.2.0, latest
pull request  -> build only, no push
```

```yaml
release-platform:
  strategy:
    matrix:
      include:
        - platform: linux/amd64
          runner: ubuntu-latest
        - platform: linux/arm64
          runner: ubuntu-24.04-arm
```
