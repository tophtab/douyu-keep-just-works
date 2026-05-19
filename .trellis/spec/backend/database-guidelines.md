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
