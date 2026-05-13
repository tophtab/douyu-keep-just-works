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
│   ├── yuba-check-in.ts
│   ├── yuba.ts
│   ├── yuba-common.ts
│   ├── yuba-status.ts
│   └── types.ts
├── docker/
│   ├── cron.ts
│   ├── config-validation.ts
│   ├── config-store.ts
│   ├── index.ts
│   ├── logger.ts
│   ├── runtime.ts
│   ├── server.ts
│   ├── task-metadata.ts
│   ├── webui.ts
│   ├── webui/
│       ├── app-actions.js
│       ├── app-data.js
│       ├── app-dom.js
│       ├── app-double-task-page.js
│       ├── app-events.js
│       ├── app-fans-resource-actions.js
│       ├── app-managed-data.js
│       ├── app-page-cron.js
│       ├── app-pages.js
│       ├── app-protected-state.js
│       ├── app-render.js
│       ├── app-resource-actions.js
│       ├── app-routing.js
│       ├── app-send-task-actions.js
│       ├── app-simple-task-actions.js
│       ├── app-system-resource-actions.js
│       ├── app-table-render.js
│       ├── app-task-actions.js
│       ├── app-task-pages.js
│       ├── app-yuba-resource-actions.js
│       ├── index.html
│       ├── styles.css
│       ├── styles-components.css
│       ├── styles-responsive.css
│       ├── styles-tables.css
│       └── app.js
│   └── webui-src/
│       ├── App.vue
│       ├── auth.ts
│       ├── index.html
│       ├── legacy-modules.d.ts
│       ├── main.ts
│       ├── navigation.ts
│       ├── request.ts
│       ├── theme.ts
│       └── toast.ts
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
- `src/docker/config-validation.ts` owns Docker config validation used by HTTP save routes.
- `src/docker/task-metadata.ts` owns task type labels and task-config lookup shared by runtime scheduling.
- `src/docker/runtime-task-runners.ts` owns Docker scheduled/manual task execution functions and status-cache invalidation scopes.
- `src/docker/server.ts` is a thin Express assembler: JSON middleware, WebUI fallback, auth boundary, and route-module registration.
- `src/docker/server-auth.ts` owns Docker WebUI session cookies, in-memory session lifecycle, auth routes, and the protected API boundary.
- `src/docker/server-*-routes.ts` files own cohesive Docker HTTP route groups and delegate work through `AppContext`.
- `src/docker/server-types.ts` owns the shared `AppContext` and `JobStatus` types re-exported by `server.ts` for existing imports.
- `src/docker/webui-src/index.html` owns the Vite HTML shell and runtime token placeholders.
- `src/docker/webui-src/App.vue` owns the current Docker WebUI document shell markup during the conservative Vue migration.
- `src/docker/webui-src/main.ts` owns Vue bootstrapping, CSS imports, and transitional legacy module import order.
- `src/docker/webui-src/auth.ts` owns Vue-side WebUI session checks, login, logout, unauthorized handling, and the legacy auth-state bridge.
- `src/docker/webui-src/navigation.ts` owns Vue-side page route state, History API syncing, tab keyboard navigation, and the legacy navigation event bridge.
- `src/docker/webui-src/request.ts` owns Vue-side JSON request handling, unauthorized forwarding, optional toast feedback, and the legacy `DOUYU_KEEP_WEBUI_REQUEST` bridge.
- `src/docker/webui-src/resources.ts` owns Vue-side read-only system resource loading for raw config, overview, and logs plus the legacy `DOUYU_KEEP_WEBUI_SYSTEM_RESOURCE_ACTIONS` bridge.
- `src/docker/webui-src/theme.ts` owns Vue-side theme mode state, persistence, system preference observation, and browser theme side effects.
- `src/docker/webui-src/toast.ts` owns Vue-side toast/live-region state and the legacy toast event bridge.
- `src/docker/webui/styles.css` owns Docker WebUI base variables, auth shell, navigation, and page shell styles.
- `src/docker/webui/styles-components.css` owns Docker WebUI cards, panels, forms, buttons, and task component styles.
- `src/docker/webui/styles-tables.css` owns Docker WebUI table, empty-state, log, toast, and screen-reader utility styles.
- `src/docker/webui/styles-responsive.css` owns Docker WebUI motion and responsive overrides.
- `src/docker/webui/app-actions.js` owns Docker WebUI action assembly, cookie-action wiring, and trigger actions.
- `src/docker/webui/app-data.js` owns Docker WebUI client-side metadata and default config constants.
- `src/docker/webui/app-dom.js` owns transitional DOM lookup, HTML escaping, date formatting, and toast event helper functions.
- `src/docker/webui/app-double-task-page.js` owns Docker WebUI double-card page rendering and double ratio controls.
- `src/docker/webui/app-events.js` owns Docker WebUI bootstrap, event listeners, auto-refresh, and startup auth flow.
- `src/docker/webui/app-fans-resource-actions.js` owns Docker WebUI fans reconcile/list/status resource loading actions.
- `src/docker/webui/app-managed-data.js` owns Docker WebUI managed fan/config state derivation and fan status merge helpers.
- `src/docker/webui/app-page-cron.js` owns Docker WebUI cron preview state rendering and preview API calls.
- `src/docker/webui/app-pages.js` owns Docker WebUI page rendering assembly plus overview, login, logs, and theme page rendering.
- `src/docker/webui/app-protected-state.js` owns Docker WebUI auth-protected and cookie-backed state reset helpers.
- `src/docker/webui/app-render.js` owns Docker WebUI shared HTML fragments, task cards, and render helper assembly.
- `src/docker/webui/app-resource-actions.js` owns Docker WebUI resource action assembly and active-surface refresh orchestration.
- `src/docker/webui/app-routing.js` owns Docker WebUI client-side route/path helpers.
- `src/docker/webui/app-send-task-actions.js` owns Docker WebUI room-send task save/disable actions for keepalive, double-card, and expiring gifts.
- `src/docker/webui/app-simple-task-actions.js` owns Docker WebUI simple task save/disable actions for collect-gift and Yuba check-in.
- `src/docker/webui-src/resources.ts` replaces the former `src/docker/webui/app-system-resource-actions.js` owner for Docker WebUI raw config, overview, and log resource loading actions during the Vue migration.
- `src/docker/webui/app-table-render.js` owns Docker WebUI table rendering helpers for status, Yuba, backpack, and send-room tables.
- `src/docker/webui/app-task-actions.js` owns Docker WebUI task action assembly.
- `src/docker/webui/app-task-pages.js` owns Docker WebUI task page rendering and double-card page-local controls.
- `src/docker/webui/app.js` owns the Docker WebUI client-side behavior script.
- `src/docker/webui/app-yuba-resource-actions.js` owns Docker WebUI Yuba status resource loading actions.
- `src/docker/webui.ts` owns Vite-built template loading plus runtime injection for app version and page routes.
- `src/core/job.ts` runs the gift workflow without knowing which HTTP route or scheduler triggered it.
- `src/core/yuba.ts` is the public Yuba facade that re-exports status and check-in workflows.
- `src/core/yuba-check-in.ts` owns Yuba sign-in, fast sign, supplementary sign, and followed-group check-in execution.
- `src/core/yuba-common.ts` owns reusable Yuba HTTP/header/body/parsing helpers shared by Yuba status and check-in code.
- `src/core/yuba-status.ts` owns followed Yuba group discovery, group-head parsing, and status aggregation.

---

## Naming Conventions

- Use lowercase kebab-free filenames with short nouns: `server.ts`, `logger.ts`, `job.ts`, `gift.ts`.
- Use `index.ts` only for runtime entrypoints such as `src/docker/index.ts`.
- Use verb-first exported function names for actions: `executeKeepaliveJob`, `createServer`, `parseDyAndSidFromCookie`.
- Use interface names in PascalCase and shared aliases in camelCase when the project already does so, for example `DockerConfig`, `JobConfig`, `sendConfig`.

---

## Examples

- Shared business logic: `src/core/job.ts`, `src/core/api.ts`, `src/core/gift.ts`
- Docker runtime wiring: `src/docker/index.ts`, `src/docker/runtime.ts`, `src/docker/server.ts`, `src/docker/logger.ts`, `src/docker/webui.ts`, `src/docker/webui-src/index.html`

---

## Anti-Patterns

- Do not put Electron-only APIs such as `BrowserWindow`, `ipcMain`, or `session` into `src/core/`.
- Do not reintroduce `src/main/`, `src/renderer/`, Electron packaging config, or desktop-only dependencies unless desktop support is explicitly restored.
- Do not duplicate Douyu API parsing logic in Docker route handlers when it can live in `src/core/api.ts`.
- Do not make route handlers contain large business workflows; keep those in reusable functions.
- Do not move Vite dev server into the Docker runtime; production must serve static Vite output through Express.
- Do not use Express wildcard path strings such as `app.get('*')` for WebUI fallback routing. Express 5 uses stricter path parsing; use an unmounted middleware that checks `req.method` and `req.path` instead.

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
    "build:webui": "npm run type-check:webui && vite build",
    "build:docker": "rm -rf build/docker && npm run build:webui && tsc -p tsconfig.docker.json",
    "type-check": "npm run type-check:docker && npm run type-check:webui"
  }
}
```

### 3. Contracts

- `tsconfig.docker.json` includes only `src/core/**/*.ts` and `src/docker/**/*.ts`.
- `tsconfig.docker.json` excludes `src/docker/webui-src`; Vue SFC checks run through `vue-tsc -p tsconfig.webui.json --noEmit`.
- Docker image build copies `src/` and runs `npm run build:docker`.
- `npm run build:docker` runs Vite first, writing static assets to `build/docker/docker/webui`, then compiles Docker TypeScript into the same build root.
- Runtime entrypoint remains `node dist/docker/index.js` inside the container.
- Local compiled entrypoint is `node build/docker/docker/index.js` before the Dockerfile copy step.
- Builder Docker install must keep optional dependencies so Vite/Rolldown can load its platform native binding.
- Runtime Docker install must omit dev dependencies, so Vue/Vite tooling stays builder-only and does not inflate production `node_modules`.
- Runtime Docker install may omit optional dependencies because it does not run Vite.

### 4. Validation & Error Matrix

| Case | Expected result |
|------|-----------------|
| New Docker route/service code | Compiles through `npm run build:docker` |
| New shared core code | Compiles through `npm run build:docker` and remains free of Express/runtime wiring |
| New Electron/Vue desktop code | Reject unless desktop support has been explicitly restored |
| New Docker WebUI Vue code | Build with `npm run build:webui` and keep Vite output under `build/docker/docker/webui` |
| New dependency | Verify it is imported by `src/core` or `src/docker`, not by deleted desktop paths |

### 5. Good/Base/Bad Cases

- Good: Add Express route handling in `src/docker/server.ts` and shared API parsing in `src/core/api.ts`.
- Base: Add a config field in `src/core/types.ts`, normalize it in `src/core/medal-sync.ts`, and expose it through Docker routes.
- Bad: Add `electron`, `src/main`, or `src/renderer` for behavior only used by Docker WebUI.
- Bad: Add Vue/Vite to production `dependencies` when they are only needed for builder-time WebUI assets.

### 6. Tests Required

- Run `npm run build:docker`.
- Run `npm run type-check` when TypeScript contracts changed.
- Run `npm run lint` for touched TypeScript and config files.
- For Docker WebUI source changes, run `npm run build:webui` or `npm test`.

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
