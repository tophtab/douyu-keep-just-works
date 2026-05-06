# brainstorm: learn from DouyuEx

## Goal

研究 DouyuEx 的功能面，筛选哪些能力适合被 `douyu-keep-just-works` 学习或新增，形成一份按价值、适配度和实现风险排序的候选功能清单。

## What I already know

* 用户希望“看一下 douyuex”，判断本项目可以学习和添加哪些功能。
* 当前项目定位是斗鱼粉丝牌 Docker 管理台，适合 NAS、家庭服务器和长期后台运行场景。
* 当前 README 明确支持：荧光棒领取、粉丝牌保活、双倍任务检测与分配、鱼吧签到、CookieCloud 同步斗鱼相关 Cookie。
* 本项目已有 Express Docker WebUI、Cron 调度、任务日志、手动触发、配置保存、粉丝牌同步和 CookieCloud 登录态维护。
* DouyuEx 在 README 致谢中已有引用：`qianjiachun/douyuEx`。
* 用户已明确不考虑：荧光棒平均分配模式、月消费统计、房间 VIP/特效过期提醒、关注/粉丝牌直播状态快照、多账号/多 Cookie Profile。
* 用户要求补充解释：DouyuEx 背包状态是怎么做的、客户端签到任务是什么、等级任务到底是只领奖还是也刷任务、以及不建议迁移功能的理由。

## Assumptions

* 这次先做功能调研和产品建议，不直接改代码。
* 推荐项应优先适配 Docker/NAS 常驻后台，而不是照搬浏览器插件里的页面增强能力。
* 若某些功能高度依赖浏览器 DOM、直播间页面注入或用户前台交互，则只作为低优先级或不建议迁移项。

## Open Questions

* 客户端签到任务是否保留为未来候选项，还是排除。
* 等级任务是否只考虑“已完成奖励领取”，还是继续研究主动完成任务的边界和风险。

## Requirements

* 调研 DouyuEx 的功能列表、配置方式和核心实现思路。
* 对照本项目现有能力，标出已覆盖、可增强、可新增、不适合迁移四类。
* 候选功能需要说明：用户价值、是否适配 Docker WebUI、实现风险、建议优先级。
* 输出要能作为后续 PRD 或 issue backlog 的输入。

## Research Summary

* DouyuEx 是 Tampermonkey 直播间增强插件；本项目是 Docker/NAS 常驻管理台，不应照搬浏览器插件功能。
* 已覆盖或基本覆盖：粉丝牌保活、鱼吧签到、双倍检测、Cookie 持久化。
* 高适配候选：背包/临期道具可观测。
* DouyuEx BagInfo 使用斗鱼背包接口读取 `data.list[]`，在浏览器背包 DOM 上展示每个道具行的数量、`expiry`、价值和亲密度；它不做真正的“可能浪费数量”估算，也没有把 `batchInfo` 解析成稳定批次模型。
* DouyuEx 不能证明荧光棒底层一定是“统一一个剩余时间”或“一定分多个剩余时间”。它的证据只到 `data.list[]` 行级别：BagInfo 按背包返回行显示 `expiry`；FansContinue 续牌逻辑只选第一条 `id=268 || id=2358` 的行，并不聚合多条荧光棒，也不按过期时间排序。
* 当前项目临期判断不使用 DouyuEx 展示用的 `expiry` 字段；`getGiftStatus()` 会读取 `expireTime`、`expire_time`、`expireAt`、`expiresAt`、`met`、`endTime` 这些绝对时间字段，并按 Unix 秒/毫秒归一化。此前实际背包样本里荧光棒使用的是 `met`。
* 客户端签到是向 `https://apiv2.douyucdn.cn/h5nc/sign/sendSign` POST 一个由主站 Cookie 字段拼出的 `dyToken`，属于可选但需实测的 HTTP 签到接口。
* DouyuEx `LevelTask.js` 本身是“查询房间等级任务状态，只在已完成且未领奖时领奖”；它不主动完成任务、不刷观看/关注/发言进度。
* DouyuEx 其他 sign/task 模块存在 follow/unfollow、读取固定鱼吧帖子、活动房间签到等“主动制造完成度”的行为，这些应和 `LevelTask.js` 的 claim-only 行为分开看。
* 不建议迁移：播放器增强、弹幕/房管自动化、页面样式修改、红包/宝箱/广告奖励自动化、外部付费服务。

## Candidate Backlog

* P1: 背包和临期道具状态面板。
* Removed by user preference: 荧光棒平均分配模式。
* Decision pending: 可选客户端签到任务。
* Removed by user preference: 月消费只读统计。
* Removed by user preference: 房间 VIP/特效过期提醒。
* Removed by user preference: 关注/粉丝牌房间直播状态快照。
* Removed by user preference: 多账号/多 Cookie Profile。
* Candidate with boundary: 房间等级任务只领取已完成奖励。
* High-risk / not default: 自动完成或刷等级任务进度。

## Acceptance Criteria

* [x] `research/douyuex-feature-map.md` 记录 DouyuEx 功能来源和对比分析。
* [x] 给出 5-10 个可考虑新增或学习的功能候选。
* [x] 明确哪些功能不适合本项目当前定位。
* [x] 给出建议优先级和下一步选择问题。

## Definition of Done

* 研究资料落盘到 Trellis task。
* 最终回复包含高信号功能建议，不要求用户阅读原始研究文件。

## Out of Scope

* 本轮不实现功能。
* 本轮不重构现有 Docker WebUI。
* 本轮不承诺 DouyuEx 的浏览器插件能力全部可在 Docker 后台复现。

## Technical Notes

* Current task directory: `.trellis/tasks/05-06-douyuex-feature-research/`
* Research artifact target: `.trellis/tasks/05-06-douyuex-feature-research/research/douyuex-feature-map.md`
* Deep-dive artifact: `.trellis/tasks/05-06-douyuex-feature-research/research/douyuex-deep-dive.md`
* BagInfo artifact: `.trellis/tasks/05-06-douyuex-feature-research/research/douyuex-baginfo-detail.md`
* Sign/LevelTask artifact: `.trellis/tasks/05-06-douyuex-feature-research/research/douyuex-sign-leveltask-detail.md`
* Glow-stick expiry model artifact: `.trellis/tasks/05-06-douyuex-feature-research/research/douyuex-glow-stick-expiry-model.md`
