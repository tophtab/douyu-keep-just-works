# Research: DouyuEx BagInfo / backpack detail

- Query: How DouyuEx obtains backpack gift batches, counts, expiry, value, and intimacy; whether it distinguishes glow-stick batches; whether it estimates waste; which endpoints/data fields it uses; and how this maps to douyu-keep-just-works.
- Scope: mixed
- Date: 2026-05-06

## Findings

### Files found

Local repository:

- `src/core/api.ts` - current backpack endpoint construction and glow-stick-only inventory parsing.
- `src/core/types.ts` - current `GiftStatus` shape only exposes total glow-stick count, optional earliest expiry, and optional error.
- `src/core/job.ts` - current keepalive, double-card, and expiring-gift workflows consume `getGiftNumber()` / `getGiftStatus()`.
- `src/docker/index.ts` - current `/api/fans/status` context path returns fans plus gift status and degrades gift lookup failures to `gift.error`.
- `src/docker/server.ts` - current Express API shape and trigger/status routes.
- `.trellis/spec/backend/directory-structure.md` - requires shared Douyu parsing in `src/core`, Docker routes/scheduler wiring in `src/docker`.
- `.trellis/spec/backend/error-handling.md` - requires Douyu business-body validation and preserving upstream failures vs empty results.
- `.trellis/spec/backend/logging-guidelines.md` - requires user-facing diagnostics without secrets and bounded logging.

Upstream DouyuEx:

- `src/packages/BagInfo/BagInfo.js` - displays backpack item expiry labels, total value, total intimacy, and a "clear backpack" action.
- `src/packages/ExpandTool/ExpandTool_ClearBag.js` - defines `getBagGifts()` and manual backpack gift send UI.
- `src/packages/FansContinue/FansContinue.js` - one-click fan medal renewal using glow-stick gift IDs and backpack count.
- `src/packages/CheckAnchorPocket/CheckAnchorPocket.js` - related read-only pocket/effective endpoint pattern, not backpack inventory.
- `src/packages/LevelTask/LevelTask.js` - related poll-and-claim level task behavior, useful for future task boundaries but not BagInfo itself.

### Upstream DouyuEx BagInfo behavior

DouyuEx obtains backpack inventory through:

- `GET https://www.douyu.com/japi/prop/backpack/web/v5?rid=<room_id>`
- Implemented in upstream `getBagGifts(room_id, callback)` (`src/packages/ExpandTool/ExpandTool_ClearBag.js:70` to `src/packages/ExpandTool/ExpandTool_ClearBag.js:83`).
- The call runs in the browser with `credentials: "include"` and uses the current live-room `rid` parsed from the page (`src/common.js:3` to `src/common.js:20`).

The BagInfo panel reads `ret.data.list` directly:

- It counts item rows with `ret.data.list.length` (`src/packages/BagInfo/BagInfo.js:31` to `src/packages/BagInfo/BagInfo.js:33`).
- For each list item, it reads:
  - `isValuable` - whether to include item price in total value (`BagInfo.js:38`, `BagInfo.js:43`).
  - `expiry` - displayed as the visible expiry label after subtracting 1 (`BagInfo.js:39`, `BagInfo.js:53`).
  - `price` - summed into total value only when `isValuable == "1"`; display divides final total by 100 (`BagInfo.js:40`, `BagInfo.js:44`, `BagInfo.js:62`, `BagInfo.js:69`).
  - `intimate` - summed as total intimacy contribution (`BagInfo.js:41`, `BagInfo.js:46`, `BagInfo.js:64`, `BagInfo.js:69`).
  - `count` - item quantity multiplier for both value and intimacy (`BagInfo.js:42`, `BagInfo.js:44`, `BagInfo.js:46`).
- It injects the expiry label into the matching backpack DOM item (`BagInfo.js:47` to `BagInfo.js:54`).
- It writes a total value and total intimacy summary into the backpack header (`BagInfo.js:56` to `BagInfo.js:69`).

Backpack clearing / sending behavior:

- `BagInfo.clearBagGifts()` iterates every `ret.data.list` item and reads `id`, `count`, and `batchInfo` (`BagInfo.js:89` to `BagInfo.js:99`).
- If `batchInfo` has keys, DouyuEx sends the whole item count once; otherwise it sends one gift at a time in a loop (`BagInfo.js:96` to `BagInfo.js:105`).
- Sending uses `POST https://www.douyu.com/japi/prop/donate/mainsite/v1` with `propId`, `propCount`, `roomId`, and `bizExt` (`src/packages/FansContinue/FansContinue.js:105` to `src/packages/FansContinue/FansContinue.js:117`).

Fan medal renewal behavior:

- `FansContinue` calls the same `getBagGifts(rid, ...)` inventory helper (`src/packages/FansContinue/FansContinue.js:42`).
- It selects the first backpack item whose `id` is `268` or `2358` (`FansContinue.js:50` to `FansContinue.js:54`).
- It stores that item's `id` as `giftId` and that item's `count` as the sendable count (`FansContinue.js:51` to `FansContinue.js:53`).
- It fetches fan medals from `GET https://www.douyu.com/member/cp/getFansBadgeList` and parses the HTML table (`FansContinue.js:63` to `FansContinue.js:75`).
- If the user enters `0`, it sends `Math.floor(count / n)` per fan-medal room (`FansContinue.js:22`, `FansContinue.js:76`).

### Can DouyuEx distinguish glow-stick batches?

Conclusion: only shallowly, and not in a way that should be copied as a batch model.

Evidence:

- `BagInfo` iterates `ret.data.list` item rows and displays one expiry label per rendered backpack item (`BagInfo.js:31` to `BagInfo.js:54`).
- `clearBagGifts()` only checks whether `batchInfo` is non-empty to choose "send full count once" vs "loop one by one"; it does not inspect batch IDs, per-batch expiry, per-batch counts, or per-batch values (`BagInfo.js:94` to `BagInfo.js:105`).
- `FansContinue` selects the first item matching glow-stick IDs `268` or `2358`, then uses only that item's `count`; if multiple rows or batches of the same glow-stick ID exist, the code does not aggregate them or select by expiry (`FansContinue.js:50` to `FansContinue.js:54`).

Practical implication:

- DouyuEx can display whatever row-level separation Douyu returns in `data.list`, but it does not normalize or understand glow-stick batches as a domain object.
- For this project, do not treat DouyuEx as proof that `batchInfo` is stable or meaningful enough to automate per-batch sending without validation.

### Does DouyuEx estimate waste?

Conclusion: no true waste estimation.

Evidence:

- BagInfo computes current total value and current total intimacy only (`BagInfo.js:34` to `BagInfo.js:46`).
- It displays `expiry - 1` on each visible item row (`BagInfo.js:39`, `BagInfo.js:53`), but there is no threshold, forecast, "will expire unused", waste amount, or recommended send plan.
- Its "clear backpack" feature is destructive/manual-confirmed sending of all backpack gifts, not a waste estimator (`BagInfo.js:72` to `BagInfo.js:80`, `BagInfo.js:89` to `BagInfo.js:108`).

Practical implication:

- A Docker/NAS feature should improve on DouyuEx by computing expiring quantities and potential waste explicitly, rather than just copying an expiry badge.

### Endpoint and field summary

Backpack inventory:

- Endpoint: `GET /japi/prop/backpack/web/v5?rid=<room_id>`.
- Observed DouyuEx fields:
  - `data.list[]`
  - `id`
  - `name` (used by `ExpandTool_ClearBag.js` for console examples)
  - `count`
  - `expiry`
  - `price`
  - `intimate`
  - `isValuable`
  - `batchInfo`

Backpack donate:

- Endpoint: `POST /japi/prop/donate/mainsite/v1`.
- Observed request fields:
  - `propId`
  - `propCount`
  - `roomId`
  - `bizExt`

Fan medal list:

- Endpoint: `GET /member/cp/getFansBadgeList`.
- DouyuEx parses DOM attributes `data-fans-room` and the number of medal rows for average distribution (`FansContinue.js:73` to `FansContinue.js:80`).

Related but separate endpoints:

- `GET /japi/interact/cdn/pocket/effective?rid=<room_id>` returns room pocket/effective props such as double-card-like effects (`CheckAnchorPocket.js:49` to `CheckAnchorPocket.js:62`).
- `GET /japi/interactnc/web/userLevel/userLevelDetail?rid=<room_id>`, `GET /japi/tasksys/userLevelTask/getTaskStatus?taskIds=...`, and `POST /japi/tasksys/userLevelTask/getPrize` power DouyuEx level-task reward claiming (`LevelTask.js:24` to `LevelTask.js:78`).

### Local code patterns

Current local backpack handling:

- `src/core/api.ts` defines `GLOW_STICK_GIFT_ID = 268` (`src/core/api.ts:5`).
- It builds backpack candidates with `/japi/prop/backpack/web/v5?rid=...` and `/japi/prop/backpack/web/v1?rid=...` fallback (`src/core/api.ts:88` to `src/core/api.ts:97`).
- `getGiftStatus()` validates Douyu body error codes, checks missing main-cookie keys for error `9`, and requires `data.list` to be an array (`src/core/api.ts:113` to `src/core/api.ts:135`).
- It filters to gift ID `268` only (`src/core/api.ts:137` to `src/core/api.ts:143`).
- It sums `count` across matching rows and tracks the earliest normalized expiry from several possible field names (`src/core/api.ts:148` to `src/core/api.ts:174`).
- `GiftStatus` currently exposes only `{ count, expireTime?, error? }` (`src/core/types.ts:15` to `src/core/types.ts:19`).

Current local jobs:

- Keepalive and double-card tasks use only total glow-stick count (`src/core/job.ts:120`, `src/core/job.ts:147`).
- Expiring-gift task uses total glow-stick count plus the earliest visible expiry, then sends all currently available glow sticks when the threshold is reached (`src/core/job.ts:208` to `src/core/job.ts:248`).
- `/api/fans/status` returns fan rows plus current gift status; if gift lookup fails, it returns `gift.error` instead of pretending the inventory is empty (`src/docker/index.ts:950` to `src/docker/index.ts:958`).

### Mapping to douyu-keep-just-works

Recommended model:

- Add a read-only backpack status parser in `src/core/api.ts`, separate from the existing simple `getGiftStatus()` compatibility function.
- Shape it around normalized rows/stacks, not DouyuEx DOM behavior:
  - `id`
  - `name`
  - `count`
  - `expiryDays` or raw `expiry`
  - `expireTime` when the API returns a true timestamp-like field
  - `priceCents` or `priceRaw`
  - `intimacy`
  - `isValuable`
  - `batchInfoPresent`
  - optional `rawBatchInfoKeys` count, not raw payload by default
- Keep `getGiftStatus()` as the glow-stick-only summary used by existing jobs, but derive it from the normalized parser once validated.
- Expose a read-only Docker route such as `/api/backpack/status`; do not start with "clear backpack" automation.
- In the WebUI, show:
  - total glow sticks
  - earliest visible expiry
  - expiring glow-stick count when inferable
  - total visible value and intimacy from all backpack gifts
  - rows grouped by gift id/name/expiry
  - an error state distinct from empty inventory

Waste estimation:

- DouyuEx does not estimate waste, so a first useful implementation can define waste as "gift count whose expiry is within configured threshold and is not already scheduled/sent by the expiring-gift task."
- If Douyu only returns row-level `expiry` in days rather than absolute timestamps, label it as "visible expiry bucket" and avoid over-precise countdowns.
- If multiple glow-stick IDs are still valid (`268`, `2358`), validate both against current Douyu responses before changing send behavior. The local code currently only sends `268`; DouyuEx recognizes both IDs for renewal.

Batch handling:

- Treat `batchInfo` as unstable until live responses are captured.
- Preserve `batchInfoPresent` as observability, but do not build per-batch send automation unless real responses show stable per-batch count and expiry fields.
- If the API returns multiple `data.list` entries for the same gift ID, aggregate summaries but retain row details so earliest-expiry behavior is not lost.

Error and logging implications:

- Preserve existing behavior where upstream inventory lookup failure is not equivalent to `0` inventory.
- Keep raw cookies and raw backpack payloads out of logs.
- Route validation should follow current Docker JSON patterns: `400 { error }` for bad input, `500 { error }` for runtime failures, success as JSON.

## External References

- DouyuEx repository: https://github.com/qianjiachun/douyuEx
- DouyuEx BagInfo source: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js
- DouyuEx backpack helper / clear-bag source: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/ExpandTool/ExpandTool_ClearBag.js
- DouyuEx fan medal renewal source: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/FansContinue/FansContinue.js
- DouyuEx anchor pocket source: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/CheckAnchorPocket/CheckAnchorPocket.js
- DouyuEx level task source: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/LevelTask/LevelTask.js
- DouyuEx raw `common.js`: https://raw.githubusercontent.com/qianjiachun/douyuEx/master/src/common.js

## Related specs

- `.trellis/spec/backend/index.md`
- `.trellis/spec/backend/directory-structure.md`
- `.trellis/spec/backend/error-handling.md`
- `.trellis/spec/backend/logging-guidelines.md`
- `.trellis/spec/backend/quality-guidelines.md`
- `.trellis/spec/frontend/index.md`

## Caveats / Not Found

- No active Trellis task was set in session state (`task.py current --source` returned none). The parent request supplied the explicit write path, so this file was written only under `.trellis/tasks/05-06-douyuex-feature-research/research/`.
- GitHub code search API requires authentication, so upstream symbol discovery used the repository tree plus raw file reads rather than GitHub search.
- Douyu backpack endpoints are unofficial and may change. Field names observed from DouyuEx source must be validated against current live responses before implementation.
- I did not find DouyuEx code that deeply parses `batchInfo` into per-batch domain records. Its usage is limited to checking whether the object has keys before selecting a send loop strategy.
- I did not find true waste estimation in DouyuEx; only current expiry display plus total value/intimacy.
