# 审查 CookieCloud 与扫码 Cookie 优先级

## Goal

只读审查 CookieCloud 快照与项目扫码登录生成的本地 Passport、主站和鱼吧 Cookie 如何对接，明确运行时来源优先级、同步时的覆盖/保留规则、恢复时的选择顺序，以及两种来源并存时是否会破坏已经可用的扫码登录态。

## Background

- 用户只关心 CookieCloud 与本地扫码 Cookie 的协作，不要求修改默认密码、cron、访问频率或其他业务逻辑。
- 项目扫码登录会在本地保存 `manualPassport.cookie`、`manualCookies.main` 和 `manualCookies.yuba`。
- CookieCloud 是浏览器到本地的兼容同步来源；本次需验证它开启、启动同步、手动同步和凭证恢复时是否会覆盖扫码生成的本地快照。
- 本轮不访问真实 CookieCloud 或斗鱼，不输出任何 Cookie、密码、UUID、token 或登录地址。
- 当前本地配置中 CookieCloud 已填写但处于关闭状态，本地主站、鱼吧和 Passport 快照均存在；因此当前运行时只会使用本地快照，不存在 CookieCloud 自动覆盖。
- 运行时斗鱼请求始终读取本地 `manualCookies.main` / `manualCookies.yuba`，不会在每次任务中实时访问 CookieCloud。
- CookieCloud 启用后会在启动时立即同步，并按 cron 继续同步；同步会把解析后的有效结果重新写入本地快照。
- 当前覆盖策略不是单一来源优先级，而是主站、鱼吧、Passport 分别判断：完整的云端主站/鱼吧可以替换本地完整快照；不完整云端主站/鱼吧不会覆盖本地完整快照；云端只要存在 LTP0，就可以替换本地 Passport 快照。
- 当前代码没有记录本地主站、鱼吧、Passport 各自来自扫码还是 CookieCloud，也没有校验三者是否属于同一账号或同一 Passport/device 会话。
- 凭证恢复优先验证当前本地主站；无效时先同步 CookieCloud，之后 Passport 材料优先使用 CookieCloud，最后才使用本地保存的扫码 Passport。
- 用户确认期望的权威模型：本地快照始终是运行时读取对象；CookieCloud 开启时作为本地快照的更新来源，关闭后继续使用已经保存的本地快照；本地快照的历史来源可以是 CookieCloud、手填或扫码，运行时不需要区分来源。
- 用户确认当前主流程已经符合预期，本任务不修改业务代码；仅记录实现证据和极端并发/跨会话边界，不将这些边界升级为当前整改项。

## Requirements

- R1：画出扫码登录与 CookieCloud 各自写入本地配置的完整数据流。
- R2：明确运行时请求最终使用哪一份主站、鱼吧和 Passport Cookie，以及来源优先级是否按域名区分。
- R3：检查 CookieCloud 新快照完整、部分缺失、空值、过期或缺少 Passport LTP0 时，对现有扫码快照的覆盖/保留行为。
- R4：检查启用 CookieCloud、启动自动同步、手动“同步并校验”和凭证失败恢复四种路径是否一致。
- R5：检查同一浏览器 Passport 与项目扫码 Passport 不同时，safeAuth 或 CookieCloud 同步是否可能轮换、混用或破坏本地快照。
- R6：给出当前实现是否安全、推荐的权威来源模型，以及是否值得修改代码的明确结论。

## Acceptance Criteria

- [x] 输出 Passport、主站、鱼吧三类 Cookie 的来源优先级矩阵。
- [x] 输出扫码、CookieCloud 同步、运行时解析和凭证恢复的调用链，并包含 `file:line` 证据。
- [x] 覆盖完整快照、部分快照、CookieCloud 关闭、CookieCloud 开启及不同 Passport 会话等关键场景。
- [x] 明确指出会覆盖什么、不会覆盖什么，以及是否存在实际竞态或登录态破坏风险。
- [x] 给出“无需修改”或“建议修改”的最终判断；如建议修改，限定最小必要范围。
- [x] 审查过程不访问真实外部服务、不修改业务代码、不泄露敏感配置。

## Out of Scope

- 不审查 WebUI 默认密码、cron、一般访问频率或斗鱼风控阈值。
- 不实现 single-flight、Cookie 迁移或配置变更。
