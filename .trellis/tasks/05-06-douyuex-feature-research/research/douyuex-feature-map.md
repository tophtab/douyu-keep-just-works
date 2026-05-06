# Research: DouyuEx feature map for Docker WebUI backlog

- Query: Inspect qianjiachun/douyuEx and identify features that douyu-keep-just-works can learn from or add.
- Scope: mixed
- Date: 2026-05-06

## Findings

### Summary

`douyu-keep-just-works` should not try to become a browser-extension clone. DouyuEx is a Tampermonkey live-room enhancement plugin, while this project is a Docker/NAS management console for long-running background tasks. The best fit is to learn from DouyuEx's background-like HTTP tasks and observability ideas: richer backpack status, average gift allocation, more sign-in/task reward surfaces, monthly spending/VIP expiry visibility, and safer multi-account/cookie source handling. Most playback, danmaku, DOM styling, video, moderation, and notification features should stay out of scope unless the project explicitly restores a browser runtime.

### Files found

Local repository:

- `README.md` - states this project is a Docker WebUI for NAS/home-server/background use and currently supports glow-stick collection, medal keepalive, double-card task, Yuba check-in, and CookieCloud sync.
- `src/core/api.ts` - Douyu HTTP helpers for backpack inventory, fan medal list, gift sending, cookies, and response validation.
- `src/core/job.ts` - current scheduled job workflows for collect gift, keepalive, double card, and Yuba check-in.
- `src/core/gift.ts` - current gift allocation algorithms, including fixed amount, percentage, proportional double-card allocation.
- `src/core/yuba.ts` - current Yuba status, fast sign, per-group sign, and supplement logic.
- `src/core/medal-sync.ts` - current Docker task defaults, config normalization, and fan-medal reconciliation.
- `src/docker/index.ts` - Docker scheduler, CookieCloud sync, logs, task locks, and app context wiring.
- `src/docker/server.ts` - Express WebUI API surface, auth, config validation, logs, status routes, fan/Yuba status routes.
- `.trellis/spec/backend/directory-structure.md` - runtime boundary rule: shared Douyu logic in `src/core`, Docker wiring in `src/docker`.
- `.trellis/spec/backend/error-handling.md` - route/job error behavior and Douyu business error handling.
- `.trellis/spec/backend/logging-guidelines.md` - user-visible log categories, no secret logging, bounded log buffer.
- `.trellis/spec/backend/quality-guidelines.md` - reuse core logic, validate boundary inputs, keep failure semantics explicit.
- `.trellis/spec/frontend/index.md` - current UI is `src/docker/html.ts`; legacy Vue/Electron renderer must not be reintroduced.

Upstream DouyuEx:

- `README.md` - describes DouyuEx as a native JavaScript Tampermonkey plugin for Douyu Web enhancement.
- `src/main.js` - initializes many browser-side modules, including `BagInfo`, `FansContinue`, `Sign`, `LevelTask`, `MonthCost`, `RoomVip`, `CheckAnchorPocket`, and `LastLiveTime`.
- `src/packages/FansContinue/FansContinue.js` - one-click fan medal renewal, including average glow-stick distribution when input is `0`.
- `src/packages/BagInfo/BagInfo.js` - backpack total value/intimacy, expiry display, and clear-backpack flow.
- `src/packages/LevelTask/LevelTask.js` - polls room level tasks and claims available task prizes.
- `src/packages/Sign/Sign.js` - browser one-click sign-in orchestrator for Yuba, client, room, activity, read-post, follow, fan tree, super fans, anchor star, etc.
- `src/packages/Sign/Sign_Client.js` - PC/client sign endpoint.
- `src/packages/Sign/Sign_TV.js` - TV sign endpoint, marked disabled from the Sign orchestrator in later code comments.
- `src/packages/Sign/Sign_Follow.js` - follow/unfollow task completion flow.
- `src/packages/AdVideo/Sign_Ad_FishPond.js` and `src/packages/AdVideo/Sign_Ad_Yuba.js` - ad/fishball reward flows with mobile endpoints and 15-second waits.
- `src/packages/MonthCost/MonthCost.js` - monthly spending aggregation from gift consumption and diamond-fan logs.
- `src/packages/RoomVip/RoomVip.js` - room VIP expiry warning by parsing effect list HTML.
- `src/packages/CheckAnchorPocket/CheckAnchorPocket.js` - anchor pocket/effective props display, same endpoint family as this project's double-card check.
- `src/packages/FollowList/FollowList.js` and `src/packages/LastLiveTime/LastLiveTime.js` - live status and previous live-time display ideas, but implemented through browser DOM.
- `src/packages/AccountList/AccountList.js` - multi-account switching through Tampermonkey cookie APIs.
- `src/packages/AutoAnchorStar/AutoAnchorStar.js` - links to an external paid service, not a feature to port.

### Code patterns

Local patterns and current coverage:

- Current scope is Docker-first: README says this repository "主要维护 Docker WebUI" for NAS/home-server/background use and lists five supported tasks (`README.md:11`, `README.md:15`, `README.md:16`, `README.md:17`, `README.md:18`, `README.md:19`).
- Docker task config currently covers `collectGift`, `keepalive`, `doubleCard`, and `yubaCheckIn` only (`src/docker/index.ts:30`, `src/docker/index.ts:32`; `src/core/types.ts:150`, `src/core/types.ts:155`, `src/core/types.ts:156`, `src/core/types.ts:157`, `src/core/types.ts:158`).
- The scheduler already has the right extension shape for new background tasks: task list, per-task cron, task locks, status timestamps, and scoped loggers (`src/docker/index.ts:30`, `src/docker/index.ts:50`, `src/docker/index.ts:62`, `src/docker/index.ts:69`, `src/docker/index.ts:391`, `src/docker/index.ts:416`).
- Config normalization already sets defaults and migrates old persisted shapes, so new task configs should follow `medal-sync.ts` patterns (`src/core/medal-sync.ts:4`, `src/core/medal-sync.ts:61`, `src/core/medal-sync.ts:79`, `src/core/medal-sync.ts:122`, `src/core/medal-sync.ts:161`, `src/core/medal-sync.ts:221`).
- Gift inventory status already sums glow sticks and can expose earliest expiry, which overlaps DouyuEx backpack-expiry ideas but only for glow sticks today (`src/core/api.ts:113`, `src/core/api.ts:145`, `src/core/api.ts:154`, `src/core/api.ts:167`, `src/core/api.ts:170`; `src/core/types.ts:15`, `src/core/types.ts:18`).
- Keepalive and double-card workflows already share gift inventory, allocation, per-room send, and logging (`src/core/job.ts:95`, `src/core/job.ts:120`, `src/core/job.ts:144`, `src/core/job.ts:147`, `src/core/job.ts:169`).
- Double-card detection already uses the same `pocket/effective` endpoint family DouyuEx uses for anchor pocket (`src/core/double-card.ts:10`, `src/core/double-card.ts:13`, `src/core/double-card.ts:23`; upstream `src/packages/CheckAnchorPocket/CheckAnchorPocket.js:49`, `src/packages/CheckAnchorPocket/CheckAnchorPocket.js:51`, `src/packages/CheckAnchorPocket/CheckAnchorPocket.js:60`).
- Yuba coverage is already stronger than a basic port: current code gets followed groups, fast signs, signs each group, attempts supplement, handles Gee/login/token stop conditions, and logs counts (`src/core/yuba.ts:517`, `src/core/yuba.ts:531`, `src/core/yuba.ts:548`, `src/core/yuba.ts:569`, `src/core/yuba.ts:589`, `src/core/yuba.ts:601`).
- CookieCloud and manual cookie source handling is already a core strength; any DouyuEx multi-account idea should build on configured credential sources, not browser cookie switching (`src/docker/index.ts:160`, `src/docker/index.ts:194`, `src/docker/index.ts:231`, `src/docker/index.ts:336`; `src/core/cookie-cloud.ts:215`, `src/core/cookie-cloud.ts:242`).
- Express routes already expose config, overview, cron preview, logs, fan status, Yuba status, and cookie diagnostics, so most "observability" additions can be surfaced as read-only status cards plus optional scheduled jobs (`src/docker/server.ts:396`, `src/docker/server.ts:420`, `src/docker/server.ts:528`, `src/docker/server.ts:537`, `src/docker/server.ts:559`, `src/docker/server.ts:572`, `src/docker/server.ts:585`).

DouyuEx feature patterns:

- DouyuEx explicitly describes itself as a Tampermonkey plugin for enhancing Douyu Web, not as a server/background daemon (upstream `README.md` introduction).
- Its official function page lists many browser-only features: danmaku loops, UI hiding, night mode, playback tools, same-screen playback, video download, local screenshots/GIFs, moderation tools, browser notifications, and DOM-based overlays.
- The one-click medal renewal feature gets backpack gifts, picks glow stick gift IDs `268` or `2358`, fetches fan medals, and when user enters `0`, computes `Math.floor(count / n)` for average distribution (upstream `src/packages/FansContinue/FansContinue.js:42`, `src/packages/FansContinue/FansContinue.js:51`, `src/packages/FansContinue/FansContinue.js:63`, `src/packages/FansContinue/FansContinue.js:76`, `src/packages/FansContinue/FansContinue.js:110`).
- DouyuEx backpack info totals value and intimacy, shows expiry, and supports clearing backpack gifts through the bag gift donation endpoint (upstream `src/packages/BagInfo/BagInfo.js:31`, `src/packages/BagInfo/BagInfo.js:34`, `src/packages/BagInfo/BagInfo.js:39`, `src/packages/BagInfo/BagInfo.js:44`, `src/packages/BagInfo/BagInfo.js:46`, `src/packages/BagInfo/BagInfo.js:89`, `src/packages/BagInfo/BagInfo.js:98`).
- Level tasks are poll-and-claim style: get room level task IDs, check task status, and claim prizes when task is complete and unclaimed (upstream `src/packages/LevelTask/LevelTask.js:1`, `src/packages/LevelTask/LevelTask.js:7`, `src/packages/LevelTask/LevelTask.js:15`, `src/packages/LevelTask/LevelTask.js:61`).
- DouyuEx's sign-in orchestrator invokes many sign modules, but comments show some historically break or are disabled, so each endpoint must be validated independently before porting (upstream `src/packages/Sign/Sign.js:28`, `src/packages/Sign/Sign.js:31`, `src/packages/Sign/Sign.js:49`, `src/packages/Sign/Sign.js:60`, `src/packages/Sign/Sign.js:64`).
- Client sign-in is a small HTTP POST to `apiv2.douyucdn.cn/h5nc/sign/sendSign` with token (upstream `src/packages/Sign/Sign_Client.js:5`, `src/packages/Sign/Sign_Client.js:8`, `src/packages/Sign/Sign_Client.js:16`, `src/packages/Sign/Sign_Client.js:20`).
- TV sign-in uses `apitv.douyucdn.cn/user/sign/index` and a `User-Device` header, but the orchestrator comment says TV sign was invalid as of 2022-09-01, so treat it as low confidence until manually revalidated (upstream `src/packages/Sign/Sign_TV.js:5`, `src/packages/Sign/Sign_TV.js:9`, upstream `src/packages/Sign/Sign.js:49`).
- Ad/fishball reward flows use mobile ad endpoints, chance/start/finish calls, ad metadata, and fixed 15-second waits; they are more fragile and may cross a line from "maintenance" into reward farming (upstream `src/packages/AdVideo/Sign_Ad_FishPond.js:8`, `src/packages/AdVideo/Sign_Ad_FishPond.js:46`, `src/packages/AdVideo/Sign_Ad_FishPond.js:56`, `src/packages/AdVideo/Sign_Ad_FishPond.js:129`, upstream `src/packages/AdVideo/Sign_Ad_Yuba.js:8`, `src/packages/AdVideo/Sign_Ad_Yuba.js:32`, `src/packages/AdVideo/Sign_Ad_Yuba.js:102`).
- Monthly spending is a read-only aggregation over gift consumption and diamond-fans logs, cached per user and refreshed daily (upstream `src/packages/MonthCost/MonthCost.js:105`, `src/packages/MonthCost/MonthCost.js:113`, `src/packages/MonthCost/MonthCost.js:148`, `src/packages/MonthCost/MonthCost.js:184`, `src/packages/MonthCost/MonthCost.js:267`, `src/packages/MonthCost/MonthCost.js:289`).
- Room VIP expiry is a read-only warning by parsing `member/platform_task/effect_list` for property ID `1646` and matching the current room ID (upstream `src/packages/RoomVip/RoomVip.js:19`, `src/packages/RoomVip/RoomVip.js:38`, `src/packages/RoomVip/RoomVip.js:39`, `src/packages/RoomVip/RoomVip.js:41`, `src/packages/RoomVip/RoomVip.js:43`).
- Follow-list and last-live-time features are UI-oriented but suggest a useful backend concept: follow/live status snapshots for rooms the user cares about (upstream `src/packages/FollowList/FollowList.js:91`, `src/packages/FollowList/FollowList.js:93`, upstream `src/packages/LastLiveTime/LastLiveTime.js:7`, `src/packages/LastLiveTime/LastLiveTime.js:15`).
- Account switching uses Tampermonkey cookie APIs and page reloads, which does not map directly to Docker; the comparable server-side concept would be multiple named cookie profiles in config (upstream `src/packages/AccountList/AccountList.js:160`, `src/packages/AccountList/AccountList.js:165`, `src/packages/AccountList/AccountList.js:172`).

### Feature fit classification

Already covered or mostly covered:

- One-click/automatic fan medal keepalive: current keepalive sends glow sticks to fan medal rooms, with fixed or weighted modes.
- Yuba check-in and supplement: current implementation already signs followed groups, does fast sign first, and attempts supplement.
- Double-card visibility/optimization: current double-card task checks active pocket props and only sends when double card is active.
- Cookie persistence: current manual cookies plus CookieCloud are a better fit for Docker than DouyuEx browser cookie switching.

Good fit for Docker/NAS backlog:

- P1: Average glow-stick allocation mode. DouyuEx added "input 0 means average distribution"; this maps cleanly into the current gift allocation layer. Low risk if implemented as an additional allocation mode or a special fixed-count option, but it needs careful config migration and validation. User value: simple "spread remaining sticks equally across all medals" behavior.
- P1: Backpack status dashboard expansion. Current API already computes glow-stick count and earliest expiry, while DouyuEx shows all backpack gift value, intimacy, and expiry. A Docker-friendly version should start read-only: list glow-stick stacks and maybe all expiring gift stacks, no "clear backpack" automation at first. User value: prevents wasted expiring props and explains why tasks did or did not run.
- P2: Read-only monthly spending summary. DouyuEx's monthly cost module is read-only and daily cached. This fits a management console as an optional status panel, but it touches sensitive spending data and must be opt-in, masked/hidden by default, and never logged.
- P2: Room VIP / effect expiry reminders. This is read-only and similar to expiring gift status. Fit is moderate because it is room-specific and may not matter for a medal keepalive tool unless users care about VIP entry effects.
- P2: Client-side sign-in task. DouyuEx's PC/client sign endpoint looks small enough to test as a scheduled task. Risk is endpoint/login-token volatility; it should be behind a disabled-by-default task and fail with actionable logs.
- P2/P3: Room level task reward claim. DouyuEx polls level tasks and claims completed rewards. It may fit if scoped to "claim already-completed rewards" rather than manufacturing activity. Risk is high because task IDs and completion conditions are room/session-specific.
- P3: Live status snapshot / last live time. This is useful as observability only: "which followed/medal rooms are currently live, last shown live time, and whether the room is eligible for checks." It should not bring browser playback or notification features into Docker.
- P3: Multi-profile cookie support. DouyuEx's multi-account feature is browser-only, but the Docker analogue would be named profiles, each with separate manual/CookieCloud source and task set. High product and config complexity; useful only after single-account workflows stabilize.

Poor fit or browser-extension-only:

- Danmaku loop sending, color cycling, tails, image danmaku, reply bots, auto-thank, enter welcome, keyword ban/reply, danmaku voting, and moderation tools. These depend on live-room WebSocket/DOM interaction and are closer to active chat automation than account maintenance.
- Playback/video features: true stream URL copy, same-screen playback, filters, audio line switching, P2P blocking, high quality/fullscreen, video download, screenshots/GIF, replay high-energy bar. These require browser/player/media context and do not fit a headless Docker management console.
- UI page styling: ad blocking, simple mode, night mode, hiding gifts/rank/PK, removing prefixes, local storage of danmaku collections. These only make sense inside the Douyu web page.
- Auto red packet/chest/treasure/ad reward farming. Some can be implemented with HTTP, but they are fragile, validation-prone, and much more likely to violate platform expectations than keepalive/check-in style maintenance.
- External paid services such as DouyuEx's star recommendation red-packet service should not be ported.

### Recommended shortlist

1. P1 - Average allocation mode for keepalive/double-card gift distribution.
   - Fit: high.
   - Risk: low/medium.
   - Implementation notes: add allocation mode in `src/core/gift.ts`, config/types normalization in `src/core/types.ts` and `src/core/medal-sync.ts`, WebUI validation in `src/docker/server.ts`, and UI controls in `src/docker/html.ts`.

2. P1 - Backpack/expiring gift status.
   - Fit: high.
   - Risk: medium.
   - Implementation notes: extend `getGiftStatus()` or add `getBackpackGiftStatus()` in `src/core/api.ts`; expose read-only route and dashboard card; preserve the "external failure is not empty inventory" contract from backend specs.

3. P2 - Optional "claim client sign-in" task.
   - Fit: medium/high.
   - Risk: medium.
   - Implementation notes: implement as disabled-by-default scheduled task with a manual trigger; use token/cookie validation; avoid bundling broken TV/legacy endpoints until verified.

4. P2 - Monthly spending visibility.
   - Fit: medium.
   - Risk: medium.
   - Implementation notes: read-only, hidden by default, no logging of totals unless user explicitly views it; cache daily; make route return masked/omitted data unless the WebUI asks for it.

5. P2 - Room VIP/effect expiry reminder.
   - Fit: medium.
   - Risk: medium.
   - Implementation notes: start as status-only, not automated purchasing/renewal; parse upstream HTML defensively.

6. P3 - Room level task reward claim.
   - Fit: medium.
   - Risk: high.
   - Implementation notes: only claim already-completed rewards; no artificial follow/unfollow or task farming behavior by default.

7. P3 - Followed/medal live status snapshot.
   - Fit: medium.
   - Risk: medium.
   - Implementation notes: useful if it helps choose collection rooms or diagnose failed tasks; avoid playback features.

8. P3 - Multi-profile cookie/task config.
   - Fit: medium.
   - Risk: high.
   - Implementation notes: this is a product-level config redesign, not a quick port from Tampermonkey cookie switching.

### Suggested next PRD slice

The most coherent next task is "Backpack and expiring gift observability":

- It builds directly on current `getGiftStatus()` and `GiftStatus.expireTime`.
- It helps the current Docker/NAS use case without adding controversial automation.
- It creates reusable backpack parsing for later average allocation and optional reward-claim tasks.
- It aligns with specs: shared API parsing in `src/core`, Docker routes/status in `src/docker`, actionable errors, no secret logging.

Second-best slice is "Average allocation mode":

- It is small and user-facing.
- It mirrors DouyuEx's latest relevant keepalive improvement.
- It should be easy to verify with pure TypeScript logic.

## External References

- GitHub repository: https://github.com/qianjiachun/douyuEx
- GitHub API repository metadata: https://api.github.com/repos/qianjiachun/douyuEx
  - Observed on 2026-05-06: default branch `master`, JavaScript, description "斗鱼直播间增强插件（Tampermonkey）", pushed at `2026-04-24T04:58:31Z`.
- DouyuEx README raw: https://raw.githubusercontent.com/qianjiachun/douyuEx/master/README.md
- DouyuEx feature introduction: https://html.douyuex.com/introduction/
- DouyuEx update log: https://html.douyuex.com/update/
- Upstream source examples:
  - https://github.com/qianjiachun/douyuEx/blob/master/src/packages/FansContinue/FansContinue.js
  - https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js
  - https://github.com/qianjiachun/douyuEx/blob/master/src/packages/LevelTask/LevelTask.js
  - https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign.js
  - https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_Client.js
  - https://github.com/qianjiachun/douyuEx/blob/master/src/packages/MonthCost/MonthCost.js
  - https://github.com/qianjiachun/douyuEx/blob/master/src/packages/RoomVip/RoomVip.js
  - https://github.com/qianjiachun/douyuEx/blob/master/src/packages/CheckAnchorPocket/CheckAnchorPocket.js

## Related specs

- `.trellis/spec/backend/index.md`
- `.trellis/spec/backend/directory-structure.md`
- `.trellis/spec/backend/error-handling.md`
- `.trellis/spec/backend/logging-guidelines.md`
- `.trellis/spec/backend/quality-guidelines.md`
- `.trellis/spec/frontend/index.md`

Key spec implications:

- New reusable Douyu HTTP parsing belongs in `src/core/`; Docker routes, cron, file IO, and log buffering belong in `src/docker/`.
- New routes should keep the existing JSON shape: validation errors as `400 { error }`, runtime errors as `500 { error }`, successful mutations as `{ ok: true }`.
- User-visible logs must not include full cookies or sensitive values.
- Do not reintroduce Vue/Electron/browser-runtime code for current UI work; current UI is Docker WebUI served from `src/docker/html.ts`.

## Caveats / Not Found

- No active Trellis task was set in session state (`task.py current --source` returned none), but this research request supplied the explicit target path `.trellis/tasks/05-06-douyuex-feature-research/research/douyuex-feature-map.md`; this file was written there.
- Douyu endpoints are unofficial and can change without notice. Every candidate endpoint from DouyuEx must be manually validated with current cookies before implementation.
- Some DouyuEx modules are intentionally disabled or commented as invalid in upstream code, especially old TV/ad/sign variants. These should not be assumed live.
- Browser-only features were intentionally not reverse-engineered in depth because the requested comparison target is a Docker/NAS long-running management console.
- No local code was modified during this research.
