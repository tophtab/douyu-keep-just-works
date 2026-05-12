# Docker Medal Sync Contract

> **Purpose**: Define the executable cross-layer contract for Docker WebUI cookie-source persistence, independent collection, medal-driven keepalive, double-card management, expiring fluorescent-stick gifting, and HTTP-based yuba check-in.

---

## Scope

This contract covers:

- persisted Docker config shape in `src/core/types.ts`
- cookie normalization / reconciliation in `src/core/medal-sync.ts`
- CookieCloud decrypt / selection / diagnostics in `src/core/cookie-cloud.ts`
- yuba HTTP list/head/sign logic through the `src/core/yuba.ts` public facade, implemented in `src/core/yuba-status.ts` and `src/core/yuba-check-in.ts`
- Docker HTTP APIs in `src/docker/server.ts`
- Docker runtime scheduling / trigger wiring in `src/docker/index.ts`
- Docker WebUI request/response expectations in `src/docker/webui/index.html`

It applies when the WebUI manages:

- manual login cookies
- CookieCloud-backed cookie fallback persistence
- collect-gift task config
- keepalive task config
- double-card task config
- expiring-gift task config
- yuba-check-in task config
- theme preference
- medal-list-driven reconciliation
- yuba followed-group status loading

---

## Data Flow

```text
manual cookies / CookieCloud
  -> resolve effective cookie per target hostname
  -> collect scheduler (`collectGift`)
  -> GET medal list (`getFansList`)
  -> reconcile keepalive + doubleCard + expiringGift config (`reconcileDockerConfig`)
  -> GET followed yuba groups + group head (`getFollowedYubaStatuses`)
  -> yuba scheduler (`yubaCheckIn`)
  -> save config to disk
  -> reload only affected Docker schedulers
  -> render latest config + task status + medal table / yuba table in WebUI
```

Boundary owners:

- cookie normalization + defaults: `src/core/medal-sync.ts`
- CookieCloud fetch / decrypt / diagnostics: `src/core/cookie-cloud.ts`
- yuba HTTP fetch / sign logic: `src/core/yuba.ts` facade over `src/core/yuba-status.ts` and `src/core/yuba-check-in.ts`
- config persistence + selective scheduler reload: `src/docker/index.ts`
- HTTP validation + JSON responses: `src/docker/server.ts`
- UI forms + save/sync actions: `src/docker/webui/index.html`

---

## Persisted Config Contract

File: `src/core/types.ts`

```ts
type CookieCloudCryptoType = 'legacy'
type ThemeMode = 'light' | 'dark' | 'system'
type YubaCheckInMode = 'followed'

interface ManualCookieConfig {
  main: string
  yuba: string
}

interface CookieCloudConfig {
  active?: boolean
  endpoint: string
  uuid: string
  password: string
  cryptoType?: CookieCloudCryptoType
}

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

interface ExpiringGiftConfig extends JobConfig {
  thresholdHours?: number
}

interface YubaCheckInConfig {
  active?: boolean
  cron: string
  mode?: YubaCheckInMode
}

interface DockerConfig {
  cookie: string
  manualCookies?: ManualCookieConfig
  cookieCloud?: CookieCloudConfig
  ui?: DockerUiConfig
  collectGift?: CollectGiftConfig
  keepalive?: JobConfig
  doubleCard?: DoubleCardConfig
  expiringGift?: ExpiringGiftConfig
  yubaCheckIn?: YubaCheckInConfig
}
```

Field rules:

- `manualCookies.main`
  - stores the persisted fallback cookie for `www.douyu.com` / `douyu.com`
  - if only old `config.cookie` exists, normalize it into `manualCookies.main`
- `manualCookies.yuba`
  - stores the persisted fallback cookie for `yuba.douyu.com`
  - may be empty; runtime then falls back to `manualCookies.main`
- `cookie`
  - legacy compatibility field
  - normalized to `manualCookies.main || manualCookies.yuba || ''`
- `cookieCloud.active`
  - `true` means runtime prefers CookieCloud cookies and manual cookies become fallback only
- `cookieCloud.cryptoType`
  - allowed value: `legacy`
  - Docker WebUI persists `legacy` and does not expose an algorithm selector
- `*.active`
  - applies to `collectGift`, `keepalive`, `doubleCard`, `expiringGift`, and `yubaCheckIn`
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
- `keepalive.model === 1`
  - the persisted `weight` field is treated as a proportion weight, not a literal percent total
  - proportion weights may be any non-negative number and do not need to sum to `100`
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
- `doubleCard.giftScope`
  - valid values are `glowStick` and `limitedTime`
  - omitted old config normalizes to `glowStick`
  - `glowStick` preserves the legacy behavior of budgeting from total visible fluorescent sticks
  - `limitedTime` budgets from positive-count backpack rows that have an absolute expiry, grouped and sent by `giftId`
- `doubleCard.enabled`
  - key is room id string
  - `true` means the room participates in double-card detection and send candidate selection
  - missing value behaves as `false`
- `expiringGift.cron`
  - omitted old config is normalized to the default `0 45 23 * * *`
- `expiringGift.thresholdHours`
  - positive number of hours before earliest visible fluorescent-stick expiry
  - omitted or invalid values normalize to `24`
- `expiringGift.model`
  - omitted or invalid values normalize to weight-based allocation (`model = 1`)
  - existing saved `model = 2` values are preserved and continue to use fixed-count behavior
- `expiringGift.send`
  - room set must match the current medal list after reconciliation
  - gifting reuses the existing keepalive allocation modes: `model = 1` weight-based allocation, `model = 2` fixed count
  - default weight-mode room rows seed the first synchronized fan-medal room with `weight = 1` and all other rooms with `weight = 0`
  - manual trigger with no configured room payload returns `400 { "error": "临期任务未配置" }`
- `expiringGift` runtime behavior
  - each run loads current fluorescent-stick count and earliest visible expiry via `getGiftStatus(cookie, roomIds)`
  - if count is `0`, expiry is missing, or remaining time is greater than `thresholdHours`, the run logs a skip reason and does not send
  - once within threshold, the task allocates against the current total visible count and sends glow sticks once using the saved room config
- `yubaCheckIn.mode`
  - currently only `followed` is valid
- `yubaCheckIn.cron`
  - omitted old config is normalized to default `0 23 0 * * *`
- `yubaCheckIn.active === false`
  - task remains persisted but scheduler must not start

---

## HTTP API Contract

### `POST /api/config`

File: `src/docker/server.ts`

Purpose:

- save manual cookies
- save CookieCloud config
- save collect-gift config
- save keepalive config
- save double-card config
- save expiring-gift config
- save yuba-check-in config
- save UI preference
- trigger post-save medal reconciliation when medal-driven task config is present and cookie exists

Request payload:

```json
{
  "manualCookies": {
    "main": "acf_uid=...",
    "yuba": "acf_yb_uid=..."
  },
  "cookieCloud": {
    "active": true,
    "endpoint": "https://cookiecloud.example.com",
    "uuid": "uuid",
    "password": "password",
    "cryptoType": "legacy"
  },
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
  },
  "expiringGift": {
    "active": false,
    "cron": "0 45 23 * * *",
    "thresholdHours": 24,
    "model": 1,
    "send": {
      "123456": {
        "roomId": 123456,
        "giftId": 268,
        "number": 0,
        "weight": 1,
        "count": 0
      }
    }
  },
  "yubaCheckIn": {
    "active": true,
    "cron": "0 23 0 * * *",
    "mode": "followed"
  }
}
```

Allowed omission/removal rules:

- omit `manualCookies` to preserve current manual cookies
- omit `cookieCloud` to preserve current CookieCloud config
- omit `collectGift` to preserve current collect-gift config
- send `"collectGift": { "active": false, "cron": "..." }` to disable collect-gift while preserving cron
- omit `keepalive` to preserve current keepalive config
- send `"keepalive": { "active": false, "cron": "...", "model": 2, "send": { ... } }` to disable keepalive while preserving room config
- omit `doubleCard` to preserve current double-card config
- send `"doubleCard": { "active": false, "cron": "...", "model": 1, "giftScope": "glowStick", "enabled": { ... }, "send": { ... } }` to disable double-card while preserving room config
- omit `expiringGift` to preserve current expiring-gift config
- send `"expiringGift": { "active": false, "cron": "...", "thresholdHours": 24, "model": 1, "send": { ... } }` to disable expiring-gift while preserving room config
- omit `yubaCheckIn` to preserve current yuba-check-in config
- send `"yubaCheckIn": { "active": false, "cron": "...", "mode": "followed" }` to disable the yuba scheduler while preserving cron / mode
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
- when keepalive, double-card, or expiring-gift config is saved and cookie exists, response config reflects post-reconciliation state
- saving only `collectGift`, `yubaCheckIn`, cookie-source fields, or `ui` does not trigger medal reconciliation
- disabling a task through `active: false` must not clear its persisted cron / model / send / enabled payload
- saving `manualCookies` or `cookieCloud` must restart runtime cookie resolution state without mutating medal-room config

### `POST /api/fans/reconcile`

File: `src/docker/server.ts`

Purpose:

- fetch the current medal list using the effective main-site cookie, reusing the short-lived in-memory medal-list cache when still valid
- reconcile keepalive, double-card, and expiring-gift room config against the medal list
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

### `GET /api/fans/status`

Files:

- route: `src/docker/server.ts`
- response assembly: `src/docker/index.ts`
- upstream backpack + medal parsing: `src/core/api.ts`
- WebUI consumer: `src/docker/webui/index.html`

Purpose:

- fetch the current medal list using the effective main-site cookie, reusing the short-lived in-memory medal-list cache when still valid
- fetch the current fluorescent stick inventory from Douyu backpack API
- merge per-room double-card status with global fluorescent stick summary for the overview page

Success response:

```json
{
  "fans": [
    {
      "roomId": 71415,
      "name": "主播A",
      "level": 18,
      "rank": 2,
      "intimacy": "12345/15000",
      "today": 450,
      "doubleActive": true,
      "doubleExpireTime": 1776614399000
    }
  ],
  "gift": {
    "count": 168,
    "expireTime": 1776614399000
  }
}
```

Field mapping rules:

- `fans`
  - sourced from the cached `getFansList(cookie)` helper and sorted by medal level descending
- `fans[].doubleActive`
  - sourced from `checkDoubleCard(roomId, cookie)`
- `fans[].doubleExpireTime`
  - sourced from the double-card API and normalized to Unix milliseconds
- `gift.count`
  - summed from all backpack list entries where `id === 268`
- `gift.expireTime`
  - sourced from the earliest valid expiry among fluorescent stick backpack entries
  - Douyu backpack payload may expose expiry as `expireTime`, `expire_time`, `expireAt`, `expiresAt`, `met`, or `endTime`
  - `met` is currently the observed field for fluorescent sticks and arrives as Unix seconds, so it must be normalized to Unix milliseconds before returning to WebUI

Notes:

- `gift` is global inventory summary and must not be duplicated into each medal row
- when no fluorescent stick entry exists, respond with `{ "count": 0 }`
- when fluorescent stick count exists but no valid expiry field exists, omit `gift.expireTime`
- WebUI overview renders `gift.expireTime` with Shanghai-time formatting and displays `无` when the field is omitted

### `GET /api/fans/status/base`

Purpose:

- return the current medal list quickly for progressive WebUI rendering
- reuse the complete `/api/fans/status` snapshot when it is still fresh
- otherwise reuse only the shared medal-list cache and avoid backpack or double-card fan-out

Base response when no complete snapshot is fresh:

```json
{
  "fans": [
    {
      "roomId": 71415,
      "name": "主播A",
      "level": 18,
      "rank": 2,
      "intimacy": "12345/15000",
      "today": 450
    }
  ],
  "gift": {},
  "complete": false,
  "statusPhase": "list"
}
```

Contracts:

- `fans[].doubleActive` is optional in this response. The WebUI must render an in-progress state when it is absent.
- If the full status cache is fresh, this endpoint may return the same complete payload as `/api/fans/status` with `complete: true`, allowing the client to skip the detail call.
- Failure to fetch the medal list fails the whole response with the same error behavior as `/api/fans/status`.

### `GET /api/fans/status/details`

Purpose:

- fill the backpack summary and per-room double-card state after the medal rows are already visible
- share the same complete status cache as `/api/fans/status`

Success response:

- Same shape as `GET /api/fans/status`
- Includes `complete: true` and `statusPhase: "details"`

Contracts:

- Concurrent detail requests share the same pending complete-status promise.
- Backpack failure after a successful medal list remains a degraded `200` with `gift.error`.
- Per-room double-card lookup failures remain row-level degraded results with `doubleActive: false` and a system log entry.

### `GET /api/yuba/status`

Files:

- route: `src/docker/server.ts`
- runtime assembly: `src/docker/index.ts`
- upstream list/head fetch: `src/core/yuba-status.ts` through the `src/core/yuba.ts` facade
- WebUI consumer: `src/docker/webui/index.html`

Purpose:

- fetch followed yuba groups
- expand each group with `group/head` details
- return the current yuba level / exp / rank / sign state list for the fish-bar page
- status loading may use the dy-token-backed `myFollow` + `group/head` path, but the response must remain the same `YubaGroupStatus` shape consumed by the existing WebUI table
- dy-token-backed `group/head` must provide the rendered fields (`groupName`, `groupLevel`, `groupExp`, `nextLevelExp`, `rank`, `isSigned`); if those fields are missing, fall back to the existing yuba-cookie `group/head` path or return the existing row-level error

Success response:

```json
{
  "groups": [
    {
      "groupId": 123456,
      "groupName": "示例鱼吧",
      "unreadFeedNum": 0,
      "groupLevel": 8,
      "groupExp": 3200,
      "nextLevelExp": 5000,
      "groupTitle": "吧友",
      "rank": 12,
      "isSigned": 1
    }
  ]
}
```

Rules:

- response rows are built from followed-group list + per-group `group/head`
- per-group failure must not fail the whole list; return row-level `error` instead
- WebUI sorts rows by `groupExp` descending before rendering
- WebUI displays `经验值` as `groupExp/nextLevelExp`

### `POST /api/trigger/:type`

Supported `type` values:

- `collectGift`
- `keepalive`
- `doubleCard`
- `yubaCheckIn`
- `expiringGift`

Rules:

- unknown `type` returns `400 { "error": "未知任务类型" }`
- runtime lock conflicts return `400 { "error": "任务正在执行中，请稍后再试" }`
- unconfigured tasks return `400 { "error": "<任务名>未配置" }`
- yuba trigger must resolve cookies for `https://yuba.douyu.com/`
- collect / keepalive / double-card / expiring-gift triggers resolve cookies for `https://www.douyu.com/`

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
- saving theme preference must not remove current collect-gift, keepalive, double-card, expiring-gift, or yuba-check-in config

### Collect Gift

- if `collectGift` is missing in old persisted config, normalize to default cron `0 10 3,5 * * *`
- collect-gift does not depend on medal reconciliation and must survive medal sync unchanged

### Double Card

- if `doubleCard` is missing in old persisted config, normalize its cron fallback to `0 20 17,20,22,23 * * *`
- if `doubleCard.giftScope` is missing or invalid in old persisted config, normalize it to `glowStick`

### Expiring Gift

- if `expiringGift` is not configured, do nothing
- if medal room already exists in `expiringGift.send`, preserve the old send item
- if medal room is new:
  - `model === 1` -> first synchronized fan-medal room defaults to `weight = 1`; all other new rooms default to `weight = 0`
  - `model === 2` -> default `number = 1`
- rooms removed from the medal list must be removed from `expiringGift.send`
- `thresholdHours` defaults to `24` and must remain positive after normalize/reconcile
- expiring-gift save participates in medal reconciliation; collect-gift and yuba saves do not

### Cookie Source

- runtime resolves cookies per target hostname instead of using one shared literal cookie for all Douyu domains
- when CookieCloud is enabled, runtime syncs the latest Douyu main / yuba cookies into local `manualCookies` and tasks read only that persisted local snapshot
- runtime does not fetch CookieCloud inline during task execution; CookieCloud is a sync source, not the task-time credential source
- on startup, CookieCloud runs an immediate sync into local cookies
- when CookieCloud is enabled, a daily sync job runs from `cookieCloud.cron`; the default is `0 5 0 * * *` (`00:05` Asia/Shanghai)
- `persistEffectiveCookies()` writes the latest effective main / yuba cookies back into `manualCookies`
- CookieCloud cache is keyed by `endpoint|uuid|password|cryptoType`; current runtime always normalizes `cryptoType` to `legacy`, and the cache remains valid for `60s`

### Yuba Check-In

- if `yubaCheckIn` is configured and `active !== false`, scheduler starts with its own cron
- runtime constructs `dyToken` from the main-effective cookie as `acf_uid_acf_biz_acf_stk_acf_ct_acf_ltkid`
- scheduled and manual yuba sign jobs must resolve both main-effective and yuba-effective cookies; yuba status loading must resolve both so it can use the dy-token-backed status path with a yuba-cookie fallback
- cookie diagnostics must split yuba dy-token readiness from full/legacy yuba-cookie readiness
- yuba dy-token readiness is based on main-cookie fields `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, `acf_ltkid`
- full/legacy yuba-cookie readiness is based on `acf_yb_auth`, `acf_yb_uid`, `acf_yb_t`
- missing full/legacy `acf_yb_*` fields must not be reported as dy-token yuba list/status unavailability
- sign jobs run a browserless douyuEx-style sequence: fast sign, followed-group sign, then supplementary sign checks
- fast sign calls `POST https://mapi-yuba.douyu.com/wb/v3/fastSign` with `client: android` and `token: <dyToken>`
- followed groups for signing are loaded from `GET https://yuba.douyu.com/wbapi/web/group/myFollow` with `dy-client: pc` and `dy-token: <dyToken>`
- per-group sign calls `POST https://yuba.douyu.com/ybapi/topic/sign` with form body `group_id=<id>`, `dy-client: pc`, and `dy-token: <dyToken>`
- supplementary sign calls `POST https://mapi-yuba.douyu.com/wb/v3/supplement` after the group sign attempt; `status_code = 1001` plus `补签失败` is treated as a non-fatal "no usable supplementary opportunity" condition
- only `mode = followed` is valid
- yuba status loading and yuba signing are independent from medal reconciliation
- yuba list/status fetch failure must not mutate keepalive / double-card config
- `wbapi/web/group/head.data.is_signed` is display-only and must not be treated as the authority for skipping sign attempts
- the authoritative sign result is `ybapi/topic/sign` itself
- `status_code = 1001` only counts as already signed when the response message explicitly says `今天已经签到过了` / `今日已签到`; a generic `签到失败` must remain a failure
- when a generic `签到失败` occurs during dy-token signing, runtime may retry once after a short delay; do not use unbounded recursive retries
- batch sign runs sequentially, not concurrently
- batch sign inserts a jittered delay between groups to reduce rate-pattern failures
- groups that return `被关闭` / `不存在` during batch sign should be skipped and not counted as task failures

---

## Validation & Error Matrix

| Boundary | Condition | Result |
|----------|-----------|--------|
| `POST /api/config` | `collectGift.active` / `keepalive.active` / `doubleCard.active` / `expiringGift.active` present but not boolean | `400 { error }` |
| `POST /api/config` | `yubaCheckIn.active` present but not boolean | `400 { error }` |
| `POST /api/config` | invalid `collectGift.cron` / `keepalive.cron` / `doubleCard.cron` / `expiringGift.cron` missing | `400 { error }` |
| `POST /api/config` | invalid `yubaCheckIn.cron` | `400 { error }` |
| `POST /api/config` | invalid `model` | `400 { error }` |
| `POST /api/config` | `send` missing or not object | `400 { error }` |
| `POST /api/config` | fixed-count mode has any room `number < -1` | `400 { error }` |
| `POST /api/config` | fixed-count mode has more than one room with `number = -1` | `400 { error }` |
| `POST /api/config` | `doubleCard.enabled` present but not object | `400 { error }` |
| `POST /api/config` | `doubleCard.giftScope` is present but not `glowStick` or `limitedTime` | `400 { "error": "doubleCard 礼物范围无效" }` |
| `POST /api/config` | `doubleCard.model === 1` and all enabled rooms have weight `<= 0` | `400 { error }` |
| `POST /api/config` | `doubleCard.model === 1` and any room `weight` is negative / non-numeric | `400 { error }` |
| `POST /api/config` | `expiringGift.thresholdHours <= 0` or non-numeric | `400 { "error": "expiringGift 临期阈值无效" }` |
| `POST /api/config` | `manualCookies` present but not object | `400 { "error": "manualCookies 配置无效" }` |
| `POST /api/config` | `cookieCloud.active` not boolean | `400 { "error": "CookieCloud 启用状态无效" }` |
| `POST /api/config` | `cookieCloud.cryptoType` present but not `legacy` | `400 { "error": "CookieCloud 加密算法无效" }` |
| `POST /api/config` | `cookieCloud.active === true` and endpoint / uuid / password missing | `400 { error }` |
| `POST /api/config` | `yubaCheckIn.mode !== "followed"` | `400 { "error": "yubaCheckIn 模式无效" }` |
| `POST /api/fans/reconcile` | cookie missing | `400 { "error": "请先配置 cookie" }` |
| `GET /api/fans/status` | cookie missing | `400 { "error": "请先配置 cookie" }` |
| `GET /api/yuba/status` | cookie missing | `400 { "error": "请先配置 cookie" }` |
| `POST /api/trigger/yubaCheckIn` | task missing | `400 { "error": "鱼吧签到任务未配置" }` |
| `POST /api/trigger/expiringGift` | task missing or has no room payload | `400 { "error": "临期任务未配置" }` |
| yuba status | main cookie missing any dy-token field: `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, `acf_ltkid` | `500 { error }` with actionable missing-key message |
| yuba status `group/head` | dy-token response is `200` but lacks a rendered table field | try yuba-cookie `group/head` fallback for that row |
| yuba sign | main cookie missing any dy-token field: `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, `acf_ltkid` | runtime failure with actionable error |
| yuba fast sign | returns `status_code = 200` and `data = 0` | continue with per-group sign and log that fast sign was already complete or unavailable |
| yuba sign | `topic/sign` returns `1001` + `message = 今天已经签到过了` | count as `alreadySigned` |
| yuba sign | `topic/sign` returns `1001` + generic `message = 签到失败` | keep as failure, do not rewrite to `alreadySigned` |
| yuba sign | generic sign failure on first dy-token attempt | wait briefly and retry once |
| yuba supplement | returns `1001` + `message = 补签失败` | skip supplementary sign as non-fatal and continue the batch |
| yuba sign | group is closed or removed and upstream says `被关闭` / `不存在` | skip the group, do not increment `failedCount` |
| yuba group head | one group closed or forbidden | row returns `error`, whole status API still returns `200` |
| medal fetch | Douyu request fails | `500 { error }`, persisted config remains unchanged |
| backpack fetch | fluorescent stick backpack request fails | `500 { error }`, WebUI overview keeps previous render until refresh resolves |
| medal fetch | empty medal list | persist empty room sets without throwing |

---

## Shared Request Caches

### Shared Medal-List Cache

- `/api/fans`, `/api/fans/reconcile`, and the medal-list portion of `/api/fans/status` share a short-lived in-memory cache around `getFansList(cookie)`.
- The cache keeps only the latest cookie-specific fans snapshot, an expiry timestamp, and at most one pending promise for request coalescing.
- Do not cache the full `/api/fans/reconcile` response, because reconciliation has side effects: it must still recompute against the latest local config and persist/reload tasks when needed.
- Cookie changes, CookieCloud-derived login state changes, or CookieCloud config changes must clear the shared medal-list cache.

### Docker WebUI Client Request Smoothing

1. Scope / Trigger

- Applies to Docker WebUI browser-side reads in `src/docker/webui/index.html` for fans sync, fans list, fans status, and yuba status.
- Use this pattern when one visible action or navigation path can otherwise trigger duplicate Douyu-backed HTTP requests.

2. Signatures

```js
loadFansList(showToast)
loadFansStatus(showToast)
loadYubaStatus(showToast)
```

3. Contracts

- Automatic tab/lazy-load reads should request the local Docker WebUI API when the visible view needs data; browser-side TTL/cooldown must not suppress these reads.
- Repeated visible refreshes must still reuse the same in-flight request when one is already running.
- Backend status/list caches remain responsible for reducing upstream Douyu request frequency.
- Late responses must be ignored with a per-resource request sequence if the resource was invalidated after the request started.
- Existing rows remain visible during background refresh when a previous successful snapshot exists.
- Tab navigation must re-render the newly active page after updating `state.activeTab` and panel visibility. Lazy-load guards alone are not enough, because overview/status requests can populate shared state while hidden keepalive, double-card, or yuba panels still contain stale empty DOM from an earlier full render.
- Overview/expiring status loads (`/api/fans/status/base` + `/api/fans/status/details`) and task room-list loads (`/api/fans`) are related but distinct client resources:
  - a non-empty fans-status response may seed the task room list and mark `fansList` loaded
  - an empty fans-status response must not mark `fansList` loaded, because keepalive/double-card still need a dedicated `/api/fans` load before deciding their room tables are truly empty
- Keepalive and double-card empty states must schedule or perform a post-render fans-list ensure when cookies are configured, no rows are visible, no fans-list snapshot has loaded, and no fans-list request is pending.
- Yuba empty state must schedule or perform a post-render yuba-status ensure when cookies are configured, the followed-mode page is active, no yuba snapshot has loaded, and no yuba-status request is pending.
- First-load fans-list and yuba-status failures must leave an inline page-visible error with a retry hint; do not rely only on a transient toast for failures that otherwise look like a stuck "preparing to load" state.
- Saving manual cookies or CookieCloud config must clear cookie-backed WebUI snapshots/resource metadata so stale empty fans/yuba state cannot block the next page load.

4. Validation & Error Matrix

| Case | Expected result |
|------|-----------------|
| Multiple clicks while visible refresh is loading | at most one in-flight browser request per resource |
| User opens overview, fans status succeeds, then switches to keepalive/double-card | newly active task page re-renders from shared fans state immediately; it must not keep stale "preparing to load" DOM until F5 |
| Re-entering overview/expiring after a prior successful load | browser may call `/api/fans/status/base`; backend cache may answer without new Douyu fan-out |
| Overview fans status returns empty, then user enters keepalive/double-card | WebUI still calls `/api/fans` for the task room list |
| `/api/fans` returns empty for keepalive/double-card | WebUI marks `fansList` loaded and renders the true empty-account state |
| User enters yuba with configured cookies and no loaded snapshot | WebUI calls `/api/yuba/status` and shows loading, then rows or an inline error |
| Refresh fails after a previous successful fans status load | table keeps the previous rows and shows the failure toast |
| Cookie source disappears | client resource metadata and visible fans/yuba snapshots are cleared |

5. Good / Base / Bad Cases

- Good: lazy tab load calls `loadFansStatus(false)` when status is needed and lets the backend cache decide whether Douyu must be queried.
- Good: `setActiveTab()` updates `state.activeTab`, toggles panels, then re-renders the active page before deciding whether a lazy request is still needed.
- Good: keepalive/double-card empty rendering performs a guarded fans-list ensure when the task table has no rows and `fansList` has not loaded.
- Good: yuba empty rendering performs a guarded yuba-status ensure when no followed-group snapshot has loaded.
- Base: task trigger calls `loadFansStatus(false)` after backend status was invalidated by the task.
- Bad: marking `fansList` loaded after `/api/fans/status` returns an empty `fans` array, permanently suppressing `/api/fans` on keepalive/double-card pages.
- Bad: clearing `state.fansStatus` before every refresh, causing the UI to flash empty while an avoidable duplicate request runs.
- Bad: changing `state.activeTab` without re-rendering the newly visible panel, leaving stale hidden-panel HTML visible until a full browser refresh.

6. Tests Required

- Run `npm run lint`, `npm run type-check`, and `npm test`; `npm test` includes the request-smoothing contract guard before the Docker build.
- Smoke-test a deep-linked WebUI page and verify no browser console errors.
- Smoke-test SPA navigation from overview to keepalive, double-card, and yuba after data has loaded; the target page must show rows or an active loading/error state without requiring F5.
- Verify repeated refresh attempts cannot create duplicate visible-resource requests while the button is busy.

7. Wrong vs Correct

Wrong:

```js
state.fansStatus = [];
return requestJson('/api/fans/status');
```

Correct:

```js
if (resource.pending) {
  return resource.pending;
}
state.fansStatusLoading = true;
```

Wrong:

```js
markResourceLoaded('fansStatus');
markResourceLoaded('fansList'); // even when state.fansStatus is empty
```

Correct:

```js
markResourceLoaded('fansStatus');
if (state.fansStatus.length) {
  markResourceLoaded('fansList');
}
```

Wrong:

```js
state.activeTab = nextTab;
toggleVisiblePanel(nextTab);
ensureFansListForActiveTab();
```

Correct:

```js
state.activeTab = nextTab;
toggleVisiblePanel(nextTab);
renderActiveTabPage();
ensureFansListForActiveTab();
ensureYubaStatusForActiveTab();
```

---

## Good / Base / Bad Cases

### Good

- current config has `collectGift.cron = 0 10 3,5 * * *`
- current keepalive has rooms `100`, `200`
- current double-card has rooms `100`, `200`, with `enabled.100 = true`, `enabled.200 = false`
- current expiring-gift has rooms `100`, `200`
- `doubleCard.model = 1`
- `doubleCard.send.100.weight = 1`
- `doubleCard.send.200.weight = 3`
- latest medal list becomes `100`, `200`, `300`

Expected:

- collect-gift config remains unchanged after reconciliation
- keepalive preserves `100`, `200` values
- keepalive adds `300` with default values
- double-card preserves `100`, `200` send values
- double-card preserves existing enabled map
- double-card adds room `300` with default send value and `enabled.300 = false`
- expiring-gift preserves `100`, `200` values and adds `300` with the model-specific default value
- if rooms `100` and `200` are both double-active at runtime, gifts are redistributed using weight `1:3`

### Base

- medal list unchanged, or user saves only collect-gift cron, or user edits double-card proportions without changing enabled state, or user disables a task and later re-enables it

Expected:

- reconciliation is idempotent
- saved config shape remains stable
- selective scheduler reload does not lose existing task values
- saving one task config does not emit restart logs for unrelated active tasks
- collect-gift save does not mutate medal-driven room payloads
- yuba config save does not mutate medal-driven room payloads
- expiring-gift save reconciles only medal-driven room payloads and reloads only affected task schedulers
- task disable only flips `active` and does not delete user-saved config
- double-card weight values do not need to sum to `100`
- WebUI preview may show derived percentages, but persisted payload keeps the raw proportion values

### Good: Weight-Mode Proportion Allocation

- keepalive, double-card, or expiring-gift runs with `model = 1`
- room A has `weight = 1`
- room B has `weight = 3`
- current gift budget is `8`

Expected:

- runtime treats weights as raw proportions, not literal percentages
- runtime allocates roughly `2 / 6`, with normal floor/remainder handling for uneven totals
- total weight may be below or above `100`
- double-card may first filter to checked and currently double-active rooms, but the filtered room set still uses the same raw proportion allocator

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

### Good: Expiring Gift Within Threshold

- expiring-gift is enabled with `thresholdHours = 24`
- backpack status returns `count = 105` and an earliest expiry 5 hours from now
- fixed-count room config includes one room with `number = -1`

Expected:

- runtime logs the earliest expiry and remaining hours
- runtime sends the current visible count using the saved room allocation
- task logs remain under the `临期` category

### Base: Expiring Gift Not Yet Due

- expiring-gift is enabled with `thresholdHours = 24`
- backpack status returns `count = 105` and an earliest expiry 5 days from now

Expected:

- runtime logs that the threshold has not been reached
- no gift send request is made

### Good: CookieCloud Primary With Manual Fallback

- `cookieCloud.active = true`
- CookieCloud returns cookies for `www.douyu.com`
- CookieCloud does not return a usable cookie for `yuba.douyu.com`
- manual yuba cookie is already persisted

Expected:

- collect / keepalive / double-card / expiring-gift use CookieCloud main cookie
- yuba status / sign use persisted manual yuba cookie
- runtime source is effectively hybrid without failing the whole task chain

### Base: Persist Effective CookieCloud Result

- CookieCloud returns usable main and yuba cookies
- current manual cookies are stale

Expected:

- `POST /api/cookie-source/persist` updates `manualCookies.main` and `manualCookies.yuba`
- next config save keeps the updated fallback cookies
- `config.cookie` mirrors the latest main cookie

### Good: Yuba Status List With Partial Row Failure

- followed-group list returns 25 groups
- one group is closed and `group/head` returns an access error

Expected:

- `GET /api/yuba/status` returns 25 rows
- the closed group row includes `error`
- other rows still include `groupLevel`, `groupExp`, `nextLevelExp`, `rank`, `isSigned`
- if dy-token `group/head` omits a rendered field for one row, the runtime tries the yuba-cookie `group/head` fallback before returning that row as `error`

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

### Bad: Yuba Sign Triggered Without Main dy-token Fields

- yuba task is enabled
- resolved yuba cookie exists, but the main-effective cookie does not contain all dy-token fields

Expected:

- current run fails with an actionable main-login-token error
- log output clearly states which dy-token cookie fields are missing
- keepalive / double-card / expiring-gift config remains unchanged

---

## Tests Required

Commands:

- `npm run lint`
- `npm run type-check`
- `npm test`

Manual assertions:

- WebUI loads with no cookie and can save theme-only changes
- WebUI can save collect-gift cron before cookie is present
- WebUI can save CookieCloud config and manual cookies independently
- saving Cookie enables medal reconciliation actions
- overview medal panel shows current fluorescent stick count beside the medal table
- overview medal panel shows the formatted fluorescent stick expiry when backpack `met` exists
- collect-gift can be enabled, disabled, and manually triggered from `领取任务`
- yuba task can be enabled, disabled, and manually triggered from `鱼吧签到`
- keepalive fixed-count mode defaults new rows to `1`
- keepalive fixed-count mode with all rows set to `1` sends only those explicit counts and preserves any remainder
- keepalive fixed-count mode with exactly one row set to `-1` sends the remainder only to that row
- keepalive weight mode accepts raw weights such as `1 / 3` and allocates by total weight, not `/100`
- after medal reconciliation, keepalive rooms match medal list
- unchanged keepalive room values remain untouched
- disabling keepalive preserves the previously saved cron / model / send config after page refresh
- re-enabling keepalive resumes with the preserved user config instead of rebuilding defaults
- unchanged double-card room values and checked states remain untouched
- new medal rooms appear in keepalive and double-card
- new medal rooms appear in expiring-gift
- new medal rooms are unchecked in double-card
- removed medal rooms disappear from keepalive, double-card, and expiring-gift task configs
- keepalive form no longer exposes custom gift timing
- double-card execution skips when no room is checked
- double-card weight mode accepts raw weights such as `1 / 2 / 3` without requiring total `100`
- double-card page shows a weight preview for enabled rooms
- overview displays collect-gift / keepalive / double-card status using Shanghai-time display
- overview displays expiring-gift enabled/scheduler status using Shanghai-time display
- expiring-gift can be enabled, disabled, and manually triggered from `临期任务`
- expiring-gift skips when the earliest visible fluorescent-stick expiry is outside the configured threshold
- expiring-gift sends current visible fluorescent-stick inventory once when the earliest expiry is inside the configured threshold
- expiring-gift weight mode accepts raw weights such as `1 / 3` and allocates each due gift group by total weight, not `/100`
- yuba page loads followed-group rows and sorts by current exp descending
- yuba page displays `经验值` as `当前经验/下级经验`
- CookieCloud-to-login persistence updates the login Cookie textareas instead of a second synthetic field

---

## Wrong vs Correct

### Wrong

- store only one generic `cookie` string and reuse it blindly for both `www.douyu.com` and `yuba.douyu.com`
- tie yuba status loading to medal reconciliation
- make one failing yuba group break the entire yuba status list
- document the old combined `登录与领取` page after the WebUI has already split it
- route keepalive or expiring-gift weight mode through percentage math such as `weight / 100`

### Correct

- persist `manualCookies.main` and `manualCookies.yuba`, and resolve cookies per target hostname
- keep yuba fetch/sign flow independent from medal sync
- tolerate per-group yuba failures via row-level `error`
- reconcile expiring-gift room config through the same medal-list path as keepalive
- keep the WebUI contract aligned with the split pages: `登录` / `领取任务` / `鱼吧签到`
- route keepalive, double-card, and expiring-gift weight mode through a shared total-weight proportion allocator after any task-specific room filtering

---

## Related Files

- `src/core/types.ts`
- `src/core/medal-sync.ts`
- `src/core/job.ts`
- `src/core/cookie-cloud.ts`
- `src/core/yuba.ts`
- `src/core/yuba-check-in.ts`
- `src/core/yuba-status.ts`
- `src/docker/index.ts`
- `src/docker/server.ts`
- `src/docker/webui/index.html`
- `config.example.json`
- `README.md`
