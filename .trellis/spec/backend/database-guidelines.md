# Database Guidelines

> Persistence patterns and conventions for this project.

---

## Overview

This project does not use a database, ORM, migrations, or query layer. Durable backend state is the Docker config JSON file selected by runtime options and maintained through `src/docker/config-store.ts`.

The config object shape is defined in `src/core/types.ts`, normalized by `src/core/config-normalization.ts`, validated by `src/docker/config-validation.ts`, and persisted by `saveConfigToDisk`.

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

## Config Normalization

Only the current `DockerConfig` format is supported. Config snapshots are normalized when loading or saving:

- `loadConfigFromDisk` parses JSON and passes it to `normalizeDockerConfig`.
- runtime startup rewrites normalized config back to disk after a successful load.
- `createDefaultDockerConfig` supplies new default config shape.

Normalization trims values, fills missing current fields, and drops unknown
properties; it does not migrate old configuration fields. Credentials come from
`loginCookies` only. Task switches use `enabled`, allocations use
`allocationMode`/`roomAllocations`, and double-card selection uses
`participatingRoomIds`. Explicit saved cron expressions are preserved after
trimming, including former defaults.

Partial updates preserve unspecified current fields. An explicit empty cookie
clears that value; old aliases cannot overwrite saved credentials or task
settings. Do not reintroduce old-field readers in either disk normalization or
API merging. See the validation contract below for malformed current fields.

---

## Scenario Contracts

Read [Backend Contracts](./contracts.md#config-and-persistence-contracts) for
default config ownership, manual passport recovery material, and project-owned
Passport QR login snapshots. Keep this file focused on everyday persistence
rules.

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
- Do not skip `normalizeDockerConfig`; it fills current defaults and produces a stable persisted snapshot.
- Do not log raw cookies or expose them through summary/status responses. Authenticated `/api/config` is the complete editable config endpoint; `/api/config/raw` must stay deleted.
