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
- Shared config type: `ManualPassportConfig { ltp0: string }`.
- Runtime config field: `DockerConfig.manualPassport?: ManualPassportConfig`.
- WebUI/API save payload: `POST /api/config` may include `{ manualPassport: { ltp0: string } }`.
- Public config route: `GET /api/config -> { data: DockerConfig }` with `manualPassport.ltp0` masked when present.
- Internal raw route: `GET /api/config/raw -> { exists: boolean, data?: DockerConfig }` returns the raw saved field under the existing internal raw-config contract.
- Config summary may expose `manualPassportConfigured: boolean`, never the value.

### 3. Contracts
- Store only `LTP0` in `manualPassport`; read `dy_did` from the current main-site cookie during recovery.
- `normalizeDockerConfig` trims `manualPassport.ltp0`; an empty value removes `manualPassport` from normalized runtime config.
- `buildConfigWithPartialUpdate` must preserve existing `manualPassport` across unrelated config writes and replace it only when the update payload includes `manualPassport`.
- `/api/config` and mutation responses must mask `manualPassport.ltp0`; `/api/config/raw` intentionally remains raw like other internal config secrets.
- WebUI password inputs must not refill with the raw saved `LTP0`; status text may say only configured/unconfigured.

### 4. Validation & Error Matrix
- `manualPassport` missing -> no manual passport recovery material.
- `manualPassport.ltp0` blank or whitespace -> normalize to absent.
- `manualPassport` is not an object -> `POST /api/config` returns `400`.
- Unrelated task/config save -> existing `manualPassport` remains unchanged.
- Public config read/save response -> masked value or configured boolean only.
- Raw config read -> raw value is returned under the established internal endpoint behavior.

### 5. Good/Base/Bad Cases
- Good: user saves `manualPassport.ltp0`, `/api/config` returns a masked value, WebUI clears the password input and shows "configured".
- Good: user clears the field, normalization removes `manualPassport`, and recovery falls back to CookieCloud-only behavior if CookieCloud is active.
- Base: a task config save without `manualPassport` keeps the existing saved secret.
- Bad: adding a separate manual `dy_did` field instead of reading it from the main-site cookie.
- Bad: showing the raw `LTP0` in WebUI, logs, `/api/config`, tests, or diagnostics.

### 6. Tests Required
- Contract tests should assert `ManualPassportConfig` exists and `DockerConfig.manualPassport` is shared through `src/core/types.ts`.
- Contract tests should assert `config.example.json`, `createDefaultRawDockerConfig`, `buildConfigWithPartialUpdate`, and `normalizeDockerConfig` handle `manualPassport`.
- Route tests or contract tests should assert `/api/config` masks manual `LTP0`, `/api/config/raw` remains raw, and `POST /api/config` saves the field.
- Frontend contract tests should assert the login config UI uses a password input, saves `manualPassport.ltp0`, clears the raw input after loading config, and displays only configured/unconfigured state.

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
    ltp0: payload.manualPassport?.ltp0?.trim() || '',
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
