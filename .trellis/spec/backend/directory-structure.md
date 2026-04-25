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
│   ├── html.ts
│   ├── index.ts
│   ├── logger.ts
│   └── server.ts
```

---

## Module Organization

- Put Douyu-specific API calls, gift computation, and scheduling logic in `src/core/`.
- Put Docker-only bootstrapping, in-memory logs, config file IO, and Express routes in `src/docker/`.
- Keep shared runtime/domain types in `src/core/types.ts`; `src/docker/` imports from there.
- Prefer thin entrypoints that assemble dependencies and call shared functions.

Examples:

- `src/docker/index.ts` owns startup, config loading, cron creation, and `AppContext` assembly.
- `src/docker/server.ts` is limited to HTTP route registration and delegates work through `AppContext`.
- `src/docker/html.ts` owns the Docker WebUI document and client-side script served by Express.
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
- Docker runtime wiring: `src/docker/index.ts`, `src/docker/server.ts`, `src/docker/logger.ts`, `src/docker/html.ts`

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
