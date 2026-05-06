# Research: DouyuEx deep dive

- Query: DouyuEx BagInfo gift/backpack batches, client sign-in task, LevelTask behavior, and browser-only/non-recommended features for possible Docker porting.
- Scope: mixed
- Date: 2026-05-06

## Findings

### Files Found

- `src/packages/BagInfo/BagInfo.js` in `qianjiachun/douyuEx`: browser UI augmentation for Douyu backpack, totals, expiry labels, and manual clear-bag action.
- `src/packages/ExpandTool/ExpandTool_ClearBag.js` in `qianjiachun/douyuEx`: shared `getBagGifts()` helper and manual backpack sending UI.
- `dist/douyuex.js` in `qianjiachun/douyuEx`: built bundle containing `sendGift_bag()` and helper functions not present in the split source files.
- `src/packages/Sign/Sign_Client.js` in `qianjiachun/douyuEx`: "client" sign-in implementation.
- `src/packages/LevelTask/LevelTask.js` in `qianjiachun/douyuEx`: room user-level task reward polling and claiming.
- `src/common.js` in `qianjiachun/douyuEx`: global room id, uid, dyToken, cookie, and ctn helpers used by the task modules.
- `src/packages/Sign/Sign.js` in `qianjiachun/douyuEx`: one-click sign dispatcher that invokes client sign-in among many browser-triggered sign tasks.
- `src/packages/AdVideo/Sign_Ad_FishPond.js` in `qianjiachun/douyuEx`: ad-watch/fishpond reward flow with mobile ad endpoints and timed completion.
- `src/packages/ExpandTool/ExpandTool_RedPacket_Room.js` in `qianjiachun/douyuEx`: automatic room gift-red-packet polling and repeated grab attempts.
- `src/packages/ExpandTool/ExpandTool_Treasure.js` plus built `dist/douyuex.js`: treasure/chest flow, socket event dependency, and Geetest challenge handling.
- `src/packages/VideoTools/VideoTools.js` and `src/packages/VideoTools/Joysound/Joysound.js` in `qianjiachun/douyuEx`: video-player DOM tools and external Joysound script integration.
- `src/packages/LiveTool/Reply/Reply.js` and `src/packages/LiveTool/Mute/Mute.js` in `qianjiachun/douyuEx`: danmaku keyword reply and moderation automation.
- `src/packages/RealAudience/RealAudience.js`, `src/packages/Fkbuff/Fkbuff.js`, and `src/packages/SyncJoy/SyncJoy.js` in `qianjiachun/douyuEx`: external-service integrations.
- Local `src/core/api.ts`: current Docker backend backpack and gift-send behavior.
- Local `src/core/yuba.ts`: current project dy-token construction from Douyu cookies.
- Local `src/docker/html.ts`: current WebUI statement that fish-bar sign-in uses HTTP and not browser automation.

### BagInfo Behavior

DouyuEx BagInfo is a browser UI enhancement around Douyu's backpack panel, not a standalone inventory model.

- It attaches to the backpack button (`.BackpackButton` or `#js-backpack-enter`) and waits for the live page's backpack DOM to exist before querying the backpack API. Source: [`BagInfo.js` lines 7-31](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L7-L31).
- It calls `getBagGifts(rid, callback)` and assumes `ret.data.list` aligns by index with the DOM rows `.Backpack-prop` / `.ToolbarBackpack-giftItem`. Source: [`BagInfo.js` lines 31-38](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L31-L38).
- `getBagGifts()` calls `GET https://www.douyu.com/japi/prop/backpack/web/v5?rid=<room_id>` with browser credentials. Source: [`ExpandTool_ClearBag.js` lines 70-84](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/ExpandTool/ExpandTool_ClearBag.js#L70-L84); built bundle confirms the same endpoint at [`dist/douyuex.js` lines 2867-2879](https://github.com/qianjiachun/douyuEx/blob/master/dist/douyuex.js#L2867-L2879).
- Displayed fields are gift-row level: `isValuable`, `expiry`, `price`, `intimate`, `count`, and `batchInfo`. It totals monetary value for `isValuable == "1"` as `price * count / 100`, totals intimacy as `intimate * count`, and overlays `expiry - 1` on each visible gift row. Source: [`BagInfo.js` lines 32-54](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L32-L54).
- It adds "total value", "total intimacy", and a manual "clear backpack" button to the backpack header. Source: [`BagInfo.js` lines 56-80](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L56-L80).
- "Clear backpack" sends every gift row to the current room. If `batchInfo` is non-empty it sends the whole `count` in one call; otherwise it loops one-by-one. Source: [`BagInfo.js` lines 89-108](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L89-L108). The send endpoint is `POST https://www.douyu.com/japi/prop/donate/mainsite/v1` with `propId`, `propCount`, `roomId`, and `bizExt`. Source: [`dist/douyuex.js` lines 3759-3769](https://github.com/qianjiachun/douyuEx/blob/master/dist/douyuex.js#L3759-L3769).

Conclusion for the question:

- BagInfo displays one row per `ret.data.list` gift item and decorates the corresponding web backpack row. It does not render or expose batch-level details.
- It checks only whether `batchInfo` has keys to choose whole-stack vs one-by-one sending. It does not inspect individual `batchInfo` batches, batch expiry timestamps, or per-batch counts.
- It shows `expiry - 1`, where `expiry` appears to be a row-level "days/period remaining" field from the backpack API, not a normalized timestamp.
- It can show available gift count from `count` and implied waste risk by low `expiry`, but it does not compute "potentially wasted gifts" as a first-class value. A Docker port should implement that explicitly, especially for glow sticks.

Local comparison:

- Current project already queries backpack state via backend HTTP, filters glow-stick `id == GLOW_STICK_GIFT_ID`, sums `count`, and picks earliest expiry from likely timestamp fields (`expireTime`, `expire_time`, `expireAt`, `expiresAt`, `met`, `endTime`). Source: [`src/core/api.ts` lines 113-171](/home/toph/douyu-keep-just-works/src/core/api.ts:113).
- That local approach is more Docker-appropriate than porting BagInfo DOM behavior. If Douyu's `web/v5` response exposes useful `batchInfo` fields for glow sticks in practice, the Docker task should parse them into structured rows rather than mirror DouyuEx's row-level overlay.

### Client Sign-In Task

"Client sign-in" in DouyuEx is a single mobile/client sign-in request, executed from the browser userscript.

- The one-click sign feature invokes `initPkg_Sign_Client()` alongside fish-bar, room, activity, follow, fan-tree, and other sign modules. Source: [`Sign.js` lines 28-65](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign.js#L28-L65).
- `initPkg_Sign_Client()` immediately calls `signClient()`. Source: [`Sign_Client.js` lines 1-5](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_Client.js#L1-L5).
- `signClient()` sends `POST https://apiv2.douyucdn.cn/h5nc/sign/sendSign` with form body `token=<dyToken>` via Tampermonkey `GM_xmlhttpRequest`, expecting JSON. Source: [`Sign_Client.js` lines 5-14](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_Client.js#L5-L14).
- It treats `ret.data.length == 0` as already signed. Otherwise, it reads `ret.data.sign_pl[]` and displays `cnt` and `name` for returned rewards. Source: [`Sign_Client.js` lines 15-31](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_Client.js#L15-L31).
- `dyToken` is built from cookies `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, and `acf_ltkid`, joined by underscores. Source: [`common.js` lines 115-119](https://github.com/qianjiachun/douyuEx/blob/master/src/common.js#L115-L119).
- Local code already has the same dy-token construction for fish-bar flows and fails early when the required cookie keys are missing. Source: [`src/core/yuba.ts` lines 93-120](/home/toph/douyu-keep-just-works/src/core/yuba.ts:93).

Reliability caveats:

- This endpoint is an unofficial mobile/client endpoint on `apiv2.douyucdn.cn`, not a stable documented API. I found no official public documentation for `sendSign`.
- DouyuEx does not send browser cookies to `sendSign`; it relies on the token alone. That makes it easier to try from Docker, but also means breakage is likely if Douyu changes token validation, client headers, or anti-abuse checks.
- The code does not validate `ret.error`, missing `data`, non-array `sign_pl`, or risk-control responses. A Docker port would need defensive parsing, explicit result statuses, and logs that distinguish already-signed, success-with-rewards, success-without-rewards, invalid token, and endpoint/risk failure.
- Portability is plausible because it is not DOM-dependent. It should still be optional and low-frequency, with no retries that look like automation abuse.

### LevelTask Behavior

DouyuEx LevelTask checks task status and claims rewards for completed room user-level tasks. It does not actively perform task actions.

- `initPkg_LevelTask_Timer()` calls `checkLevelTask()` and repeats every 35 seconds. Source: [`LevelTask.js` lines 1-4](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/LevelTask/LevelTask.js#L1-L4).
- `checkLevelTask()` fetches room-specific task IDs, fetches their statuses, and for each task only claims when `taskStatus == 1 && prizeStatus == 0`. Source: [`LevelTask.js` lines 6-21](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/LevelTask/LevelTask.js#L6-L21).
- Task IDs come from `GET https://www.douyu.com/japi/interactnc/web/userLevel/userLevelDetail?rid=<rid>`, reading `ret.data.taskIds`. Source: [`LevelTask.js` lines 24-40](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/LevelTask/LevelTask.js#L24-L40).
- Task status comes from `GET https://www.douyu.com/japi/tasksys/userLevelTask/getTaskStatus?taskIds=<ids>`, reading `ret.data.list` fields such as `taskId`, `name`, `taskStatus`, and `prizeStatus`. Source: [`LevelTask.js` lines 43-59](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/LevelTask/LevelTask.js#L43-L59).
- Reward claiming uses `POST https://www.douyu.com/japi/tasksys/userLevelTask/getPrize` with `ctn=<getCCN()>`, `taskIds=<taskId>`, and `roomId=<rid>`, then reports `ret.data.list` reward names and counts. Source: [`LevelTask.js` lines 61-78](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/LevelTask/LevelTask.js#L61-L78).
- `getCCN()` reads cookie `acf_ccn` and sets it to `"1"` if missing. Source: [`common.js` lines 143-151](https://github.com/qianjiachun/douyuEx/blob/master/src/common.js#L143-L151).

Conclusion for the question:

- LevelTask checks completion status and claims rewards. It does not actively complete tasks, force completion, simulate viewing/chatting/gifting, or farm room-level progress.
- A Docker port of "claim only completed rewards" is technically plausible if cookie + ctn handling works in Node HTTP.
- Active task farming should not be ported as a Docker background tool. The current project is positioned around long-running account maintenance and explicit HTTP tasks; hidden background loops that perform engagement behavior would be higher-risk, harder to debug, and more likely to trip anti-abuse systems. The local WebUI already describes fish-bar sign-in as pure HTTP and not browser automation, which is the right boundary for this project. Source: [`src/docker/html.ts` lines 1131-1134](/home/toph/douyu-keep-just-works/src/docker/html.ts:1131).

### Browser-Only / Non-Recommended Feature Groups

Playback/video features:

- DouyuEx VideoTools depends on live-page DOM selectors, the actual `<video>` element, hover/focus events, and submodules for speed, cinema mode, sync, recall, filters, camera, zoom, and metadata. Source: [`VideoTools.js` lines 1-32](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/VideoTools/VideoTools.js#L1-L32).
- Joysound toggles browser globals (`unsafeWindow.hasInstalledJoysound`, `enableJoysound`, `disableJoysound`) or opens an external userscript URL. Source: [`Joysound.js` lines 26-40](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/VideoTools/Joysound/Joysound.js#L26-L40).
- Poor Docker fit: these features are local playback UX. A headless background service has no player, no direct user perception loop, and no good way to validate DOM/CSS breakage.

DOM styling / page augmentation:

- BagInfo itself is partly DOM augmentation: it hooks backpack DOM mutation, indexes API rows against live DOM nodes, and mutates backpack header HTML. Source: [`BagInfo.js` lines 18-24](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L18-L24), [`BagInfo.js` lines 47-69](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L47-L69).
- The built userscript also modifies scripts, response text, P2P/WebRTC constructors, and injects tracking/script hooks. Source: [`douyuex.user.js` lines 27-59](https://github.com/qianjiachun/douyuEx/blob/master/dist/douyuex.user.js#L27-L59).
- Poor Docker fit: DOM styling is valuable in a browser extension but irrelevant to Docker. Recreating it server-side would add complexity without improving background task reliability.

Danmaku / moderation automation:

- Keyword reply parses chat websocket messages and calls `sendBarrage(reply)` based on local rules. Source: [`Reply.js` lines 230-288](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/LiveTool/Reply/Reply.js#L230-L288).
- Keyword mute parses chat messages and calls `addMuteUser()` after threshold counts; `addMuteUser()` posts to `https://www.douyu.com/room/roomSetting/addMuteUser`. Source: [`Mute.js` lines 270-379](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/LiveTool/Mute/Mute.js#L270-L379).
- Poor Docker fit: these require live websocket ingestion, room moderator permissions, high-trust action logging, and careful abuse controls. They also change live chat behavior on behalf of the account, which is beyond passive account maintenance.

Red packet / ad / chest farming:

- Gift red packet automation polls every minute and may call the grab endpoint three times per packet. Source: [`ExpandTool_RedPacket_Room.js` lines 21-39](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/ExpandTool/ExpandTool_RedPacket_Room.js#L21-L39), [`ExpandTool_RedPacket_Room.js` lines 46-100](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/ExpandTool/ExpandTool_RedPacket_Room.js#L46-L100).
- Treasure/chest automation subscribes to live socket `tslist` messages and creates Geetest DOM containers. Source: [`ExpandTool_Treasure.js` lines 87-123](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/ExpandTool/ExpandTool_Treasure.js#L87-L123). Built code posts to `https://pcapi.douyucdn.cn/h5nc/member/getRedPacket?token=<dyToken>` and initializes Geetest on challenge. Source: [`dist/douyuex.js` lines 5330-5384](https://github.com/qianjiachun/douyuEx/blob/master/dist/douyuex.js#L5330-L5384).
- Fishpond ad reward code checks task status, gets ad metadata, starts an ad, waits roughly 15.5 seconds, then calls finish endpoints. Source: [`Sign_Ad_FishPond.js` lines 5-80](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/AdVideo/Sign_Ad_FishPond.js#L5-L80), [`Sign_Ad_FishPond.js` lines 82-148](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/AdVideo/Sign_Ad_FishPond.js#L82-L148).
- Poor Docker fit: these are reward-farming flows, often timing-sensitive, captcha-sensitive, or designed around ad/view interaction. A 24/7 Docker job would turn browser-assisted convenience into unattended automation with high account-risk and maintenance cost.

External paid / third-party services:

- RealAudience opens and posts to `doseeing.com` for aggregated room stats. Source: [`RealAudience.js` lines 69-72](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/RealAudience/RealAudience.js#L69-L72), [`RealAudience.js` lines 211-231](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/RealAudience/RealAudience.js#L211-L231).
- FKBUFF is only a link to `https://fkbuff.com/`. Source: [`Fkbuff.js` lines 19-22](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Fkbuff/Fkbuff.js#L19-L22).
- SyncJoy opens an external DouyuEx service at `https://sb.douyuex.com/`. Source: [`SyncJoy.js` lines 19-22](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/SyncJoy/SyncJoy.js#L19-L22).
- The userscript declares many external `@connect` domains beyond Douyu, including `122.51.5.63`, `bojianger.com`, `shadiao.*`, `fz996.com`, `toubang.tv`, and `doseeing.com`. Source: [`douyuex.user.js` lines 43-58](https://github.com/qianjiachun/douyuEx/blob/master/dist/douyuex.user.js#L43-L58).
- Poor Docker fit: this project should avoid adding third-party dependencies that may collect account/room behavior, require separate terms, or fail outside browser context. External services also complicate privacy, support, and reproducibility.

### Code Patterns

- Browser credentials pattern: DouyuEx often uses `fetch(..., { credentials: "include" })` or Tampermonkey `GM_xmlhttpRequest`, assuming the user is already logged into Douyu in the browser. Examples: [`BagInfo` backpack endpoint](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/ExpandTool/ExpandTool_ClearBag.js#L70-L84), [`LevelTask` status/claim endpoints](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/LevelTask/LevelTask.js#L24-L78).
- Token pattern: mobile/client endpoints commonly use the dy-token derived from `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, and `acf_ltkid`. Source: [`common.js` lines 115-119](https://github.com/qianjiachun/douyuEx/blob/master/src/common.js#L115-L119).
- DOM coupling pattern: many modules wait for specific class names, inject HTML, or respond to mutation hooks. BagInfo and VideoTools are representative. Source: [`BagInfo.js` lines 18-24](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/BagInfo/BagInfo.js#L18-L24), [`VideoTools.js` lines 4-18](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/VideoTools/VideoTools.js#L4-L18).
- Reward-claim pattern: LevelTask is the cleaner pattern: query current status, claim only when already complete and unclaimed, and show reward result. Source: [`LevelTask.js` lines 6-21](https://github.com/qianjiachun/douyuEx/blob/master/src/packages/LevelTask/LevelTask.js#L6-L21).

### External References

- Upstream repository: https://github.com/qianjiachun/douyuEx
- Upstream README identifies DouyuEx as a Tampermonkey plugin for Douyu Web and states the feature goal is browser-side Web enhancement. Source: [`README.md` lines 18-34](https://github.com/qianjiachun/douyuEx/blob/master/README.md#L18-L34).
- Upstream userscript version inspected: `2026.04.24.01`. Source: [`douyuex.user.js` line 6](https://github.com/qianjiachun/douyuEx/blob/master/dist/douyuex.user.js#L6).
- No official Douyu API documentation was found for `sendSign`, `userLevelTask/getPrize`, or `prop/backpack/web/v5`; findings are source-derived from DouyuEx and local project code.

### Related Specs

- `.trellis/spec/backend/index.md`: current backend conventions apply for any Docker HTTP task implementation.
- `.trellis/spec/frontend/index.md`: current UI is Docker WebUI in `src/docker/html.ts`, not a browser extension or Vue renderer.
- `.trellis/spec/guides/cross-layer-thinking-guide.md`: relevant if adding a task with scheduler, config, API route, and WebUI status.
- `.trellis/spec/guides/code-reuse-thinking-guide.md`: relevant before reusing or extending cookie, dy-token, backpack, and task scheduler helpers.

## Caveats / Not Found

- `task.py current --source` returned no active task. This file was written to the explicit parent-provided path `.trellis/tasks/05-06-douyuex-feature-research/research/douyuex-deep-dive.md`.
- I did not execute Douyu API calls requiring a real logged-in cookie. Field semantics such as BagInfo `expiry` and possible `batchInfo` internals are inferred from DouyuEx source usage, not live response samples.
- I did not find official Douyu documentation for the private endpoints. Treat endpoint stability and response shape as unstable.
- DouyuEx split source does not contain every helper in a clean module; some evidence comes from the built `dist/douyuex.js`, especially `sendGift_bag()` and treasure Geetest handling.
- For Docker porting, the strongest candidates are: structured glow-stick backpack/expiry reporting, optional client sign-in with strict result handling, and LevelTask reward-claim-only. Browser UI, playback tools, ad/chest/red-packet farming, danmaku automation, and external-service integrations are poor fits.
