# 审查项目代码并制定优化方案

## Goal

对当前仓库进行完全独立的全量代码优化审查，覆盖核心任务、Docker 运行时、Vue WebUI、测试与交付链路；以代码证据筛选值得实施的优化，并在不扩大架构复杂度的前提下完成一批可验证改进。

## Background

- 项目是单仓库 TypeScript 应用：共享斗鱼与任务逻辑位于 `src/core/`，Docker 运行时与路由位于 `src/docker/`，Vue WebUI 位于 `src/docker/webui/`，Node 契约测试位于 `test/`。
- 用户要求本次独立覆盖每个主要模块；即使从上次应用提交 `2730aba` 到审查开始时业务代码没有变化，也不缩减审查范围。
- 本任务只关注代码与工程优化，不进行安全漏洞、认证攻防、密钥泄漏或依赖 CVE 审计；此前完成的依赖安全修复不作为本次结论重复处理。
- 审查基线全部通过：`npm run lint`、`npm run type-check`、33 项 `npm run test:contracts` 和 `npm run build:docker`；完整本地构建约 7.45 秒，WebUI JavaScript 为 154.39 kB（gzip 51.40 kB）。
- 之前已经完成配置归一化模块重命名、三个旧配置迁移分支清理、凭证恢复同文件阶段化以及取消最后一次送礼后的无效等待；本任务不得重复或逆转这些结果。

## Requirements

### R1 — CI 执行现有契约测试

- 在 GitHub Actions 的现有 `validate` 任务中运行 `npm run test:contracts`；当前任务只执行安装、lint、类型检查与构建，未执行 33 项行为契约（`.github/workflows/docker.yml:61-70`）。
- 让 `test/**` 与 `eslint.config.mjs` 变更触发验证；当前 push/PR 路径过滤未覆盖这些输入（`.github/workflows/docker.yml:9-32`）。
- 不在 CI 中调用会再次执行 `build:docker` 的 `npm test`，避免重复 Docker 运行时构建。

### R2 — 单次多礼物任务复用房间 `did`

- 在一个任务执行周期内缓存成功解析的房间 `did`，避免每个礼物组都重新请求同一房间页面；当前 `sendGifts` 会在每次尝试前调用 `getDid`（`src/core/job-gift-utils.ts:63-71`），而临期与限时双倍任务会按礼物种类重复调用 `sendGifts`（`src/core/expiring-gift-job.ts:60-78`、`src/core/double-card-job.ts:79-99`）。
- 只缓存成功结果；失败结果不得缓存，以便后续礼物组仍可重试该房间。
- 保持实际送礼严格串行、失败数量向下一个房间转移、尝试之间两秒间隔以及最后一次后不等待的现有行为。
- 不增加斗鱼请求并发，不把 `did` 放入跨任务或长期运行时缓存。

### R3 — 完整日志按需加载

- 登录初始化只并行加载配置和概况，不再无条件加载最多 500 条完整日志；当前无条件批次位于 `src/docker/webui/resource-state.ts:227-233`。
- 首次进入日志页时复用现有活动标签页加载逻辑（`src/docker/webui/resource-state.ts:161-177`）。
- 保留概况接口的最近日志、日志页手动刷新/清空、仅在日志页活动时每五秒自动刷新以及退出登录后的受保护状态清理。

### R4 — 统一 WebUI 配置提交与完整快照应用

- 在 `resource-config.ts` 附近增加小型配置提交助手，统一向 `/api/config` 提交部分配置、读取 `{ ok, data }` 响应，并用后端返回的完整 `data.config` 更新共享 `rawConfig`。
- 迁移任务配置、手填 Cookie、CookieCloud 和主题保存路径；当前机械请求/应用逻辑分散在 `src/docker/webui/task-shared.ts:224-230`、`src/docker/webui/cookie-source-actions.ts:117-139`、`:229-266` 和 `src/docker/webui/theme.ts:71-95`。
- 助手返回可选的协调后粉丝列表，供任务页面继续使用。
- 功能专属的表单应用、缓存失效、诊断、提示和失败回滚仍由原模块负责；不得扩展成通用资源框架、全局状态库或运行时 schema 系统。

### R5 — 最小化行为测试

- 使用现有 Node 契约测试与 TypeScript 模块加载/依赖 mock 机制增加约 3–5 个聚焦测试。
- 覆盖：每房间成功 `did` 只解析一次、送礼串行顺序、失败数量转移、延迟位置、非日志页登录不请求完整日志、日志页首次加载、配置提交 payload 与后端完整快照应用。
- 不引入浏览器自动化、组件快照或大型测试框架。

## Acceptance Criteria

- [x] 审查与排除范围经过用户确认，并独立覆盖 `src/core/`、`src/docker/`、`src/docker/webui/`、`test/` 和交付配置。
- [x] 质量、测试、构建和包体基线已记录。
- [x] 优化建议已按收益与风险筛选，证据与文件行号记录在 PRD 和 `research/full-code-optimization-audit.md`。
- [x] `design.md` 与 `implement.md` 已完成，执行顺序、验证命令和回滚点明确。
- [x] GitHub Actions 运行 `npm run test:contracts`，`test/**` 与 `eslint.config.mjs` 可触发验证，且不增加重复 Docker 构建。
- [x] 同一次多礼物任务对每个目标房间最多成功解析一次 `did`；送礼次数、串行顺序、失败转移和间隔保持不变。
- [x] 非日志页登录不请求完整 `/api/logs`；首次进入日志页正常加载，自动刷新与概况最近日志不受影响。
- [x] 四类 WebUI 配置保存复用同一提交/响应应用入口，并使用后端返回的完整配置更新共享状态。
- [x] 配置助手不吞并功能专属副作用，不引入通用资源框架或新状态管理依赖。
- [x] 新增行为测试覆盖 R2–R4 的关键不变量；`npm run lint`、`npm run type-check`、`npm run test:contracts` 和 `npm run build:docker` 全部通过。

## Out of Scope

- 在用户完成本规划评审并明确批准开始前，不修改业务代码或 CI。
- 安全审计、依赖 CVE 处理和认证攻防审查。
- 提高双倍卡、送礼或鱼吧任务的外部请求并发；此前因斗鱼平台风险控制而保留的串行策略继续有效。
- WebUI 全局状态库、按当前包体做代码拆分、通用响应解码/schema 框架、Redis/数据库/服务层改造，或仅按文件行数拆分领域模块。
- 本批次不处理低收益清理：`resource-request.ts` 未读取的 `fetchedAt`、重复 Cookie 解析、重复 User-Agent 常量与时间格式化器；这些可在未来有直接需求时顺带处理。
