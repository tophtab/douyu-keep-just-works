# CookieCloud 与本地 Cookie 权威模型审查设计

## Confirmed Authority Model

用户确认的目标模型为：

1. 运行时任务永远只读取本地持久化快照。
2. CookieCloud 开启时是本地快照的更新器；关闭时停止更新，但不清空本地快照。
3. 本地快照的历史来源可以是 CookieCloud、手填或扫码，运行时无需保留来源标签。
4. 云端不完整数据不应破坏更完整的本地可用数据。

## Review Boundaries

- 主站：`manualCookies.main` / legacy `cookie`。
- 鱼吧：`manualCookies.yuba`，缺失时运行时可回退主站 Cookie。
- Passport：`manualPassport.cookie`，用于 safeAuth 与鱼吧 SSO 恢复。
- CookieCloud：只读远端导入，不向浏览器或云端写回。
- 扫码：显式写入本地 Passport -> 主站 -> 鱼吧快照。

## Scenario Matrix

审查以下状态转换：

- CookieCloud 关闭 + 本地扫码/手填快照。
- CookieCloud 从关闭切换到开启。
- 启动同步、定时同步、手动同步并校验。
- 云端主站/鱼吧完整或不完整，Passport 有或没有 LTP0。
- 扫码发生在 CookieCloud 已开启期间。
- CookieCloud 同步与扫码写入并发。
- 凭证恢复时本地主站有效/无效、鱼吧失败，以及 CookieCloud/本地 Passport 同时存在。

## Safety Criteria

- 任务请求不能直接依赖 CookieCloud 在线可用性。
- 关闭 CookieCloud 后必须继续使用最后一次本地快照。
- 不完整云端快照不能降级完整本地快照。
- 同一次写入不应把新本地快照回滚成同步开始前的旧值。
- 主站、鱼吧和 Passport 独立更新时，不应形成明显不一致的账号/设备组合；若代码无法证明一致，应明确限制条件。
- 启用同步和手动同步不应无意触发重复并发写入。

## Deliverable

在任务目录写入 `audit.md`，输出：

- 用户心智模型与当前代码的对应关系；
- 实际优先级/写入顺序表；
- 各场景是否安全；
- 已存在的保护与真实缺口；
- “无需修改”或最小修改建议。

## No-Mutation Constraint

本任务不修改业务代码、配置或外部状态；本地配置只读取开关和字段存在性，不输出敏感值。
