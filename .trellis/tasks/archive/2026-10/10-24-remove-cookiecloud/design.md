# 技术设计：移除 CookieCloud 功能

## 1. 设计结论

采用“彻底删除 + 单点迁移”的方案：

1. 删除 CookieCloud 专属模块：`src/core/cookie-cloud.ts`、`src/docker/runtime-cookie-cloud-sync.ts`、`src/docker/runtime-cookie-cloud-cache.ts`。
2. 把仍被本地诊断复用的纯函数 `createCookieDiagnostics` 迁移到新文件 `src/core/cookie-diagnostics.ts`。
3. 把“有效 Cookie”逻辑收敛为“本地 Cookie 直读”，删除云端合并、远程持久化与 effective 预览 API。
4. 配置层删除字段并通过现有归一化白名单自然剥离旧字段。
5. 凭证恢复删除 CookieCloud 阶段，保留 safeAuth / 鱼吧 SSO。

不引入迁移脚本、不做一次性提示、不保留隐藏开关。

## 2. 数据流对比

### 移除前

```
config.loginCookies ─┐
                     ├─> DockerEffectiveCookieResolver ─> EffectiveCookiePreview
config.cookieCloud ──┘        ▲
                              │ DockerCookieCloudCache
                              │   └─ fetchCookieCloudSnapshot (HTTP + AES)
                              │
DockerCookieCloudSyncService ─┘ (startup + cron)
        │
        └─ persistEffectiveCookies → 覆盖本地 loginCookies 快照
```

### 移除后

```
config.loginCookies ─> getLocalCookieForUrl / resolveCookieForUrlFromConfig ─> 斗鱼请求
config.loginCookies.passport ─> safeAuth（主站）/ 鱼吧 SSO
config.loginCookies.* ─> createCookieDiagnostics（只读，无网络）
```

## 3. 类型契约变更（`src/core/types.ts`）

删除：

- `CookieCloudConfig`
- `CookieCloudCryptoType`
- `CookieCloudCookie`
- `DockerCookieSource`（仅被 `EffectiveCookiePreview` 使用）
- `EffectiveCookiePreview`
- `DockerConfig.cookieCloud`

收敛：

```ts
export interface CookieDiagnostics {
  passport: { ltp0Present: boolean }
  main: { ready: boolean, missingKeys: string[] }
  yuba: {
    dyTokenReady: boolean
    cookieReady: boolean
    missingDyTokenKeys: string[]
    missingCookieKeys: string[]
  }
  snapshot: { cookieCount: number }
}

export interface CookieStatusSummary {
  ltp0Present: boolean
  mainReady: boolean
  mainMissingKeys: string[]
  yubaReady: boolean
  yubaMissingKeys: string[]
  cookieCount: number
  updatedAt?: string
  error?: string
}
```

说明：

- `CookieDiagnostics.source` 与 `snapshot.domains/updatedAt` 只有 CookieCloud 路径会产生不同值，删除。
- `CookieStatusSummary.source` 删除；推送卡片“Cookie 数量”行改为固定说明“来源本地扫码快照”。
- 这是仓库内前后端同源使用的内部 API，可直接改形状；WebUI 未消费被删字段。

## 4. 新增模块 `src/core/cookie-diagnostics.ts`

从 `core/cookie-cloud.ts` 原样迁移：

- `COOKIE_CLOUD_MAIN_REQUIRED_KEYS` → 重命名 `MAIN_REQUIRED_KEYS`
- `COOKIE_CLOUD_YUBA_COOKIE_REQUIRED_KEYS` → `YUBA_COOKIE_REQUIRED_KEYS`
- `COOKIE_CLOUD_YUBA_DY_TOKEN_REQUIRED_KEYS` → `YUBA_DY_TOKEN_REQUIRED_KEYS`
- `createCookieDiagnostics(options)`

签名收敛为：

```ts
createCookieDiagnostics(options: {
  cookies: LoginCookieValues
  snapshot: { cookieCount: number }
}): CookieDiagnostics
```

无网络、无 CookieCloud 依赖。

## 5. 后端模块改造

### 5.1 配置层

| 文件 | 变更 |
| --- | --- |
| `src/core/task-defaults.ts` | 删除 `DEFAULT_COOKIE_CLOUD_SYNC_CRON` 与默认 `cookieCloud` 块 |
| `src/core/config-normalization.ts` | 删除 `normalizeCookieCloud`；`normalizeDockerConfig` / `reconcileDockerConfig` 不再输出该键 |
| `src/docker/config-validation.ts` | 删除 `CookieCloudConfig` import 与 `validateCookieCloudConfig` |
| `src/docker/config-store.ts` | `buildConfigWithPartialUpdate` 删除 `cookieCloud` 合并行；未知输入键本就不会进入白名单 |
| `src/docker/server-config-routes.ts` | 删除 CookieCloud import、payload 校验分支、`cookieCloudConfigured`；`summarizeCookieSource` 只返回 `'local' \| 'none'` |
| `config.example.json` | 删除 `cookieCloud` 块 |

旧字段剥离路径：磁盘 JSON → `normalizeDockerConfig` 的白名单对象 → 不再含 `cookieCloud` → 下一次 `saveConfigToDisk` 自然写掉。无需额外迁移代码。

### 5.2 本地 Cookie 访问

`src/docker/runtime-effective-cookies.ts` 保留为本地辅助模块，删除：

- `CookieCloudSnapshot` / `buildCookieHeaderForUrl` / `isCookieCloudReady` 相关逻辑
- `DockerEffectiveCookieResolver` 类、`EffectiveCookieMaterial`、`EffectiveCookiePreview` 返回
- `shouldUseSourceCookie`、完整性键常量（若无其他消费者）

保留：

- `hasLocalLoginCookies`
- `hasLocalPassportCookie`（`hasPassportRecoveryMaterial` 删除，调用方改用本函数）
- `hasConfiguredCookieSource`（= 本地 main/yuba 非空）
- `getLocalCookieForUrl`
- `resolveCookieForUrlFromConfig`（错误信息只提示配置 Cookie）

### 5.3 `DockerCookieSourceManager`（`runtime-cookie-source.ts`）

删除：

- `DockerCookieCloudCache` 字段与 `loadCookieCloudSnapshot`
- `DockerEffectiveCookieResolver` 字段
- `hasCookieCloudSource` / `hasPassportRecoveryMaterial` / `clearCookieCloudCache`
- `getEffectiveCookies` / `persistEffectiveCookies`

保留并简化：

- `inspectCookieSource()`：本地快照存在则构建诊断，否则抛“请先配置 cookie”
- `recoverCredentialSnapshot()`：只注入本地读取 + 手填 passport + 本地快照持久化
- passport 扫码登录相关方法

### 5.4 `runtime-cookie-snapshot-store.ts`

删除 `persistEffectiveCookies`（唯一调用方是 CookieCloud 同步/手动持久化）与 `EffectiveCookieMaterial` import。保留：

- `persistPassportQrCookieSnapshot`
- `persistLocalCookieSnapshot`

### 5.5 凭证恢复（`runtime-cookie-recovery.ts`）

删除：

- `hasCookieCloudSource` / `persistEffectiveCookies` / `loadCookieCloudSnapshot` 依赖
- `refreshMainCookieFromCookieCloudStage`
- `PassportRecoveryMaterial.source`（只剩手填）
- 所有 CookieCloud 分支文案

新流程：

```
1. 校验当前本地主站 Cookie
2. 失败 → 用 loginCookies.passport 构造 safeAuth（要求 LTP0 + dy_did）
3. 校验 safeAuth 返回的主站 Cookie
4. 需要鱼吧 → 用 passport 执行鱼吧 SSO
5. 持久化本地快照
```

`CredentialSnapshotRecoveryResult.refreshedBy` 收敛为 `'safeAuth' | null`。

### 5.6 运行时装配

- `runtime.ts`：删除 `DockerCookieCloudSyncService` 构造、`reconcileCookieCloudSync`、`clearCookieCloudCache`、shutdown 中的 `cookieCloudSync.stop()`、app context 的 `getEffectiveCookies` / `persistEffectiveCookies`。
- `runtime-config-service.ts`：`cookieSourceChanged` 只看 `loginCookies`；删除两个 CookieCloud 依赖与日志文案中的“或启用 CookieCloud”。
- `runtime-app-context.ts` / `server-types.ts`：删除 `getEffectiveCookies`、`persistEffectiveCookies`；`hasCookieSourcePayload` 只看 `loginCookies`。
- `runtime-fans-sync.ts`：删除 `hasCookieCloudSource` 依赖与 `mergeLatestCookieSnapshot`；`cookieSnapshotEqual` 若无其他消费者一并删除。
- `runtime-cookie-status.ts`：使用本地诊断；`source` 字段删除。
- `runtime-notify.ts`：Cookie 数量行 detail 固定为“来源本地扫码快照”。

### 5.7 路由

`server-cookie-source-routes.ts`：

- 删除 `POST /api/cookie-source/persist`
- 删除 `GET /api/cookie-source/effective`
- 保留 `POST /api/cookie-source/check`
- 保留 passport-login start/status/poll/cancel/retry-yuba
- 删除 `isCookieCloudReady` import

## 6. WebUI 改造

| 文件 | 变更 |
| --- | --- |
| `resource-config.ts` | `CookieSourceConfig` 删除 `cookieCloud`；`hasCookieSourceConfigured` 只看 `loginCookies` |
| `cookie-source-state.ts` | 删除 `cookieCloud` reactive、cron preview 桥接、`getCookieCloudConfig`、`getCookieSourceLabel`（若仅定义未使用） |
| `cookie-source-actions.ts` | 删除 `syncCookieCloudToLoginCookies`、`saveCookieCloud*`、`disableCookieCloud`；`checkCookieSource` 只请求诊断 |
| `cookie.ts` | 删除 CookieCloud 导出/处理器/`cronPreviewText`；保留扫码与手填 |
| `components/LoginConfigPage.vue` | 删除 CookieCloud `PageSection`、`EnableSwitch`/`CronField` import 与相关解构 |
| `resource-fans.ts` / `resource-yuba.ts` / `expiring.ts` / `keepalive.ts` / `double.ts` / `overview.ts` | 文案“保存 Cookie 或启用 CookieCloud” → “保存 Cookie” |
| `styles/tables.css` | 删除 `.cookie-cloud-actions` 规则 |

## 7. 测试改造

### `test/config-guardrails-contract.test.js`

- 期望键顺序删除 `cookieCloud`。
- 删除 `normalizeDockerConfig` 对 CookieCloud 字段的断言。
- 删除 `validateCookieCloudConfig` 用例。
- 部分更新：删除 `cookieCloud: { uuid }` 断言；`cookieCloud: { active: true }` 可保留为“未知旧输入被忽略”的用例。
- 新增：磁盘配置含 `cookieCloud` → 加载后无该键 → 保存后文件无该键。

### `test/server-route-guardrails-contract.test.js`

- `createInitialConfig` 删除 `cookieCloud`。
- 删除 `COOKIE_CLOUD_PASSWORD` 及密码泄露断言。
- 删除 effective/persist 调用记录与用例。
- 新增：`/api/cookie-source/persist`、`/api/cookie-source/effective` 返回 404。
- `inspectCookieSource` mock 改为新诊断形状；check 断言改为 `main.ready` 等。

### `test/douyu-passport-contract.test.js`

- 删除“CookieCloud can build passport cookie material…”用例。
- `createManualRecoveryDeps` 删除三个 CookieCloud 依赖。
- 删除“uses CookieCloud passport dy_did…”用例。
- 删除两个 CookieCloud persist 用例。
- 保留并改名的手填恢复用例继续覆盖 safeAuth + 鱼吧 SSO。

## 8. 文档与规格

- `README.md`：功能表删除 CookieCloud 行。
- `SECURITY.md`、`CONTRIBUTING.md`、`.github/ISSUE_TEMPLATE/*.yml`：删除 CookieCloud 凭证/分类表述。
- `CHANGELOG.md`：`Unreleased` 增加“移除”条目；历史条目不改。
- `.trellis/spec/backend/{index,contracts,directory-structure,error-handling,logging-guidelines,testing-guidelines,douyu-fan-intimacy}.md`：删除 CookieCloud 架构、路由、恢复、日志、测试说明。
- `.trellis/spec/frontend/{index,contracts,state-management}.md`：删除 CookieCloud sync/check 契约，保留本地诊断与扫码登录。

## 9. 权衡与风险

| 风险 | 处理 |
| --- | --- |
| 删除 `/api/cookie-source/effective` 影响外部调用 | 仓库内无消费者；仅契约测试使用；按内部 API 处理 |
| 诊断响应形状变化 | 前后端同仓同步构建；无持久化依赖 |
| 只配置 CookieCloud、从未生成快照的用户升级后无 Cookie | 已知边界；WebUI 提示扫码/手填；不做自动迁移（符合“静默剥离”） |
| 漏删引用导致构建失败 | type-check + lint + 全仓 grep 作为门禁 |
| 删除恢复分支改变失败文案 | 只改文案与来源字段；safeAuth/SSO 行为不变，现有恢复用例覆盖 |

## 10. 回滚

纯删除 + 内部接口收敛，无数据格式升级。回滚方式：`git revert` 本次提交；旧配置文件若已被保存过，CookieCloud 字段已丢失，需要用户重新填写（不可自动恢复）。因此提交前必须完成全量验证。
