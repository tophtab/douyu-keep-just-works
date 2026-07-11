# 斗鱼访问频率与风控静态审查报告

日期：2026-07-11

## 执行结论

### 当前工作区

**当前是安全的，实际自动访问频率为 0。** 脱敏读取的 `config/config.json` 中，领取、保活、双倍、CookieCloud 均关闭，缺失的临期礼物和鱼吧签到会归一化为关闭；`docker ps` 也没有发现运行中的项目容器。当前配置虽然保留了 10 个保活/双倍房间，但任务关闭时不会自动执行。只有未来启动容器并手动触发任务或重新启用 cron 后，才会产生斗鱼请求。

### 项目默认配置

**按默认 cron、正常成功响应和单实例使用判断，请求量偏低，通常不会仅因频率触发风控。** 核心默认值为领取每天 2 次、保活使用 `*/7` 日字段、其他斗鱼任务默认关闭，见 `src/core/task-defaults.ts:3-8`、`src/core/task-defaults.ts:39-55`。

在已经保存有效 Cookie、粉丝牌数量为 `F`、远端接口首个候选即成功的情况下：

- 领取任务单次约为 2 个 HTTP GET 加 1 个短时 WebSocket 会话：粉丝牌列表、弹幕领取、背包查询。默认每天 2 次，即约 **4 HTTP 请求/天 + 2 个短时 WebSocket 会话/天**。调用链见 `src/core/collect-gift-job.ts:11-33`。
- 生成的原始默认保活配置没有赠送房间，单次通常只有 1 次背包查询；`0 0 8 */7 * *` 在 2026 年实际触发 59 次，并非严格的 52 次/年。即约 **0.16 HTTP 请求/天**。默认与 cron 见 `src/core/task-defaults.ts:4`、`src/core/task-defaults.ts:41`。
- 双倍、临期和鱼吧任务默认关闭，不产生自动请求。

因此，不计算用户打开 WebUI 产生的状态查询时，默认成功路径约为 **4.16 HTTP 请求/天 + 2 个短时 WebSocket 会话/天**，属于低频。

### 总体风险判断

代码并不是在所有配置下都安全。最需要处理的风险不是默认任务频率，而是以下三个“放大器”：

1. WebUI 默认监听所有网卡并使用默认密码 `password`；若端口暴露到公网，第三方可登录后反复触发刷新、任务和扫码登录。
2. cron 只校验语法，不限制最小周期，`* * * * * *`（每秒一次）可直接保存；锁只按任务类型隔离，不限制跨任务总请求量。
3. 凭证恢复没有全局 single-flight/冷却锁；多个任务或状态查询同时遇到 Cookie 失效时，可能并发 safeAuth。项目历史实测表明，同一 Passport 连续 safeAuth 会轮换主站 Cookie，使前一个快照失效。

在“当前本地配置关闭 + 容器未运行”的前提下风险为低；在“默认密码公网暴露”“秒级 cron”“多任务同秒失败”任一条件出现时，风险会升到高。

## 审查范围与假设

- 仅审查仓库代码、默认配置、`config.example.json` 和当前本地配置的脱敏结构。
- 未向斗鱼或 CookieCloud 发起任何真实请求，未登录真实账号，未读取其他服务器实例。
- 斗鱼没有公开精确风控阈值。本报告中的高/中/低是保守工程判断，不代表斗鱼官方限额。
- 变量：`F` 为粉丝牌/检测房间数，`R` 为实际赠送目标数，`G` 为关注鱼吧数，`K` 为一次任务涉及的礼物类型数。

## 请求入口与单次频率

| 路径 | 斗鱼请求 | 正常单次量 | 放大条件 |
| --- | --- | ---: | --- |
| 领取荧光棒 | 粉丝牌列表 GET、弹幕 WebSocket、背包 GET | 2 HTTP + 1 WS | 背包候选全部失败；凭证恢复后整任务重试 |
| 保活 | 背包 GET；每个目标房间 1 次房间页 GET + 1 次赠送 POST | `1 + 2R` | 背包回退、10 房间配置、凭证恢复 |
| 双倍任务 | 背包 GET、每房间双倍状态 GET、房间页 GET、赠送 POST | `1 + F + 2R`（荧光棒） | 限时礼物形成 `K × R` 赠送；所有检查连续执行 |
| 临期礼物 | 背包 GET、房间页 GET、赠送 POST | `1 + R + K×R` | 礼物类型和目标房间同时增大 |
| 鱼吧签到 | 关注列表分页、极速签到、逐组签到、逐组补签 | 常见约 `ceil(G/30)+1+2G` | 单组签到重试一次；补签最多 10 次，理论上 `ceil(G/30)+1+12G` |
| 粉丝牌状态 | 粉丝牌 GET、背包 GET、每房间双倍状态 GET | 冷缓存 `2+F` | 强制刷新为 `3+F`；背包失败可额外扫候选 |
| 鱼吧状态 | 关注列表分页、每组 head GET | `ceil(G/30)+G` | 每个 head 的 dy-token 与旧 Cookie 双路径回退，最多约 `ceil(G/30)+2G` |
| Passport 扫码 | 生成码、每 2 秒轮询、主站交换、鱼吧 SSO | 完成很快时数次 | 300 秒不扫码时约 150 次轮询；完整链路上界约 156 次斗鱼请求 |
| Cookie 恢复 | 本地 Cookie 验证、safeAuth、再次验证、可选鱼吧 SSO、原操作重试 | 原操作 + 3 次左右 | 鱼吧恢复再加 4 次 SSO；多个调用者可并发恢复 |

### 典型 10 房间场景

- 当前本地保活配置有 10 个正数目标。若用户手动触发且背包数量足够，正常路径为 **21 个 HTTP 请求**：1 次背包、10 次房间页、10 次赠送；赠送目标之间有 2 秒间隔，整体至少约 18 秒。证据见 `src/core/keepalive-job.ts:7-33`、`src/core/job-gift-utils.ts:86-105`。
- 10 个粉丝牌的冷缓存总览加载约 **12 个 GET**：1 次粉丝牌列表、1 次背包、10 次双倍状态；双倍检查并发上限为 4。证据见 `src/docker/runtime-cache.ts:173-217`。
- 10 个粉丝牌的顶部“强制刷新”约 **13 个 GET**，因为 base 和 details 都携带 `force=1`，粉丝牌列表被读取两次。调用链见 `src/docker/webui/resource-fans.ts:273-313`、`src/docker/runtime-cache.ts:159-177`。
- 如果背包所有候选端点都失败，10 个候选房间加 2 个内置房间会形成最多 **24 次连续背包 GET**；10 房间强制刷新总量可上升到约 **36 个 GET**（2 次粉丝牌列表 + 24 次背包候选 + 10 次双倍状态）。候选构造与无差别回退见 `src/core/api.ts:95-105`、`src/core/api.ts:195-235`。

## 风险发现

### 高风险 1：默认 WebUI 暴露面可被用于远程放大斗鱼请求

证据：

- Compose 将 `51417` 映射到宿主机所有接口，且默认 `WEB_PASSWORD=password`，见 `docker-compose.yml:6-12`。
- 程序自身也以 `password` 为缺省密码，见 `src/docker/index.ts:5-8`。
- 服务监听 `0.0.0.0`，见 `src/docker/runtime.ts:150-152`。
- 认证后的 API 可以手动触发任意已配置任务，见 `src/docker/server-task-routes.ts:17-29`；认证登录和触发接口均没有请求频率限制。

触发条件：NAS 端口被路由器转发、公网反向代理未加额外认证、局域网存在不可信客户端，或用户未修改默认密码。

影响：攻击者无需直接获得斗鱼 Cookie 即可通过 WebUI 让后端使用已保存 Cookie 反复刷新状态、生成二维码或触发任务，造成账号/IP 维度异常访问，并可能执行真实送礼动作。

建议：部署时立即改强密码，仅通过 LAN/VPN 访问，不做公网端口直通；代码层面应拒绝默认密码启动或至少输出高等级告警，并为登录、强制刷新、扫码开始和任务触发添加服务端节流。

### 高风险 2：cron 无最小周期限制，可配置为每秒执行

证据：

- cron 校验只尝试构造 `CronJob`，没有计算相邻触发间隔，见 `src/docker/cron.ts:8-20`。
- `* * * * * *` 能被当前依赖正常接受，理论触发 86,400 次/天。
- 调度锁为 `Record<TaskType, boolean>`，只阻止同一种任务重叠，见 `src/docker/runtime-scheduler.ts:27-73`。
- 五种任务分别创建独立 CronJob，可在同一秒并发运行，见 `src/docker/runtime-scheduler.ts:181-232`。

触发条件：误填或主动填写秒级 cron，或多个任务配置为相同秒点。

影响：只要单次任务能在一秒内结束，就可持续达到约 1 次/秒；不同任务之间还可叠加。即使任务较慢，同任务锁也只是“忙时跳过”，没有账号/IP 全局请求预算。

建议：保存配置时计算未来两个触发点并设置任务级最小间隔；保守建议领取/临期/鱼吧至少按小时或天、保活按天、双倍至少按几十分钟到小时。增加按账号/Cookie 维度的全局请求队列、并发上限和随机抖动，而不是只依赖 cron。

### 高风险 3：凭证恢复没有全局 single-flight，可能并发 safeAuth 并轮换 Cookie

证据：

- 每个失败调用都会独立进入 `refreshCookieSourceAfterFailure`，服务中没有 pending promise、mutex 或冷却时间，见 `src/docker/runtime-cookie-recovery.ts:72-105`。
- 恢复会先验证本地主站 Cookie，再执行 safeAuth，再验证新 Cookie，鱼吧场景还会执行完整 SSO，见 `src/docker/runtime-cookie-recovery.ts:396-430`。
- scheduled task 的锁只按任务类型，WebUI 状态查询也不共享该锁，因此不同任务/查询可同时恢复。
- 历史实测记录确认：同一 LTP0 连续两次 safeAuth 会产生不同主站 Cookie，第二次会使第一次失效，见 `.trellis/tasks/archive/2026-06/06-05-passport-refresh-cookie-authority/research/local-code-cookie-authority.md:56-64`。

单次主站恢复的典型放大：原操作失败 + 旧 Cookie 验证 1 次 + safeAuth 1 次 + 新 Cookie 验证 1 次 + 原操作重试。鱼吧恢复还会增加 4 个 SSO GET，见 `src/core/douyu-passport.ts:416-499`。

影响：多个任务同时判断 Cookie 失效时，可能形成 safeAuth 突发、互相轮换快照、继续触发新的认证失败和恢复，既增加 Passport/主站访问，也可能形成“恢复—失效—再恢复”的认证震荡。

建议：凭证恢复改为进程级 single-flight；同一 Passport 材料只允许一个恢复在途，其他调用等待并复用结果。成功后增加短冷却窗口，并在冷却期内先使用最新快照重试，禁止再次 safeAuth。

### 中风险 1：背包端点对所有错误连续回退，可能把 429/封禁响应放大

证据：

- 候选为两个内置房间加全部传入房间，每个房间同时生成 v5、v1 两个端点，见 `src/core/api.ts:95-105`。
- `getBackpackStatus` 捕获所有异常后直接尝试下一个端点，没有延迟，也没有按 HTTP 429、403、Gee 或认证失败提前停止，见 `src/core/api.ts:195-235`。

请求上界为 `2 × |unique({217331,557171} ∪ candidateRoomIds)|`。10 个不重复房间时最多 24 次；若外层凭证恢复后重试原任务，候选扫描可能再次发生。

建议：仅对明确的“端点版本/房间不兼容”错误回退；遇到 401/403/429、Gee、网络超时或认证字段错误立即停止。候选房间设置小上限，并在版本/房间切换间加入短退避。

### 中风险 2：强制刷新会重复粉丝牌列表请求，并可反复制造突发

证据：

- WebUI 强制刷新先请求 `/api/fans/status/base?force=1`，再请求 `/api/fans/status/details?force=1`，见 `src/docker/webui/resource-fans.ts:295-313`。
- base 强制刷新会调用 `getFansList(cookie, true)`，details 又将 `forceRefresh` 传给 `getFansList`，见 `src/docker/runtime-cache.ts:159-177`。
- 详情随后并发 4 路检查所有房间双倍状态，见 `src/docker/runtime-cache.ts:184-211`。
- 前后端会合并同一时刻的 pending 请求，但完成后没有冷却时间，见 `src/docker/runtime-cache.ts:49-82`、`src/docker/webui/resource-state.ts:211-224`。

影响：10 房间一次强刷正常约 13 个 GET，背包异常时约 36 个 GET。用户连续点击或直接调用认证 API 可重复这些突发。

建议：一次强刷生成一个服务端 snapshot，base/details 共享同一次强制读取；顶部刷新增加 30-60 秒冷却提示，服务端再按会话/账号做节流，不能只依赖按钮禁用。

### 中风险 3：多礼物类型任务在组边界没有发送间隔

证据：

- `sendGifts` 只在同一组的相邻目标之间 sleep 2 秒，最后一个目标后不等待，见 `src/core/job-gift-utils.ts:86-105`。
- 临期和限时双倍会按礼物类型循环，多次调用 `sendGifts`，见 `src/core/expiring-gift-job.ts:59-80`、`src/core/double-card-job.ts:79-101`。

公式：临期任务正常约 `1 + R + K×R`。当 `R=1` 时，每个礼物组内部没有任何 sleep，`K` 个赠送 POST 可能连续发出；当 `R>1` 时，每个组结束到下一组开始之间也没有间隔。

建议：将写操作节流放到任务级共享发送队列，保证任意两次赠送 POST 之间都有最小间隔，而不是按单次 `sendGifts` 调用局部计时。

### 中风险 4：鱼吧查询和签到随关注数量线性增长

证据：

- 鱼吧状态按 30 条分页，并对每个鱼吧请求 head，head 并发为 5；单个 head 失败会再尝试旧 Cookie 路径，见 `src/core/yuba-status.ts:85-142`、`src/core/yuba-status.ts:190-251`。
- 签到先调用 fastSign，但仍逐个鱼吧签到并执行补签检查；签到失败可重试一次，补签最多 10 次，见 `src/core/yuba-check-in.ts:20-22`、`src/core/yuba-check-in.ts:164-245`。
- 逐组之间已有 5-8 秒随机间隔，并在 Gee/登录问题时提前停止，这是有效保护。

10 个鱼吧时，状态查询正常约 11 个 GET、回退时约 21 个；签到常见约 22 个请求，理论最坏约 122 个，但会被 5-8 秒组间间隔拉长。

建议：保留现有间隔与提前停止；对大列表增加总请求预算，fastSign 成功后只对确有需要的组做后续调用，状态页手动强刷增加冷却。

### 中低风险：Passport 二维码轮询固定每 2 秒，缺少在途锁

证据：

- 二维码默认有效期为 300 秒，见 `src/core/douyu-passport.ts:301-332`。
- WebUI 每 2 秒调用一次后端 poll，见 `src/docker/webui/cookie.ts:47-59`。
- `pollPassportQrLogin` 没有使用 `passportQrLoginBusy` 或 pending promise；后端 session 也没有 poll mutex，见 `src/docker/webui/cookie-source-actions.ts:77-95`、`src/docker/runtime-passport-qr-login.ts:73-120`。

不扫码时约 150 次 Passport 查询；若单次响应超过 2 秒，setInterval 可能产生重叠 poll。该端点本身就是轮询用途，且只在用户主动扫码期间发生，所以风险低于自动任务。

建议：前端改为上一轮完成后再延迟 2 秒的递归 timeout，或增加 poll single-flight；扫码/确认后可适度放慢轮询，终态继续立即停止。

### 低风险：自动化指纹固定，默认 cron 无启动抖动

- HTTP 使用固定且较旧的 Edge 115 User-Agent，见 `src/core/api.ts:4`。
- 弹幕领取每次生成新的随机 `devid`，见 `src/core/collect-gift.ts:47-55`、`src/core/collect-gift.ts:62-102`。它与长期 Cookie/账号行为组合时可能形成不自然设备信号。
- 默认 cron 都在固定秒点，没有实例级随机偏移，见 `src/core/task-defaults.ts:3-8`。

单实例默认频率很低，因此这里只评为低风险。建议保持设备标识在项目会话内稳定，并为定时任务增加小范围随机启动抖动。

## 已有有效防护

- 同一种任务有运行锁：scheduled 忙时跳过，manual 忙时返回错误，见 `src/docker/runtime-scheduler.ts:50-73`、`src/docker/runtime-task-runners.ts:27-67`。
- 粉丝牌列表、详情和鱼吧状态分别有 1 分钟、5 分钟、10 分钟缓存，并合并 pending 请求，见 `src/docker/runtime-cache.ts:8-11`、`src/docker/runtime-cache.ts:49-82`。
- 双倍状态页面查询并发限制为 4，鱼吧 head 查询并发限制为 5，见 `src/docker/runtime-cache.ts:11`、`src/core/yuba-status.ts:190-216`。
- 赠送任务串行执行，同组目标间隔 2 秒；房间 DID 在同一任务内复用，减少重复房间页访问，见 `src/core/job-gift-utils.ts:7-19`、`src/core/job-gift-utils.ts:70-105`。
- 鱼吧逐组操作间隔随机 5-8 秒，签到只重试一次，补签上限 10 次，并对 Gee/登录问题提前停止，见 `src/core/yuba-check-in.ts:20-22`、`src/core/yuba-check-in.ts:134-157`、`src/core/yuba-check-in.ts:191-245`。
- 原业务操作在凭证恢复后只重试一次，见 `src/docker/runtime-cookie-recovery.ts:96-105`。
- 所有业务 API 位于认证边界之后，见 `src/docker/server.ts:18-24`、`src/docker/server-auth.ts:129-152`。这能阻止未认证访问，但默认密码和无服务端节流削弱了保护。

## 测试覆盖与缺口

已有覆盖：

- 强制刷新路由参数、缓存绕过和 pending 合并有行为测试，见 `test/force-refresh-contract.test.js:28-173`。
- 送礼串行、2 秒间隔、最后一次不延迟和 DID 复用有行为测试，见 `test/code-optimization-contract.test.js:9-100`。
- safeAuth、鱼吧 SSO、恢复材料与恢复分支有较多合同测试，见 `test/douyu-passport-contract.test.js`。
- 鱼吧签到基本成功路径和接口结构有测试，见 `test/yuba-check-in-contract.test.js`。

关键缺口：

1. 没有测试拒绝秒级/过密 cron，也没有最小周期合同。
2. 没有测试不同任务同时运行时的全局请求并发或全局预算；现有锁只验证/实现任务内互斥。
3. 没有测试多个调用者同时进入 Cookie 恢复时只执行一次 safeAuth。
4. 没有测试 429/403/Gee 时背包回退必须停止，也没有候选请求数上限测试。
5. 强制刷新测试分别验证 base/details，却没有执行 WebUI 的完整两阶段链路并断言一次点击只读取一次粉丝牌列表。
6. 送礼测试明确接受跨礼物组边界无延迟，没有保护“所有赠送 POST 全局间隔”。
7. 没有测试 Passport poll 的 single-flight；2 秒 interval 仅由静态合同约束。
8. 鱼吧测试未保护 5-8 秒区间、补签 10 次上限和总请求预算。

## 整改优先级

### 立即执行，无需修改代码

1. 保持当前任务关闭状态，直到确认需要哪些任务；不要一次性全部开启。
2. 将 `WEB_PASSWORD` 改为随机强密码，确认端口不暴露公网，优先通过局域网/VPN 访问。
3. 不使用秒级或分钟级高频 cron；保留当前低频默认值，不把多个任务安排在同一秒。
4. 遇到 403、429、Gee 或连续 Cookie 失效时先停任务，不要连续手动刷新或重复扫码/safeAuth。
5. 当前 10 房间保活若未来启用，先用一次手动执行观察脱敏日志，不要同时开启双倍和临期任务。

### P1 代码防护

1. 增加 cron 最小间隔验证和安全预设。
2. 增加账号/Cookie 维度的全局斗鱼请求调度器：读请求限制并发和持续速率，写请求严格串行。
3. 凭证恢复使用进程级 single-flight + 成功冷却，消除并发 safeAuth。
4. 中央识别 429/403/Gee/认证错误；这些响应必须停止回退和重试，并尊重 `Retry-After`。
5. WebUI 拒绝默认密码或启动时显著告警；对任务触发、强刷和扫码开始做服务端节流。

### P2 请求减量

1. 合并粉丝牌 base/details 强制刷新，保证一次点击只获取一次粉丝牌列表和一次状态 snapshot。
2. 限制背包候选房间数量，并按错误类型决定是否回退。
3. 将礼物发送间隔提升为任务级共享节流，覆盖礼物组边界。
4. Passport poll 改为 single-flight 的完成后延时轮询。
5. 为默认 cron 增加 15-90 秒实例级随机抖动，避免固定秒点同步。

## 最终回答

- **现在安全吗？** 当前工作区没有运行容器且所有自动任务关闭，当前实际访问为 0，安全。
- **默认配置安全吗？** 正常成功路径很低频，单实例通常安全；默认任务本身不是主要风控来源。
- **会不会因频率过高触发风控？** 会。在默认密码公网暴露、秒级 cron、多任务同秒运行、并发凭证恢复、连续强制刷新或背包错误回退时，代码可以产生明显的请求突发或持续访问。
- **最优先修哪里？** 先处理 WebUI 默认暴露、cron 最小周期、全局请求预算和 safeAuth single-flight；这四项能消除大部分高风险放大路径。
