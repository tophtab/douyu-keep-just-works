# Docker Medal Sync Contract

> **Purpose**: Define the executable cross-layer contract for Docker WebUI login, independent collection, medal-driven keepalive, and double-card management.

---

## Scope

This contract covers:

- persisted Docker config shape in `src/core/types.ts`
- Docker HTTP APIs in `src/docker/server.ts`
- medal reconciliation logic in `src/core/medal-sync.ts`
- Docker WebUI request/response expectations in `src/docker/webui/index.html`

It applies when the WebUI manages:

- Cookie
- collect-gift task config
- keepalive task config
- double-card task config
- theme preference
- medal-list-driven reconciliation

---

## Data Flow

```text
Douyu cookie
  -> independent collect scheduler (`collectGift`)
  -> GET medal list (`getFansList`)
  -> reconcile keepalive + doubleCard config (`reconcileDockerConfig`)
  -> save config to disk
  -> reload only affected Docker schedulers
  -> render latest config + task status + medal table in WebUI
```

Boundary owners:

- Douyu fetch + merge rules: `src/core/medal-sync.ts`
- config persistence + selective scheduler reload: `src/docker/index.ts`
- HTTP validation + JSON responses: `src/docker/server.ts`
- UI forms + save/sync actions: `src/docker/webui/index.html`

---

## Persisted Config Contract

File: `src/core/types.ts`

```ts
type ThemeMode = 'light' | 'dark' | 'system'

interface DockerUiConfig {
  themeMode?: ThemeMode
}

interface CollectGiftConfig {
  active?: boolean
  cron: string
}

interface JobConfig {
  active?: boolean
  cron: string
  model: 1 | 2
  send: Record<string, SendGift>
}

interface DoubleCardConfig extends JobConfig {
  enabled?: Record<string, boolean>
}

interface DockerConfig {
  cookie: string
  ui?: DockerUiConfig
  collectGift?: CollectGiftConfig
  keepalive?: JobConfig
  doubleCard?: DoubleCardConfig
}
```

Field rules:

- `*.active`
  - applies to `collectGift`, `keepalive`, and `doubleCard`
  - omitted old config defaults to `true` during normalize/load
  - `false` means keep the saved config payload but do not start scheduler wiring for that task
- `ui.themeMode`
  - allowed values: `light`, `dark`, `system`
  - omitted value defaults to `system`
- `collectGift.cron`
  - omitted old config is normalized to the default `0 10 3,5 * * *`
  - task is independent and has no medal-room payload
- `keepalive.send`
  - room set must match the current medal list after reconciliation
- `keepalive.model === 2`
  - `number >= 0` means the room receives exactly that fixed amount
  - `number = -1` is a sentinel meaning "receive the remainder after all explicit fixed counts"
  - at most one room may use `number = -1`
  - if no room uses `number = -1`, any extra fluorescent sticks remain unsent for that run
- `keepalive`
  - no longer persists `time` / `timeValue`
  - gifting always follows task execution directly
- `doubleCard.cron`
  - omitted old config is normalized to the default `0 20 17,20,22,23 * * *`
- `doubleCard.send`
  - room set must match the current medal list after reconciliation
  - when `doubleCard.model === 1`, the persisted `weight` field is treated as a proportion weight, not a literal percent total
  - old persisted `percentage` values must be migrated to `weight` during normalize/load
  - proportion weights may be any non-negative number and do not need to sum to `100`
  - when multiple rooms are currently double-active, runtime redistributes only among those active rooms using their saved weights
  - when exactly one room is currently double-active, runtime sends the full batch to that room
  - when zero rooms are currently double-active, runtime skips sending for that run
- `doubleCard.enabled`
  - key is room id string
  - `true` means the room participates in double-card detection and send candidate selection
  - missing value behaves as `false`

---

## HTTP API Contract

### `POST /api/config`

File: `src/docker/server.ts`

Purpose:

- save collect-gift config
- save keepalive config
- save double-card config
- save UI preference
- trigger post-save medal reconciliation when task config is present and cookie exists

Request payload:

```json
{
  "ui": { "themeMode": "system" },
  "collectGift": {
    "active": true,
    "cron": "0 0 0 * * *"
  },
  "keepalive": {
    "active": true,
    "cron": "0 0 8 * * *",
    "model": 1,
    "send": {
      "123456": {
        "roomId": 123456,
        "giftId": 268,
        "number": 0,
        "weight": 3,
        "count": 0
      }
    }
  },
  "doubleCard": {
    "active": true,
    "cron": "0 0 */4 * * *",
    "model": 1,
    "enabled": {
      "123456": true
    },
    "send": {
      "123456": {
        "roomId": 123456,
        "giftId": 268,
        "number": 0,
        "weight": 3,
        "count": 0
      }
    }
  }
}
```

Allowed omission/removal rules:

- omit `collectGift` to preserve current collect-gift config
- send `"collectGift": { "active": false, "cron": "..." }` to disable collect-gift while preserving cron
- omit `keepalive` to preserve current keepalive config
- send `"keepalive": { "active": false, "cron": "...", "model": 2, "send": { ... } }` to disable keepalive while preserving room config
- omit `doubleCard` to preserve current double-card config
- send `"doubleCard": { "active": false, "cron": "...", "model": 1, "enabled": { ... }, "send": { ... } }` to disable double-card while preserving room config
- send only `ui` to update theme preference without touching task configs

Success response:

```json
{
  "ok": true,
  "data": {
    "config": { "...": "latest persisted config" },
    "fans": []
  }
}
```

Notes:

- `data.fans` may be empty when saving UI-only changes or when task config is saved before cookie exists
- when keepalive or double-card config is saved and cookie exists, response config reflects post-reconciliation state
- saving only `collectGift` or `ui` does not trigger medal reconciliation
- disabling a task through `active: false` must not clear its persisted cron / model / send / enabled payload

### `POST /api/fans/reconcile`

File: `src/docker/server.ts`

Purpose:

- fetch the latest medal list using the saved cookie
- reconcile keepalive and double-card room config against the medal list
- persist the updated config

Request payload:

- none

Success response:

```json
{
  "config": { "...": "latest reconciled config" },
  "fans": [
    {
      "roomId": 123456,
      "name": "主播A",
      "level": 12,
      "rank": 34,
      "intimacy": "12345/15000",
      "today": 450
    }
  ]
}
```

---

## Reconciliation Rules

File: `src/core/medal-sync.ts`

### Keepalive

- if `keepalive` is not configured, do nothing
- if medal room already exists in `keepalive.send`, preserve the old send item
- if medal room is new:
  - `model === 1` -> default `weight = 1`
  - `model === 2` -> default `number = 1`
- rooms removed from the medal list must be removed from `keepalive.send`
- old `time` / `timeValue` fields are dropped during normalize/reconcile

### Double Card

- if `doubleCard` is not configured, do nothing
- if medal room already exists in `doubleCard.send`, preserve the old send item
- if medal room is new:
  - default send item follows the same model defaults as keepalive
  - `enabled[roomId] = false`
- if `enabled[roomId]` already exists, preserve it
- migration rule for old config without `enabled`:
  - existing `doubleCard.send[roomId]` means `enabled[roomId] = true`
  - new rooms default to `false`
- rooms removed from the medal list must be removed from both `doubleCard.send` and `doubleCard.enabled`

### UI Preference

- `ui.themeMode` defaults to `system`
- saving theme preference must not remove current collect-gift, keepalive, or double-card config

### Collect Gift

- if `collectGift` is missing in old persisted config, normalize to default cron `0 10 3,5 * * *`
- collect-gift does not depend on medal reconciliation and must survive medal sync unchanged

### Double Card

- if `doubleCard` is missing in old persisted config, normalize its cron fallback to `0 20 17,20,22,23 * * *`

---

## Validation Matrix

| Boundary | Condition | Result |
|----------|-----------|--------|
| `POST /api/config` | `collectGift.active` / `keepalive.active` / `doubleCard.active` present but not boolean | `400 { error }` |
| `POST /api/config` | invalid `collectGift.cron` / `keepalive.cron` / `doubleCard.cron` missing | `400 { error }` |
| `POST /api/config` | invalid `model` | `400 { error }` |
| `POST /api/config` | `send` missing or not object | `400 { error }` |
| `POST /api/config` | fixed-count mode has any room `number < -1` | `400 { error }` |
| `POST /api/config` | fixed-count mode has more than one room with `number = -1` | `400 { error }` |
| `POST /api/config` | `doubleCard.enabled` present but not object | `400 { error }` |
| `POST /api/config` | `doubleCard.model === 1` and all enabled rooms have weight `<= 0` | `400 { error }` |
| `POST /api/config` | `doubleCard.model === 1` and any room `weight` is negative / non-numeric | `400 { error }` |
| `POST /api/fans/reconcile` | cookie missing | `400 { error: '请先配置 cookie' }` |
| medal fetch | Douyu request fails | `500 { error }`, persisted config remains unchanged |
| medal fetch | empty medal list | persist empty room sets without throwing |

---

## Error Matrix

| Operation | Error Handling Rule |
|-----------|---------------------|
| save config | validate at route boundary, do not mutate config on invalid payload |
| reconcile medals | throw in helper, catch in route, return simple JSON error |
| start scheduler | log runtime failure and keep process alive |
| run collect-gift with missing cookie | reject at trigger/start boundary with actionable message |
| run double-card job with no enabled rooms | log actionable skip message and return successfully |
| run double-card job with weight mode and no positive enabled weight | reject with actionable validation error before save/run |

---

## Good / Base / Bad Cases

### Good

- current config has `collectGift.cron = 0 10 3,5 * * *`
- current keepalive has rooms `100`, `200`
- current double-card has rooms `100`, `200`, with `enabled.100 = true`, `enabled.200 = false`
- `doubleCard.model = 1`
- `doubleCard.send.100.weight = 1`
- `doubleCard.send.200.weight = 3`
- latest medal list becomes `100`, `200`, `300`

Expected:

- collect-gift config remains unchanged after reconciliation
- keepalive preserves `100`, `200` values
- keepalive adds `300` with default `1` or `1%`
- double-card preserves `100`, `200` send values
- double-card preserves existing enabled map
- double-card adds room `300` with default send value and `enabled.300 = false`
- if rooms `100` and `200` are both double-active at runtime, gifts are redistributed using weight `1:3`

### Base

- medal list unchanged, or user saves only collect-gift cron, or user edits double-card proportions without changing enabled state, or user disables a task and later re-enables it

Expected:

- reconciliation is idempotent
- saved config shape remains stable
- selective scheduler reload does not lose existing task values
- saving one task config does not emit restart logs for unrelated active tasks
- collect-gift save does not mutate medal-driven room payloads
- task disable only flips `active` and does not delete user-saved config
- double-card weight values do not need to sum to `100`
- WebUI preview may show derived percentages, but persisted payload keeps the raw proportion values

### Base: Keepalive Fixed-Count Without Remainder Room

- keepalive fixed-count mode
- room A `number = 1`
- room B `number = 1`
- room C `number = 1`
- current fluorescent stick total is `84`

Expected:

- keepalive runtime sends exactly `1 / 1 / 1`
- the remaining `81` sticks are preserved
- runtime does not implicitly redirect the remainder to the last room in sorted order

### Good: Keepalive Fixed-Count With Explicit Remainder Room

- keepalive fixed-count mode
- room A `number = 1`
- room B `number = 1`
- room C `number = -1`
- current fluorescent stick total is `84`

Expected:

- keepalive runtime sends `1 / 1 / 82`
- the room configured with `-1` is the only room allowed to receive the remainder

### Bad: Multiple Remainder Rooms

- keepalive fixed-count mode
- two or more rooms are saved with `number = -1`

Expected:

- `POST /api/config` returns `400`
- persisted config remains unchanged
- WebUI shows an actionable error telling the user fixed-count mode supports only one remainder room

### Bad: Reconcile Failure

- cookie exists but Douyu medal request fails

Expected:

- `/api/fans/reconcile` returns `500`
- previous config file remains unchanged
- WebUI surfaces the error and does not silently reset task config

### Bad: Invalid Proportion Save

- user saves `doubleCard.model = 1`
- checked rooms exist, but every checked room has `weight = 0`

Expected:

- `POST /api/config` returns `400`
- persisted config remains unchanged
- WebUI shows an actionable error telling the user to provide at least one positive proportion value

---

## Required Verification

Commands:

- `npm run build:docker`
- `node scripts/build.js`

Manual assertions:

- WebUI loads with no cookie and can save theme-only changes
- WebUI can save collect-gift cron before cookie is present
- saving Cookie enables medal reconciliation actions
- collect-gift can be enabled, disabled, and manually triggered from `登录与领取`
- keepalive fixed-count mode defaults new rows to `1`
- keepalive fixed-count mode with all rows set to `1` sends only those explicit counts and preserves any remainder
- keepalive fixed-count mode with exactly one row set to `-1` sends the remainder only to that row
- after medal reconciliation, keepalive rooms match medal list
- unchanged keepalive room values remain untouched
- disabling keepalive preserves the previously saved cron / model / send config after page refresh
- re-enabling keepalive resumes with the preserved user config instead of rebuilding defaults
- unchanged double-card room values and checked states remain untouched
- new medal rooms appear in keepalive and double-card
- new medal rooms are unchecked in double-card
- removed medal rooms disappear from both task configs
- keepalive form no longer exposes custom gift timing
- double-card execution skips when no room is checked
- double-card weight mode accepts raw weights such as `1 / 2 / 3` without requiring total `100`
- double-card page shows a weight preview for enabled rooms
- double-card page fast-fill actions can set enabled rooms to `1` or current fan level values
- overview displays collect-gift / keepalive / double-card status using Shanghai-time display

---

## Related Files

- `src/core/types.ts`
- `src/core/medal-sync.ts`
- `src/core/job.ts`
- `src/docker/index.ts`
- `src/docker/server.ts`
- `src/docker/webui/index.html`
- `config.example.json`
- `README.md`
