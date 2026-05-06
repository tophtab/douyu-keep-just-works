# brainstorm: add expiring gift task

## Goal

新增一个“临期任务”：当荧光棒接近过期时，自动把当前可用荧光棒一次性赠送到配置的一个或多个直播间，减少资源浪费并延续现有 Docker WebUI 的任务管理体验。

## What I already know

* 用户希望新增一个任务栏/菜单，位置在“双倍任务”和“鱼吧签到”之间。
* 任务要参考保活任务机制：Cron 表达式、分配模式、房间配置表、底部保存/手动触发按钮等。
* 现有 WebUI 是单页 `src/docker/html.ts`，任务菜单顺序目前是：领取任务、保活任务、双倍任务、鱼吧签到、运行日志。
* 现有调度任务包括 `collectGift`、`keepalive`、`doubleCard`、`yubaCheckIn`，集中在 Docker 配置、调度、Server API、WebUI 渲染和触发逻辑中。
* 荧光棒库存状态已有 `GiftStatus.expireTime`，由 `/api/fans/status` 展示在概况页。
* 现有背包接口扫描所有 `id === 268` 的荧光棒条目，将 `count` 汇总，并把多个条目里的最早有效过期时间作为 `gift.expireTime` 暴露给 WebUI。
* 现有项目契约记录：斗鱼背包 payload 可能通过 `expireTime`、`expire_time`、`expireAt`、`expiresAt`、`met`、`endTime` 表达过期时间；此前实际观察到荧光棒字段是 `met`，并按 Unix 秒归一化为毫秒。
* 当前 WebUI 只展示“最早过期时间”，还没有对外展示每一批荧光棒各自的数量和过期时间。
* 2026-05-05 通过 CookieCloud 同步后的主站 Cookie 实测背包接口返回 1 个荧光棒条目：196 个，`met=1778428799`，北京时间 2026-05-10 23:59:59 过期。
* 2026-05-06 用户提供的新背包样本仍然只返回 1 个 `id=268` 荧光棒条目：`count=105`，`expiry=5`，`met=1778428799`，北京时间 2026-05-10 23:59:59 过期；这支持“当前可见荧光棒作为一次性库存处理”的 MVP 判断。
* 该样本中 `data.totalNum=60`、`data.validNum=60` 与荧光棒条目的 `count=105` 不一致；临期任务应继续以 `list[]` 中 `id=268` 条目的 `count` 作为可赠送荧光棒库存来源，不使用顶层 `totalNum/validNum` 推断荧光棒数量。
* 仍不确定斗鱼背包接口对荧光棒是否永远返回完整批次明细；它也可能只返回“当前最近过期的一组/摘要”。实现不能依赖“接口一定列出所有未来批次”。
* 粉丝牌列表当前 `Fans` 数据包含 `roomId/name/level/rank/intimacy/today`，在本任务中只用于同步可配置房间列表和赠送目标。
* 保活任务使用 `JobConfig`：`active`、`cron`、`model`、`send`；`model=1` 按百分比，`model=2` 按固定数量。
* 双倍任务额外使用 `enabled` 勾选参与房间，并在按权重模式下提供“参与房间全部设为 1”“按粉丝牌等级填入”按钮。

## Assumptions (temporary)

* “临期任务”会作为独立任务配置、独立状态、独立日志分类、独立手动触发入口。
* 赠送逻辑优先复用现有 `sendGifts` 和 `computeGiftCount*` 计算机制，不重新实现送礼接口。
* 任务触发后只有在达到临期条件时才赠送；未达到条件时记录日志并跳过。
* “临期”只指荧光棒过期时间；本需求不存在“粉丝牌临期”概念。
* 荧光棒临期判断应基于最早过期批次，而不是假设所有库存同一时间过期。
* 用户重新评估后倾向于一次性处理：从产品和程序设计直觉看，荧光棒很可能整体显示一个统一过期时间；如果存在多批不同过期时间，斗鱼通常应提供对应分批显示或逻辑。
* MVP 不做“观察窗口/兜底窗口/分批限额”等复杂策略；临期任务进入阈值后一次性按配置赠送当前可用荧光棒。
* 默认临期阈值为 24 小时，并在 WebUI 中做成可配置项；保存后按用户配置值判断。

## Open Questions

* None for MVP.

## Requirements (evolving)

* 新增配置项，例如 `expiringGift`，纳入 Docker 配置加载、保存、归一化、Cron 校验、任务调度、状态概览和手动触发。
* WebUI 新增“临期任务”菜单，位置在“双倍任务”和“鱼吧签到”之间。
* 临期任务页面复用保活任务的基础体验：启用开关、Cron 表达式、分配模式、房间列表、保存并启用按钮、立即执行按钮。
* 临期任务页面新增“临期阈值（小时）”配置，默认 24 小时。
* 分配模式应支持至少保活任务已有的两种模式：按百分比、按固定数量。
* 房间配置应随粉丝牌同步，新增/删除粉丝牌后自动对齐配置。
* 任务执行时先检查临期条件，再按配置向目标房间赠送荧光棒。
* 荧光棒临期检查至少要读取当前库存数量和最早可见过期时间；MVP 到达阈值后按当前总库存计算赠送数量。
* MVP 不实现分阶段兜底、固定上限、比例上限或“只送临期批次估算数量”等策略。
* 如果未来确认斗鱼确实存在多批独立过期并且接口稳定返回完整分批明细，再另起需求考虑分批处理。
* 日志应清楚说明本次是否达到临期条件、荧光棒数量、赠送目标和跳过原因。
* 概况页和任务状态卡应展示临期任务的启用/调度状态。

## Acceptance Criteria (evolving)

* [ ] WebUI 左侧菜单中“临期任务”位于“双倍任务”和“鱼吧签到”之间。
* [ ] 临期任务页面可配置启停、Cron、临期阈值小时数、分配模式、房间分配值，并可保存。
* [ ] 临期任务可手动触发，且未配置时返回明确错误。
* [ ] 配置保存后只重载受影响任务，不影响无关任务。
* [ ] 粉丝牌同步会对齐临期任务房间配置。
* [ ] 达到临期条件时按配置赠送荧光棒；未达到条件时跳过并写日志。
* [ ] `npm` 项目的 lint/type-check 通过。

## Definition of Done (team quality bar)

* Tests added/updated where project patterns support it.
* Lint / typecheck / CI green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* 不引入浏览器自动化。
* 不改变现有保活、双倍、鱼吧签到任务语义。
* 不重构整个 WebUI 架构。
* MVP 不处理荧光棒多批次独立过期的精细化赠送。

## Technical Notes

* Inspected `src/core/job.ts`: keepalive and double-card jobs both load gift count then calculate gift send jobs.
* Inspected `src/core/gift.ts`: existing allocation helpers support fixed number, percentage, proportion, and double-card redistribution.
* Inspected `src/core/types.ts`: current Docker config has `collectGift`, `keepalive`, `doubleCard`, `yubaCheckIn`.
* Inspected `src/core/medal-sync.ts`: reconciliation with fans is the central place to add task defaults and room config merging.
* Inspected `src/docker/index.ts`: task lifecycle requires updates to `TaskType`, job/status maps, start/trigger/context methods, overview readiness, and fan-sync payload handling.
* Inspected `src/docker/server.ts`: needs validation, overview summary, API config payload, trigger endpoint, and `AppContext` changes.
* Inspected `src/docker/html.ts`: UI and client-side state are manually rendered in one HTML string; adding a tab requires route map, nav, page meta, default config, cron preview state, rendering, save/disable/trigger handlers.
