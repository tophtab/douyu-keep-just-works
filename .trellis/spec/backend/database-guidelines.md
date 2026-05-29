# Database Guidelines

> Persistence patterns and conventions for this project.

---

## Overview

This project does not use a database, ORM, migrations, or query layer. Durable backend state is the Docker config JSON file selected by runtime options and maintained through `src/docker/config-store.ts`.

The config object shape is defined in `src/core/types.ts`, normalized by `src/core/medal-sync.ts`, validated by `src/docker/config-validation.ts`, and persisted by `saveConfigToDisk`.

---

## Persistence Patterns

Treat config writes as full normalized snapshots:

```typescript
export function saveConfigToDisk(configPath: string, config: DockerConfig): void {
  const resolvedConfigPath = path.resolve(configPath)
  const dir = path.dirname(resolvedConfigPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(resolvedConfigPath, JSON.stringify(config, null, 2), 'utf-8')
}
```

When applying partial WebUI updates, merge through `buildConfigWithPartialUpdate` and then normalize. Do not mutate route payloads directly into the persisted object without validation.

---

## Migrations

There is no formal migration system. Backward compatibility is handled by config normalization when loading or saving:

- `loadConfigFromDisk` parses JSON and passes it to `normalizeDockerConfig`.
- runtime startup rewrites normalized config back to disk after a successful load.
- `createDefaultDockerConfig` supplies new default config shape.

If a future config shape changes, update the normalization path and contract tests rather than adding a separate migration directory.

---

## Scenario: Default Config Ownership

### 1. Scope / Trigger
- Trigger: changing Docker/WebUI default task config, cron values, active defaults, CookieCloud defaults, or example config.
- Scope: `src/core/task-defaults.ts`, config normalization, WebUI fallback state, and `config.example.json`.

### 2. Signatures
- Core default factory: `createDefaultRawDockerConfig(): DockerConfig`.
- Runtime user config: `config/config.json` or the configured Docker config path.
- WebUI raw config route: `GET /api/config/raw -> { exists: boolean, data?: DockerConfig }`.

### 3. Contracts
- `src/core` owns default values. WebUI fallback defaults must call a core factory or consume a backend response derived from core defaults.
- `config/config.json` is user-owned runtime state. Default changes must not overwrite saved user cron or active settings.
- `config.example.json` is documentation/sample input, not runtime state; it must stay aligned with core default cron constants through contract tests.

### 4. Validation & Error Matrix
- Saved config exists -> load and normalize saved values; do not replace user values with new defaults.
- Saved config is missing a known field -> normalization may fill that missing field from core defaults.
- `/api/config/raw` returns `exists: false` -> WebUI uses `createDefaultRawDockerConfig()` as fallback.
- Example cron differs from `DEFAULT_*_CRON` -> contract tests must fail.

### 5. Good/Base/Bad Cases
- Good: update `DEFAULT_KEEPALIVE_CRON`, use `createDefaultRawDockerConfig()` in WebUI fallback, update `config.example.json`, and keep a drift test.
- Base: a user saved `keepalive.cron = "0 0 8 */6 * *"` before a default changes to `*/7`; runtime continues using the saved `*/6`.
- Bad: hand-write a second `DEFAULT_RAW_CONFIG` object in WebUI or rewrite `config/config.json` just because defaults changed.

### 6. Tests Required
- Contract tests should assert `config.example.json` cron fields match `src/core/task-defaults.ts` constants.
- Contract tests should assert WebUI config state imports/uses `createDefaultRawDockerConfig()` and does not declare `DEFAULT_RAW_CONFIG`.
- Type-check WebUI after changing core defaults because `src/docker/webui` imports the browser-safe default module.

### 7. Wrong vs Correct

#### Wrong

```typescript
export const DEFAULT_RAW_CONFIG: DockerConfig = {
  keepalive: { active: true, cron: '0 0 8 */7 * *', model: 2, send: {} },
}
```

#### Correct

```typescript
import { createDefaultRawDockerConfig } from '../../core/task-defaults'

export function getRawConfig(): DockerConfig {
  return rawConfig.value || createDefaultRawDockerConfig()
}
```

---

## Scenario: Manual Passport Recovery Material

### 1. Scope / Trigger
- Trigger: adding or changing durable passport recovery material for manual-cookie mode.
- Scope: `DockerConfig.manualPassport`, config normalization, `/api/config` masking, `/api/config/raw`, WebUI login config saves, and `config.example.json`.

### 2. Signatures
- Shared config type: `ManualPassportConfig { cookie: string }`.
- Runtime config field: `DockerConfig.manualPassport?: ManualPassportConfig`.
- WebUI/API save payload: `POST /api/config` may include `{ manualPassport: { cookie: string } }`.
- Public config route: `GET /api/config -> { data: DockerConfig }` with `manualPassport.cookie` masked when present.
- Internal raw route: `GET /api/config/raw -> { exists: boolean, data?: DockerConfig }` returns the raw saved field under the existing internal raw-config contract.
- Config summary may expose `manualPassportConfigured: boolean`, never the value.

### 3. Contracts
- Store a visible `passport.douyu.com` cookie string in `manualPassport.cookie`; parse `LTP0` and `dy_did` from that cookie during recovery.
- Do not add a separate standalone `dy_did` field.
- CookieCloud persistence should write complete passport-domain material into `manualPassport.cookie` when the CookieCloud snapshot contains `LTP0`, so the saved local config remains the source of truth after sync.
- CookieCloud persistence should preserve an existing `manualPassport.cookie` when the remote passport material is absent or lacks `LTP0`.
- `normalizeDockerConfig` trims `manualPassport.cookie`; an empty value removes `manualPassport` from normalized runtime config.
- Normalization may migrate legacy `manualPassport.ltp0` into `manualPassport.cookie = "LTP0=<value>"` for compatibility.
- `buildConfigWithPartialUpdate` must preserve existing `manualPassport` across unrelated config writes and replace it only when the update payload includes `manualPassport`.
- `/api/config` and mutation responses must mask `manualPassport.cookie`; `/api/config/raw` intentionally remains raw like other internal config secrets.
- WebUI raw-config editing may show the saved passport cookie, matching the other local cookie fields.

### 4. Validation & Error Matrix
- `manualPassport` missing -> no manual passport recovery material.
- `manualPassport.cookie` blank or whitespace -> normalize to absent.
- `manualPassport` is not an object -> `POST /api/config` returns `400`.
- Unrelated task/config save -> existing `manualPassport` remains unchanged.
- CookieCloud persist with passport `LTP0` -> `manualPassport.cookie` is replaced with the composed CookieCloud passport cookie header.
- CookieCloud persist without passport `LTP0` -> existing `manualPassport.cookie` remains unchanged.
- Public config read/save response -> masked value or configured boolean only.
- Raw config read -> raw value is returned under the established internal endpoint behavior.

### 5. Good/Base/Bad Cases
- Good: user saves `manualPassport.cookie = "dy_did=...; LTP0=..."`, `/api/config` returns a masked value, and the raw-config WebUI keeps the visible cookie string available for editing.
- Good: CookieCloud sync receives `dy_did=...; LTP0=...` for `passport.douyu.com`, persists it to `manualPassport.cookie`, and later recovery reads the saved local value when needed.
- Good: user clears the field, normalization removes `manualPassport`, and recovery falls back to CookieCloud-only behavior if CookieCloud is active.
- Base: a task config save without `manualPassport` keeps the existing saved secret.
- Base: CookieCloud has no passport `LTP0`; the current saved manual passport cookie is retained.
- Bad: adding a separate manual `dy_did` field instead of reading it from the passport cookie string.
- Bad: CookieCloud sync saves main/yuba cookies but drops complete passport material, leaving the login page out of sync with local recovery state.
- Bad: showing the raw passport cookie in logs, `/api/config`, public diagnostics, or non-editing status surfaces.

### 6. Tests Required
- Contract tests should assert `ManualPassportConfig` exists and `DockerConfig.manualPassport` is shared through `src/core/types.ts`.
- Contract tests should assert `config.example.json`, `createDefaultRawDockerConfig`, `buildConfigWithPartialUpdate`, and `normalizeDockerConfig` handle `manualPassport`.
- Route tests or contract tests should assert `/api/config` masks manual passport cookie material, `/api/config/raw` remains raw, and `POST /api/config` saves the field.
- Tests should assert CookieCloud persist writes complete passport material into `manualPassport.cookie` and preserves existing manual passport material when CookieCloud lacks `LTP0`.
- Frontend contract tests should assert the login config UI uses a visible textarea, saves `manualPassport.cookie`, and displays configured/unconfigured state.

### 7. Wrong vs Correct

#### Wrong

```typescript
await saveTaskConfig({
  manualPassport: {
    ltp0: payload.manualPassport?.ltp0 || '',
    dyDid: payload.manualPassport?.dyDid || '',
  },
})
```

#### Correct

```typescript
await saveTaskConfig({
  manualPassport: {
    cookie: payload.manualPassport?.cookie?.trim() || '',
  },
})
```

---

## Naming Conventions

- Config interfaces live in `src/core/types.ts`.
- Runtime config persistence helpers live in `src/docker/config-store.ts`.
- Runtime validation helpers live in `src/docker/config-validation.ts`.
- User-facing config routes live in `src/docker/server-config-routes.ts`.

---

## Common Mistakes

- Do not introduce a database dependency for Docker runtime state without a task that explicitly changes storage architecture.
- Do not write raw request bodies directly to disk.
- Do not skip `normalizeDockerConfig`; it preserves compatibility with older config files.
- Do not log or expose raw cookies from config responses. `/api/config` masks secrets, while `/api/config/raw` is the intentional internal raw endpoint.
