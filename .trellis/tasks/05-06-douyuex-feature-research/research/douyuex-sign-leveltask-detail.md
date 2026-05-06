# Research: DouyuEx client sign and level-task boundaries

- Query: What are DouyuEx client sign-in and LevelTask; what endpoints/inputs do they use; does LevelTask only claim rewards or also complete tasks; why is task brushing unsuitable for douyu-keep-just-works?
- Scope: mixed
- Date: 2026-05-06

## Findings

### Short answer

DouyuEx's client sign-in is a Tampermonkey-triggered HTTP POST to a mobile/client sign endpoint, using DouyuEx's `dyToken` derived from main-site cookie fields. It is small enough to prototype as an optional read-only-ish reward claim task, but it must be verified against current Douyu behavior and should be disabled by default.

DouyuEx's `LevelTask.js` itself does not appear to manufacture completion. It polls the current room's level-task ids, fetches task status, and calls the prize endpoint only when the task is already complete and unclaimed. However, DouyuEx's broader one-click sign chain also includes modules that intentionally perform activity: follow/unfollow a fixed room, read a fixed Yuba post several times, sign rooms, sign events, and report tasks. Those "make progress" behaviors are the risky part and should not be copied into this Docker/NAS project by default.

### Files found

Local repository:

- `README.md` - project positioning: Docker WebUI for NAS/home-server/background use; supports glow-stick collection, medal keepalive, double-card detection/distribution, expiring glow-stick gifting, Yuba check-in, and CookieCloud.
- `src/core/api.ts` - existing Douyu HTTP helpers, cookie header construction, backpack parsing, fan-list parsing, gift send validation.
- `src/core/yuba.ts` - existing pure HTTP Yuba fast sign, per-group sign, supplement, retry, and anti-abuse stop behavior.
- `src/core/job.ts` - current job workflows for keepalive, double-card, expiring gift, and Yuba check-in.
- `src/core/double-card.ts` - example of a narrow Douyu API status helper with actionable errors.
- `.trellis/spec/backend/directory-structure.md` - reusable Douyu logic belongs in `src/core`; Docker routes/scheduler/logs belong in `src/docker`.
- `.trellis/spec/backend/error-handling.md` - Douyu HTTP 200 is not business success until body fields are checked.
- `.trellis/spec/backend/logging-guidelines.md` - do not log full cookies/secrets; distinguish external failure from legitimate empty result.

Upstream DouyuEx:

- `README.md` - describes DouyuEx as a native JavaScript Tampermonkey plugin for Douyu Web enhancement.
- `src/main.js` - userscript metadata and module registration; includes `Sign`, `LevelTask`, and many browser/live-room modules.
- `src/common.js` - derives `dyToken` from cookie fields `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, and `acf_ltkid`; exposes `getCCN()`.
- `src/packages/Sign/Sign.js` - one-click sign orchestrator; calls Yuba, client, room, activity, read-posts, follow, fans tree, super fans, anchor star, and other modules; some old modules are commented as invalid.
- `src/packages/Sign/Sign_Client.js` - client sign-in endpoint wrapper.
- `src/packages/LevelTask/LevelTask.js` - room level-task poller and reward claimer.
- `src/packages/Sign/Sign_Follow.js` - follows and unfollows a hard-coded room explicitly to complete a Douyu level task.
- `src/packages/Sign/Sign_ReadPosts.js` - reads a hard-coded Yuba post five times with delays.
- `src/packages/Sign/Sign_Room.js` - iterates followed rooms and signs live/all rooms through an Android client endpoint.
- `src/packages/Sign/Sign_Yuba.js` - Yuba fast sign, per-group sign, and supplement calls.
- `src/packages/Sign/Sign_Act.js` / `Sign_ActqzsUserTask.js` / `Sign_OPFOY.js` / `Sign_AnchorStar.js` - examples of broader event/task automation and reward claims.

### Code patterns

Local project patterns:

- The README frames this project as a Docker WebUI for long-running background use, not a browser extension (`README.md:11-20`).
- Local cookie guidance already says Yuba/Douyu token flows require main-site cookie fields including `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, and `acf_ltkid` (`README.md:55-58`).
- Current backpack logic builds Douyu backpack endpoints and validates business errors before treating a response as inventory (`src/core/api.ts:88-128`).
- Current gift status narrows the backpack response to glow-stick stacks and keeps the earliest expiry if multiple stacks exist (`src/core/api.ts:134-170`).
- Current job flows are scoped to account maintenance: keepalive sends configured gifts, double-card sends only after double-card checks, expiring gift sends only after an expiry threshold, and Yuba signs followed groups (`src/core/job.ts:127-258`).
- Current Yuba implementation already uses dy-token style headers, handles Gee/login/token failures, spaces requests, and stops early on anti-abuse/auth failures (`src/core/yuba.ts:407-449`, `src/core/yuba.ts:517-601`).
- Backend specs require external Douyu calls to live in `src/core` and route/scheduler wiring in `src/docker` (`.trellis/spec/backend/directory-structure.md:9-15`, `.trellis/spec/backend/directory-structure.md:39-52`).
- Backend specs require checking Douyu body fields rather than treating HTTP 200 as success (`.trellis/spec/backend/error-handling.md:63-70`, `.trellis/spec/backend/error-handling.md:88-104`).
- Logging specs forbid full cookies/secrets and require failed external requests to be distinguishable from empty business results (`.trellis/spec/backend/logging-guidelines.md:56-72`).

DouyuEx client sign:

- DouyuEx initializes a global `dyToken` with `getToken()` (`src/common.js:26-29`).
- `getToken()` concatenates `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, and `acf_ltkid` from browser cookies (`src/common.js:115-119`).
- `initPkg_Sign_Client()` immediately calls `signClient()` (`src/packages/Sign/Sign_Client.js:1-3`).
- `signClient()` POSTs to `https://apiv2.douyucdn.cn/h5nc/sign/sendSign` with form data `token=<dyToken>` and content type `application/x-www-form-urlencoded` (`src/packages/Sign/Sign_Client.js:5-13`).
- Response handling treats an empty `ret.data` as already signed; otherwise it reads `ret.data.sign_pl` reward items and reports success (`src/packages/Sign/Sign_Client.js:14-31`).
- The client sign endpoint is launched from the one-click sign orchestrator along with many other sign modules (`src/packages/Sign/Sign.js:28-65`).

DouyuEx LevelTask:

- `initPkg_LevelTask_Timer()` runs `checkLevelTask()` immediately and then every 35 seconds (`src/packages/LevelTask/LevelTask.js:1-4`).
- `checkLevelTask()` gets room-level task ids for the current `rid`, fetches task statuses, and loops over the returned tasks (`src/packages/LevelTask/LevelTask.js:6-14`).
- It calls `finishLevelTask(rid, taskId)` only when `taskStatus == 1` and `prizeStatus == 0` (`src/packages/LevelTask/LevelTask.js:15-20`).
- Task ids come from `GET https://www.douyu.com/japi/interactnc/web/userLevel/userLevelDetail?rid=<rid>` and `ret.data.taskIds` (`src/packages/LevelTask/LevelTask.js:24-35`).
- Task status comes from `GET https://www.douyu.com/japi/tasksys/userLevelTask/getTaskStatus?taskIds=<ids>` and `ret.data.list` (`src/packages/LevelTask/LevelTask.js:43-53`).
- Reward claim posts to `https://www.douyu.com/japi/tasksys/userLevelTask/getPrize` with `ctn=<getCCN()>&taskIds=<taskid>&roomId=<rid>` (`src/packages/LevelTask/LevelTask.js:61-72`).
- Therefore the LevelTask module is best understood as "claim already-completed room-level task rewards" rather than "complete room-level tasks."

DouyuEx broader task-completion behavior:

- `Sign_Follow` explicitly says it exists to complete Douyu level tasks, then follows and unfollows hard-coded room `3186571` (`src/packages/Sign/Sign_Follow.js:1-6`).
- Its follow/unfollow endpoints are `https://www.douyu.com/wgapi/livenc/liveweb/follow/add` and `/follow/rm` with `ctn` and `rid` (`src/packages/Sign/Sign_Follow.js:8-44`).
- `Sign_ReadPosts` calls a fixed Yuba post detail URL five times with 2-second sleeps, using `dy-token` and `dy-client: pc` (`src/packages/Sign/Sign_ReadPosts.js:1-22`).
- `Sign_Room` fetches all followed rooms and signs live rooms or all rooms through `https://apiv2.douyucdn.cn/japi/roomuserlevel/apinc/checkIn?client_sys=android` with `rid`, `token`, and `aid=android1` (`src/packages/Sign/Sign_Room.js:5-70`).
- `Sign_Act` supports activity scripts that can sign, claim prizes, add/remove follows, share, and open remaining reward boxes (`src/packages/Sign/Sign_Act.js:41-96`).
- `Sign_ActqzsUserTask` signs a rotating set of activity/card-arena rooms using hard-coded room ids and monthly config discovery (`src/packages/Sign/Sign_ActqzsUserTask.js:1-42`, `src/packages/Sign/Sign_ActqzsUserTask.js:96-132`).
- `Sign_OPFOY` periodically checks view-task status and claims gifts when task status is complete (`src/packages/Sign/Sign_OPFOY.js:33-52`, `src/packages/Sign/Sign_OPFOY.js:55-96`).
- `Sign_AnchorStar` reports sign tasks for ranked rooms and then performs follow/unfollow sequences for several rooms (`src/packages/Sign/Sign_AnchorStar.js:1-28`, `src/packages/Sign/Sign_AnchorStar.js:50-69`).
- DouyuEx's one-click sign orchestrator also contains comments marking some old modules invalid, including TV sign and Yuba-like variants, which is a warning that each endpoint has to be treated as volatile (`src/packages/Sign/Sign.js:31-64`).

### Endpoint/input inventory

Client sign-in:

- Endpoint: `POST https://apiv2.douyucdn.cn/h5nc/sign/sendSign`
- Body: `token=<dyToken>`
- Headers: `Content-Type: application/x-www-form-urlencoded`
- Token inputs: `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, `acf_ltkid`
- Expected result shape in DouyuEx: `ret.data.length == 0` means already signed; `ret.data.sign_pl[]` contains reward `cnt` and `name`
- Porting implication: this can map to an optional `src/core` helper plus a Docker scheduled/manual task, but response shape must be validated defensively and failures must be logged without dumping token/cookies.

LevelTask reward claim:

- Task-id endpoint: `GET https://www.douyu.com/japi/interactnc/web/userLevel/userLevelDetail?rid=<rid>`
- Status endpoint: `GET https://www.douyu.com/japi/tasksys/userLevelTask/getTaskStatus?taskIds=<comma-separated ids>`
- Claim endpoint: `POST https://www.douyu.com/japi/tasksys/userLevelTask/getPrize`
- Claim body: `ctn=<acf_ccn>&taskIds=<taskid>&roomId=<rid>`
- Inputs: current room id `rid`, browser cookies for `credentials: include`, and `acf_ccn` from `getCCN()`
- Porting implication: a safe slice would be "claim already completed task rewards for explicitly configured rooms" only. Do not include synthetic task actions like follow/unfollow or reading fixed posts.

Task-completion modules:

- Follow/unfollow: `POST /wgapi/livenc/liveweb/follow/add` and `/follow/rm` with `ctn` and `rid`
- Read-posts: `GET /wbapi/web/post/detail/<fixed post id>?timestamp=<now>` with dy-token headers
- Room check-in: `POST https://apiv2.douyucdn.cn/japi/roomuserlevel/apinc/checkIn?client_sys=android` with `rid`, token header, and `aid=android1`
- Event/activity tasks: multiple rotating endpoints with activity ids and hard-coded room ids
- Porting implication: these are active behavior generators, not passive reward claims.

### Risk analysis

Client sign-in risk:

- Medium technical risk: endpoint and response shape are unofficial and can change without notice.
- Medium auth risk: it depends on a constructed token from several main-site cookie fields. Local code already supports similar dy-token construction for Yuba, but sign endpoint behavior still needs live validation.
- Low/medium product risk if disabled by default and scoped to one daily sign call. It resembles existing Yuba sign-in more than task farming.

LevelTask reward-claim risk:

- Medium/high technical risk: task ids are room-specific and returned by an unofficial endpoint; reward status fields may drift.
- Medium auth risk: requires `acf_ccn` plus normal browser cookie state.
- Medium product risk if scoped to claim-only behavior. The module polls every 35 seconds in DouyuEx, but a Docker port should avoid aggressive polling and use a low-frequency schedule/manual trigger.

Task brushing / auto-completion risk:

- High anti-abuse risk: follow/unfollow loops, fixed-post reads, event-task reports, and repeated room check-ins look like synthetic engagement rather than maintenance.
- High maintenance risk: many endpoints are event-specific or time-specific; DouyuEx itself leaves several modules commented as invalid.
- High user-trust risk: hard-coded rooms or posts create surprising account actions. A Docker service running unattended should not follow/unfollow rooms or touch activity pages without explicit per-action consent.
- Poor fit with project positioning: this repository is a background "keep account tasks working" tool for medal/gift maintenance, not a browser/live-room automation suite.
- Hard to make observable: users cannot see the live page context inside Docker, so diagnosing why a task action failed or triggered validation is worse than in Tampermonkey.

### Recommendation

1. Client sign-in may be considered later as a disabled-by-default optional task: one endpoint, one daily/manual action, defensive body validation, clear logs, and no reward farming bundled with it.
2. LevelTask may be considered only as "claim already-completed rewards" for explicit configured room ids. Do not poll every 35 seconds; use a conservative cron/manual trigger.
3. Do not port brushing/completion modules by default: no follow/unfollow loops, no fixed-post read loops, no hard-coded activity room signing, no synthetic share/follow/event actions.
4. If a future PRD includes any task action beyond claim-only behavior, require explicit user opt-in per action type and document the external-platform risk in the WebUI before enabling.

## External References

- DouyuEx repository: https://github.com/qianjiachun/douyuEx
- DouyuEx repository metadata: https://api.github.com/repos/qianjiachun/douyuEx
  - Observed on 2026-05-06: default branch `master`, JavaScript, description `斗鱼直播间增强插件（Tampermonkey）`, pushed at `2026-04-24T04:58:31Z`.
- DouyuEx README raw: https://raw.githubusercontent.com/qianjiachun/douyuEx/master/README.md
- DouyuEx `src/common.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/common.js
- DouyuEx `src/main.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/main.js
- DouyuEx `src/packages/Sign/Sign.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign.js
- DouyuEx `src/packages/Sign/Sign_Client.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_Client.js
- DouyuEx `src/packages/LevelTask/LevelTask.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/LevelTask/LevelTask.js
- DouyuEx `src/packages/Sign/Sign_Follow.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_Follow.js
- DouyuEx `src/packages/Sign/Sign_ReadPosts.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_ReadPosts.js
- DouyuEx `src/packages/Sign/Sign_Room.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_Room.js
- DouyuEx `src/packages/Sign/Sign_Yuba.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_Yuba.js
- DouyuEx `src/packages/Sign/Sign_Act.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_Act.js
- DouyuEx `src/packages/Sign/Sign_ActqzsUserTask.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_ActqzsUserTask.js
- DouyuEx `src/packages/Sign/Sign_OPFOY.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_OPFOY.js
- DouyuEx `src/packages/Sign/Sign_AnchorStar.js`: https://github.com/qianjiachun/douyuEx/blob/master/src/packages/Sign/Sign_AnchorStar.js

## Related specs

- `.trellis/spec/backend/index.md`
- `.trellis/spec/backend/directory-structure.md`
- `.trellis/spec/backend/error-handling.md`
- `.trellis/spec/backend/logging-guidelines.md`
- `.trellis/spec/backend/quality-guidelines.md`

Spec implications:

- Add reusable endpoint wrappers in `src/core`, not in Docker route handlers.
- Treat unofficial Douyu response bodies as untrusted structured data and check business status fields.
- Never log full cookies or constructed tokens.
- Keep new Docker jobs conservative, observable, and manually triggerable.
- Avoid browser-only or DOM-context behaviors unless the project explicitly changes scope.

## Caveats / Not Found

- No active Trellis task was set in session state; the caller supplied `.trellis/tasks/05-06-douyuex-feature-research/` as the output task path, so this file was written only under that task's `research/`.
- I did not validate Douyu endpoints with live cookies. All endpoint behavior here is source-code research from DouyuEx plus local project constraints.
- `LevelTask.js` is claim-only in the inspected upstream source, but the larger DouyuEx sign/task ecosystem includes completion-like modules. A future implementation should keep those concerns separate.
- DouyuEx is a browser userscript. Its use of `credentials: include`, global `rid`, `dyToken`, and DOM/user click context does not map one-to-one to a Docker daemon.
