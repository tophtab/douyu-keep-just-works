# Research: DouyuEx glow-stick expiry model

- Query: Can DouyuEx's BagInfo/FansContinue implementation tell whether glow sticks are split into multiple expiry buckets or treated as one unified remaining time?
- Scope: mixed
- Date: 2026-05-06

## Findings

### Files Found

Local repository:

- `src/core/api.ts` - current backpack endpoint fallback, glow-stick filtering, count aggregation, and earliest-expiry normalization.
- `src/core/job.ts` - current expiring-gift task logic that checks earliest visible expiry before sending.
- `.trellis/tasks/05-04-expiring-gift-task/prd.md` - prior task assumptions and observed live backpack samples for glow-stick expiry.
- `.trellis/tasks/05-06-douyuex-feature-research/research/douyuex-baginfo-detail.md` - previous DouyuEx BagInfo/backpack research.
- `.trellis/tasks/05-06-douyuex-feature-research/research/douyuex-deep-dive.md` - previous broader DouyuEx source review.

DouyuEx upstream:

- `src/packages/BagInfo/BagInfo.js` - backpack UI overlay, row-level expiry display, total value/intimacy, clear-bag behavior.
- `src/packages/ExpandTool/ExpandTool_ClearBag.js` - shared `getBagGifts()` helper and manual gift-send UI.
- `src/packages/FansContinue/FansContinue.js` - one-click fan medal renewal using glow-stick-like backpack gifts.
- `dist/douyuex.js` - built bundle confirming backpack and donate endpoint wiring.

### Data Flow and Fields

Backpack endpoint:

- DouyuEx gets backpack inventory with `GET https://www.douyu.com/japi/prop/backpack/web/v5?rid=<room_id>` from `getBagGifts(room_id, callback)`. It sends browser credentials and passes the parsed JSON to the callback. Source: [`ExpandTool_ClearBag.js` lines 70-84](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/ExpandTool/ExpandTool_ClearBag.js#L70-L84); built confirmation: [`dist/douyuex.js` lines 2867-2879](https://github.com/qianjiachun/douyuEx/blob/master/dist/douyuex.js#L2867-L2879).
- `BagInfo` consumes `ret.data.list` directly. It uses `ret.data.list.length` as the rendered backpack item row count and indexes API rows against live DOM rows. Source: [`BagInfo.js` lines 31-38](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L31-L38).
- For each `data.list[]` row, `BagInfo` reads `isValuable`, `expiry`, `price`, `intimate`, and `count`. It displays `expiry - 1` on the corresponding row and computes totals from `price * count` and `intimate * count`. Source: [`BagInfo.js` lines 38-54](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L38-L54), [`BagInfo.js` lines 56-69](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L56-L69).

`expiry`, `met`, and timestamp handling:

- DouyuEx BagInfo uses only the row-level `expiry` field for visible expiration display. It does not normalize `expiry` to a Unix timestamp; the UI subtracts `1`, which strongly suggests a day/countdown bucket rather than an absolute timestamp. Source: [`BagInfo.js` lines 39-53](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L39-L53).
- The targeted DouyuEx modules do not read `met`, `expireTime`, `expire_time`, `expireAt`, `expiresAt`, `endTime`, or similar backpack timestamp fields. Search of `BagInfo.js`, `ExpandTool_ClearBag.js`, `FansContinue.js`, and the built bundle found no backpack timestamp parsing.
- Therefore DouyuEx gives no direct evidence about whether Douyu's current glow-stick payload exposes absolute expiry timestamps. It only shows that at least one DouyuEx-era backpack response had a row-level `expiry` property useful for display.

`batchInfo` handling:

- `BagInfo.clearBagGifts()` iterates every `bagGiftsJson.data.list[]` row, reads `id`, `count`, and `batchInfo`, then checks `Object.keys(batchInfo).length`. Source: [`BagInfo.js` lines 89-99](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L89-L99).
- If `batchInfo` is non-empty, DouyuEx sends the whole row count once. Otherwise it loops and sends one gift at a time. It does not inspect batch ids, per-batch counts, or per-batch expiry. Source: [`BagInfo.js` lines 96-105](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L96-L105).
- Sending uses `POST https://www.douyu.com/japi/prop/donate/mainsite/v1` with `propId`, `propCount`, `roomId`, and `bizExt`. Source: [`FansContinue.js` lines 105-117](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/FansContinue/FansContinue.js#L105-L117); built confirmation: [`dist/douyuex.js` lines 3759-3769](https://github.com/qianjiachun/douyuEx/blob/master/dist/douyuex.js#L3759-L3769).

Glow-stick id selection:

- `ExpandTool_ClearBag` defaults the manual gift id input to `268`. Source: [`ExpandTool_ClearBag.js` lines 7-11](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/ExpandTool/ExpandTool_ClearBag.js#L7-L11).
- `FansContinue` scans `ret.data.list[]` and selects the first row whose `id` is `268` or `2358`, then stores only that row's `id` and `count`. Source: [`FansContinue.js` lines 38-56](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/FansContinue/FansContinue.js#L38-L56).
- If the user enters `0`, `FansContinue` averages that selected row's `count` across all fan-medal rooms. Source: [`FansContinue.js` lines 73-81](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/FansContinue/FansContinue.js#L73-L81).

Aggregation or lack of aggregation:

- BagInfo iterates rows for display and totals all backpack gifts for value/intimacy, but it does not group same-id rows or build a glow-stick domain summary.
- FansContinue does not aggregate multiple glow-stick rows. It stops at the first `id == 268 || id == 2358` row, ignores any later matching rows, and does not consider `expiry` or `batchInfo` for renewal.
- This is strong evidence about DouyuEx behavior, but weak evidence about Douyu's actual storage model: if Douyu returned multiple glow-stick rows, FansContinue would silently use only the first one.

### Local Code Patterns

- This repo defines `GLOW_STICK_GIFT_ID = 268` and queries `/japi/prop/backpack/web/v5` with `/web/v1` fallback across default and candidate room ids. Source: `src/core/api.ts:5`, `src/core/api.ts:88`.
- `getGiftStatus()` validates Douyu backpack business errors, requires `data.data.list` to be an array, filters rows where `Number(record.id) === 268`, sums positive `count` values across matching rows, and takes the earliest normalized timestamp from `expireTime`, `expire_time`, `expireAt`, `expiresAt`, `met`, or `endTime`. Source: `src/core/api.ts:113`, `src/core/api.ts:134`, `src/core/api.ts:145`, `src/core/api.ts:154`, `src/core/api.ts:167`.
- The expiring-gift job loads total count plus earliest visible expiry, skips on missing expiry, and once inside `thresholdHours`, allocates against the current total visible count. Source: `src/core/job.ts:205`, `src/core/job.ts:212`, `src/core/job.ts:218`, `src/core/job.ts:226`, `src/core/job.ts:250`.
- Prior task notes recorded two live samples where Douyu returned one `id=268` row with a single `count` and `met` timestamp. Source: `.trellis/tasks/05-04-expiring-gift-task/prd.md:17`, `.trellis/tasks/05-04-expiring-gift-task/prd.md:18`.

### What This Says About Douyu's Actual Glow-Stick Expiry Model

DouyuEx does not prove that glow sticks are either multi-bucket or unified-expiry inventory.

What it supports:

- Douyu's backpack API exposes row-level gift entries in `data.list[]`.
- A row can have `count`, `expiry`, and `batchInfo`.
- DouyuEx treats each row as the display unit for `expiry`; it does not show sub-batches.
- DouyuEx renewal logic behaves as if one selected glow-stick row is enough.

What it does not support:

- It does not prove `data.list[]` always has one glow-stick row.
- It does not prove all glow sticks share one absolute expiry time.
- It does not prove `batchInfo` contains stable per-batch expiry/count semantics.
- It does not prove gift id `2358` is currently send-compatible with this repo's existing `/member/prop/send` flow.
- It does not explain the live `met` timestamp observed in this repo's newer backpack samples, because DouyuEx does not read `met`.

Best inference:

- DouyuEx treats glow sticks operationally as a single chosen row for fan-medal renewal, but that is an implementation shortcut, not a reliable domain contract.
- The current live samples in this repo are stronger evidence for today's MVP than DouyuEx: they show a single visible `id=268` row with one count and one `met` expiry timestamp.

### Recommendation for This Repo

- Keep the current expiring-gift implementation model: aggregate all visible `id=268` rows, compute the earliest visible absolute expiry from known timestamp fields, and once inside the threshold, allocate against the current total visible count.
- Do not implement per-batch glow-stick sending from `batchInfo` yet. DouyuEx only checks `batchInfo` presence and does not parse it; there is no source evidence that it is stable enough for automated expiry-bucket decisions.
- Keep preserving the distinction between "empty inventory" and "backpack lookup failed"; upstream backpack failures must not become `0` inventory.
- Consider adding observability later, not behavior: expose normalized backpack rows with `id`, `count`, row-level `expiry`, normalized `expireTime`, and `batchInfoPresent` so future live payloads can prove or disprove multi-bucket behavior.
- Treat `2358` as a research candidate only. DouyuEx recognizes it for renewal, but this repo should not switch send behavior beyond `268` without current live payload samples and send endpoint validation.

## External References

- DouyuEx repository: https://github.com/qianjiachun/douyuEx
- BagInfo source: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js
- ExpandTool clear-bag source: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/ExpandTool/ExpandTool_ClearBag.js
- FansContinue source: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/FansContinue/FansContinue.js
- Built bundle: https://github.com/qianjiachun/douyuEx/blob/master/dist/douyuex.js

## Related Specs

- `.trellis/spec/backend/index.md`
- `.trellis/spec/backend/directory-structure.md`
- `.trellis/spec/backend/error-handling.md`
- `.trellis/spec/backend/quality-guidelines.md`
- `.trellis/spec/guides/docker-medal-sync-contract.md`

## Caveats / Not Found

- `python3 ./.trellis/scripts/task.py current --source` returned no active task. The parent request supplied the explicit write path, so this file was written only under `.trellis/tasks/05-06-douyuex-feature-research/research/`.
- I did not call Douyu backpack endpoints with a live cookie. Conclusions about live field semantics are source-derived plus prior task samples, not new live API observations.
- No official Douyu API documentation was found for the private backpack/donate endpoints.
- DouyuEx's built bundle contains many unrelated `timestamp` strings; none are used as backpack expiry parsing in the targeted modules.
