# Docker Medal Sync Contract

> **Purpose**: Define the executable cross-layer contract for Docker WebUI cookie-source persistence, independent collection, medal-driven keepalive, double-card management, and HTTP-based yuba check-in.

---

## Scope

This contract covers:

- persisted Docker config shape in `src/core/types.ts`
- cookie normalization / reconciliation in `src/core/medal-sync.ts`
- CookieCloud decrypt / selection / diagnostics in `src/core/cookie-cloud.ts`
- yuba HTTP list/head/sign logic in `src/core/yuba.ts`
- Docker HTTP APIs in `src/docker/server.ts`
- Docker runtime scheduling / trigger wiring in `src/docker/index.ts`
- Docker WebUI request/response expectations in `src/docker/html.ts`

It applies when the WebUI manages:

- manual login cookies
- CookieCloud-backed cookie fallback persistence
- collect-gift task config
- keepalive task config
- double-card task config
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
  -> reconcile keepalive + doubleCard config (`reconcileDockerConfig`)
  -> GET followed yuba groups + group head (`getFollowedYubaStatuses`)
  -> yuba scheduler (`yubaCheckIn`)
  -> save config to disk
  -> restart Docker schedulers
  -> render latest config + task status + medal table / yuba table in WebUI
```

Boundary owners:

- cookie normalization + defaults: `src/core/medal-sync.ts`
- CookieCloud fetch / decrypt / diagnostics: `src/core/cookie-cloud.ts`
- yuba HTTP fetch / sign logic: `src/core/yuba.ts`
- config persistence + scheduler restart: `src/docker/index.ts`
- HTTP validation + JSON responses: `src/docker/server.ts`
- UI forms + save/sync actions: `src/docker/html.ts`

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
  - applies to `collectGift`, `keepalive`, `doubleCard`, and `yubaCheckIn`
  - omitted old config defaults to `true` during normalize/load
  - `false` means keep the saved config payload but do not start scheduler wiring for that task
- `ui.themeMode`
  - allowed values: `light`, `dark`, `system`
  - omitted value defaults to `system`
- `collectGift.cron`
  - omitted old config is normalized to the default `0 10 0,1 * * *`
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
- send `"doubleCard": { "active": false, "cron": "...", "model": 1, "enabled": { ... }, "send": { ... } }` to disable double-card while preserving room config
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
- when keepalive or double-card config is saved and cookie exists, response config reflects post-reconciliation state
- saving only `collectGift`, `yubaCheckIn`, cookie-source fields, or `ui` does not trigger medal reconciliation
- disabling a task through `active: false` must not clear its persisted cron / model / send / enabled payload
- saving `manualCookies` or `cookieCloud` must restart runtime cookie resolution state without mutating medal-room config

### `POST /api/fans/reconcile`

File: `src/docker/server.ts`

Purpose:

- fetch the latest medal list using the effective main-site cookie
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

### `GET /api/fans/status`

Files:

- route: `src/docker/server.ts`
- response assembly: `src/docker/index.ts`
- upstream backpack + medal parsing: `src/core/api.ts`
- WebUI consumer: `src/docker/html.ts`

Purpose:

- fetch the latest medal list using the effective main-site cookie
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
  - sourced from `getFansList(cookie)` and sorted by medal level descending
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

### `GET /api/yuba/status`

Files:

- route: `src/docker/server.ts`
- runtime assembly: `src/docker/index.ts`
- upstream list/head fetch: `src/core/yuba.ts`
- WebUI consumer: `src/docker/html.ts`

Purpose:

- fetch followed yuba groups
- expand each group with `group/head` details
- return the current yuba level / exp / rank / sign state list for the fish-bar page

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

Rules:

- unknown `type` returns `400 { "error": "未知任务类型" }`
- runtime lock conflicts return `400 { "error": "任务正在执行中，请稍后再试" }`
- unconfigured tasks return `400 { "error": "<任务名>未配置" }`
- yuba trigger must resolve cookies for `https://yuba.douyu.com/`
- collect / keepalive / double-card triggers resolve cookies for `https://www.douyu.com/`

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
- saving theme preference must not remove current collect-gift, keepalive, double-card, or yuba-check-in config

### Collect Gift

- if `collectGift` is missing in old persisted config, normalize to default cron `0 10 0,1 * * *`
- collect-gift does not depend on medal reconciliation and must survive medal sync unchanged

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
- runtime uses `acf_yb_t` from the yuba-effective cookie for sign requests
- sign requests call `POST https://yuba.douyu.com/ybapi/topic/sign` with `multipart/form-data`
- sign requests must send both `group_id` and the latest `cur_exp` from `wbapi/web/group/head`
- only `mode = followed` is valid
- yuba status loading and yuba signing are independent from medal reconciliation
- yuba list/status fetch failure must not mutate keepalive / double-card config
- `wbapi/web/group/head.data.is_signed` is display-only and must not be treated as the authority for skipping sign attempts
- the authoritative sign result is `ybapi/topic/sign` itself
- `status_code = 1001` only counts as already signed when the response message explicitly says `今天已经签到过了` / `今日已签到`; a generic `签到失败` must remain a failure
- when a generic `签到失败` persists after refreshing `group/head`, runtime may probe lower `cur_exp` values within a bounded fallback window before treating the group as failed
- batch sign runs sequentially, not concurrently
- batch sign inserts a jittered delay between groups to reduce rate-pattern failures
- groups that return `被关闭` / `不存在` during batch sign should be skipped and not counted as task failures

---

## Validation & Error Matrix

| Boundary | Condition | Result |
|----------|-----------|--------|
| `POST /api/config` | `collectGift.active` / `keepalive.active` / `doubleCard.active` present but not boolean | `400 { error }` |
| `POST /api/config` | `yubaCheckIn.active` present but not boolean | `400 { error }` |
| `POST /api/config` | invalid `collectGift.cron` / `keepalive.cron` / `doubleCard.cron` missing | `400 { error }` |
| `POST /api/config` | invalid `yubaCheckIn.cron` | `400 { error }` |
| `POST /api/config` | invalid `model` | `400 { error }` |
| `POST /api/config` | `send` missing or not object | `400 { error }` |
| `POST /api/config` | fixed-count mode has any room `number < -1` | `400 { error }` |
| `POST /api/config` | fixed-count mode has more than one room with `number = -1` | `400 { error }` |
| `POST /api/config` | `doubleCard.enabled` present but not object | `400 { error }` |
| `POST /api/config` | `doubleCard.model === 1` and all enabled rooms have weight `<= 0` | `400 { error }` |
| `POST /api/config` | `doubleCard.model === 1` and any room `weight` is negative / non-numeric | `400 { error }` |
| `POST /api/config` | `manualCookies` present but not object | `400 { "error": "manualCookies 配置无效" }` |
| `POST /api/config` | `cookieCloud.active` not boolean | `400 { "error": "CookieCloud 启用状态无效" }` |
| `POST /api/config` | `cookieCloud.cryptoType` present but not `legacy` | `400 { "error": "CookieCloud 加密算法无效" }` |
| `POST /api/config` | `cookieCloud.active === true` and endpoint / uuid / password missing | `400 { error }` |
| `POST /api/config` | `yubaCheckIn.mode !== "followed"` | `400 { "error": "yubaCheckIn 模式无效" }` |
| `POST /api/fans/reconcile` | cookie missing | `400 { "error": "请先配置 cookie" }` |
| `GET /api/fans/status` | cookie missing | `400 { "error": "请先配置 cookie" }` |
| `GET /api/yuba/status` | cookie missing | `400 { "error": "请先配置 cookie" }` |
| `POST /api/trigger/yubaCheckIn` | task missing | `400 { "error": "鱼吧签到任务未配置" }` |
| yuba sign | yuba cookie missing `acf_yb_t` | runtime failure with actionable error |
| yuba sign | `topic/sign` returns `1001` + `message = 今天已经签到过了` | count as `alreadySigned` |
| yuba sign | `topic/sign` returns `1001` + generic `message = 签到失败` | keep as failure, do not rewrite to `alreadySigned` |
| yuba sign | stale `cur_exp` causes generic sign failure | refresh `group/head`, retry once with the latest `group_exp` |
| yuba sign | refreshed `group_exp` still yields generic sign failure but a slightly lower exp is accepted | probe lower `cur_exp` values within the bounded fallback window and recover if one succeeds |
| yuba sign | group is closed or removed and upstream says `被关闭` / `不存在` | skip the group, do not increment `failedCount` |
| yuba group head | one group closed or forbidden | row returns `error`, whole status API still returns `200` |
| medal fetch | Douyu request fails | `500 { error }`, persisted config remains unchanged |
| backpack fetch | fluorescent stick backpack request fails | `500 { error }`, WebUI overview keeps previous render until refresh resolves |
| medal fetch | empty medal list | persist empty room sets without throwing |

---

## Good / Base / Bad Cases

### Good

- current config has `collectGift.cron = 0 10 0,1 * * *`
- current keepalive has rooms `100`, `200`
- current double-card has rooms `100`, `200`, with `enabled.100 = true`, `enabled.200 = false`
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
- if rooms `100` and `200` are both double-active at runtime, gifts are redistributed using weight `1:3`

### Base

- medal list unchanged, or user saves only collect-gift cron, or user edits double-card proportions without changing enabled state, or user disables a task and later re-enables it

Expected:

- reconciliation is idempotent
- saved config shape remains stable
- scheduler restart does not lose existing task values
- collect-gift save does not mutate medal-driven room payloads
- yuba config save does not mutate medal-driven room payloads
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

### Good: CookieCloud Primary With Manual Fallback

- `cookieCloud.active = true`
- CookieCloud returns cookies for `www.douyu.com`
- CookieCloud does not return a usable cookie for `yuba.douyu.com`
- manual yuba cookie is already persisted

Expected:

- collect / keepalive / double-card use CookieCloud main cookie
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

### Bad: Yuba Sign Triggered Without `acf_yb_t`

- yuba task is enabled
- resolved yuba cookie does not contain `acf_yb_t`

Expected:

- current run fails with an actionable CSRF/login error
- log output clearly states that yuba sign requires `acf_yb_t`
- keepalive / double-card config remains unchanged

---

## Tests Required

Commands:

- `pnpm lint`
- `pnpm type-check`
- `pnpm test`

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
- overview displays collect-gift / keepalive / double-card status using Shanghai-time display
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

### Correct

- persist `manualCookies.main` and `manualCookies.yuba`, and resolve cookies per target hostname
- keep yuba fetch/sign flow independent from medal sync
- tolerate per-group yuba failures via row-level `error`
- keep the WebUI contract aligned with the split pages: `登录` / `领取任务` / `鱼吧签到`

---

## Related Files

- `src/core/types.ts`
- `src/core/medal-sync.ts`
- `src/core/job.ts`
- `src/core/cookie-cloud.ts`
- `src/core/yuba.ts`
- `src/docker/index.ts`
- `src/docker/server.ts`
- `src/docker/html.ts`
- `config.example.json`
- `README.md`
