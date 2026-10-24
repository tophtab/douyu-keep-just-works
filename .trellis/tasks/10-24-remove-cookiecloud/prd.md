# 移除 CookieCloud 功能

## Goal

彻底移除 CookieCloud 同步功能：后端远程抓取/解密/缓存/定时同步、配置字段与校验、WebUI 面板与专用 API，以及配套测试和文档。保留本地扫码登录、手填 Cookie、基于 passport Cookie 的 safeAuth 主站刷新与鱼吧 SSO 恢复能力。

旧 `config.json` 中的 `cookieCloud` 字段静默忽略并在下次保存时剥离，不报错、不阻塞启动。

## Background

- CookieCloud 只是把浏览器 Cookie 同步成本地登录快照的兼容路径；运行时任务始终读取本地 `loginCookies` 快照。
- 该功能维护面很大：独立客户端、cron 同步服务、60s 缓存、配置归一化/校验、WebUI 面板、两条专用 API、三个契约测试文件，以及多份规格文档。
- 用户已不再使用 CookieCloud，希望彻底删除，而不是保留死配置或隐藏开关。

## Requirements

### R1 运行时彻底移除 CookieCloud

- 删除 CookieCloud 客户端（抓取、AES 解密、域名匹配、快照构建）、同步服务、缓存模块。
- 启动、配置保存、定时任务、凭证恢复重试都不再触发任何 CookieCloud 请求。
- 运行时配置变更不再感知或重算 CookieCloud 状态。

### R2 保留并简化本地凭证恢复

- 凭证恢复只使用：当前本地主站 Cookie、手填 passport Cookie（`loginCookies.passport`）。
- 保留 safeAuth 刷新主站 Cookie、鱼吧 SSO 刷新鱼吧 Cookie、本地快照持久化。
- 恢复结果不再有 `'cookieCloud'` 来源；仅保留 `'safeAuth' | null`。
- 恢复失败提示只描述本地/手填来源，不再提 CookieCloud。

### R3 配置模型删除 CookieCloud

- `DockerConfig` 删除 `cookieCloud` 字段；删除 `CookieCloudConfig`、`CookieCloudCryptoType`、`CookieCloudCookie` 类型和默认值/常量。
- 配置归一化、部分更新、校验、示例配置都不再包含 CookieCloud。
- 旧配置中的 `cookieCloud` 字段在加载时被归一化白名单丢弃，保存后不再写回；不得因此启动失败或返回校验错误。

### R4 服务端 API 收敛

- 删除仅服务于 CookieCloud 的 `/api/cookie-source/persist` 与 `/api/cookie-source/effective`。
- `/api/overview` 不再返回 `cookieCloudConfigured`。
- 保留 `/api/cookie-source/check`（只读本地配置，不发远程请求）与 passport 扫码登录路由。
- `/api/config` 与 `/api/cookie` 的本地 Cookie 保存行为不变。

### R5 WebUI 删除 CookieCloud

- 登录页删除 CookieCloud 面板、启用开关、endpoint/uuid/password/cron 输入、cron 预览、保存并启用/同步并校验动作。
- 删除对应的共享状态、action、导出和样式。
- 其他页面“保存 Cookie 或启用 CookieCloud”类文案改为只提保存 Cookie。
- 登录页保留扫码登录、手填三个 Cookie、状态卡与诊断检查。

### R6 文档与仓库清理

- README 功能表、SECURITY、CONTRIBUTING、issue 模板、`config.example.json` 删除 CookieCloud 表述。
- CHANGELOG 历史条目保留，在 `Unreleased` 下新增移除说明。
- `.trellis/spec/` 中把 CookieCloud 描述为现行能力的段落同步删除或改写。
- `.trellis/tasks/archive/` 中的历史任务记录不动。

### R7 测试同步更新

- 删除 CookieCloud 专属用例。
- 更新配置守卫、服务端路由守卫、passport 恢复契约测试的夹具与断言。
- 新增用例：含 `cookieCloud` 的旧配置加载后对象不含该键，保存后文件不含该键。
- 更新后全量 lint、type-check、契约测试、构建通过。

## Acceptance Criteria

- [ ] `grep -ri "cookiecloud\|cookie_cloud\|cookie-cloud"` 在 `src/`、`config.example.json`、`README.md`、`SECURITY.md`、`CONTRIBUTING.md`、`.github/`、`.trellis/spec/` 中没有结果（CHANGELOG 历史条目与 `.trellis/tasks/archive/` 除外）。
- [ ] `test/` 中只允许保留用于证明旧字段被剥离/忽略的守卫用例（输入含 `cookieCloud`、断言结果不含），不得有 CookieCloud 行为用例。
- [ ] 加载包含 `cookieCloud` 的配置：`normalizeDockerConfig` 结果不含该键，不抛错；保存到磁盘后文件不含该键。
- [ ] 应用启动与配置变更日志不再出现 CookieCloud；缺少登录凭证时提示只指向扫码/手填 Cookie。
- [ ] 凭证恢复在仅有本地主站 Cookie + 手填 passport Cookie 的场景下通过契约测试，结果 `refreshedBy` 只为 `safeAuth` 或 `null`。
- [ ] `/api/cookie-source/persist`、`/api/cookie-source/effective` 返回 404；`/api/cookie-source/check` 仍返回本地诊断；overview 无 `cookieCloudConfigured`。
- [ ] WebUI 登录页没有 CookieCloud 区块；扫码、手填保存、状态卡、诊断检查可用；`npm run build:webui` 通过。
- [ ] `npm run lint`、`npm run type-check`、`npm run test:contracts`、`npm run build` 全部通过。
- [ ] `.trellis/spec/` 不再把 CookieCloud 写成现行能力。

## Non-Goals

- 不新增其他 Cookie 来源或浏览器扩展集成。
- 不修改斗鱼 API 调用频率、任务调度、推送、双倍/临期/鱼吧业务逻辑。
- 不清理 `.trellis/tasks/archive/` 中的历史任务与 journal。
- 不修改已被 gitignore 的本地 `config/config.json`（下次保存时自然剥离）。

## Constraints

- 旧字段处理策略：静默忽略并剥离，不报错、不提示、不保留兼容字段。
- 不为 CookieCloud 保留任何死代码或隐藏开关。
- 已知边界：若某用户只在配置里启用了 CookieCloud 且从未生成本地快照，移除后将没有可用 Cookie；WebUI 会提示扫码/手填。该场景接受，不做自动迁移。
