# 执行计划：移除 CookieCloud 功能

> 前置：任务状态为 `in_progress`。按阶段顺序执行；每个阶段结束跑对应验证，失败先修复再进入下一阶段。

## 阶段 0：基线确认

- [ ] 0.1 `git status` 确认工作区只包含本任务预期文件；记录现有脏文件，避免误提交。
- [ ] 0.2 运行基线验证，确认改动前通过：
  - `npm run lint`
  - `npm run type-check`
  - `npm run test:contracts`
- [ ] 0.3 记录全仓引用清单（供最终 grep 对比）：
  - `grep -ril "cookiecloud\|cookie_cloud\|cookie-cloud" src test config.example.json README.md SECURITY.md CONTRIBUTING.md .github`

## 阶段 1：配置与类型核心

- [ ] 1.1 `src/core/types.ts`
  - 删除 `CookieCloudConfig`、`CookieCloudCryptoType`、`CookieCloudCookie`。
  - 删除 `DockerConfig.cookieCloud`。
  - 删除 `DockerCookieSource`、`EffectiveCookiePreview`。
  - 收敛 `CookieDiagnostics`、`CookieStatusSummary`（见 design §3）。
- [ ] 1.2 `src/core/task-defaults.ts`：删除 `DEFAULT_COOKIE_CLOUD_SYNC_CRON` 与默认 `cookieCloud` 块。
- [ ] 1.3 `src/core/config-normalization.ts`：删除 `normalizeCookieCloud` 及两处挂接。
- [ ] 1.4 `src/docker/config-validation.ts`：删除 import 与 `validateCookieCloudConfig`。
- [ ] 1.5 `src/docker/config-store.ts`：删除 `cookieCloud` 合并行。
- [ ] 1.6 `config.example.json`：删除 `cookieCloud` 块。

验证：`npm run type-check:docker` 预期仍有运行时错误，但不应出现配置层语法错误；先记录剩余错误进入阶段 2。

## 阶段 2：诊断模块迁移

- [ ] 2.1 新建 `src/core/cookie-diagnostics.ts`，迁移 `createCookieDiagnostics` 与三个必需键常量。
- [ ] 2.2 删除 `src/core/cookie-cloud.ts`。
- [ ] 2.3 更新 `runtime-cookie-source.ts`、`runtime-cookie-status.ts` 的 import 与调用参数。

验证：`npm run type-check:docker` 中 CookieCloud 客户端相关错误应清零，剩余错误应集中在 runtime 装配与恢复流程。

## 阶段 3：后端运行时

- [ ] 3.1 `runtime-cookie-recovery.ts`
  - 删除 `hasCookieCloudSource`、`persistEffectiveCookies`、`loadCookieCloudSnapshot` 依赖与 `refreshMainCookieFromCookieCloudStage`。
  - `refreshedBy` 收敛为 `'safeAuth' | null`；删除 `PassportRecoveryMaterial.source`。
  - 清理全部 CookieCloud 分支与文案。
- [ ] 3.2 `runtime-effective-cookies.ts`
  - 删除云端合并、`DockerEffectiveCookieResolver`、`EffectiveCookieMaterial`。
  - 保留/简化本地 helper；`hasPassportRecoveryMaterial` 删除，调用方改用 `hasLocalPassportCookie`。
- [ ] 3.3 `runtime-cookie-snapshot-store.ts`：删除 `persistEffectiveCookies`。
- [ ] 3.4 `runtime-cookie-source.ts`
  - 删除 cache/resolver 字段、`clearCookieCloudCache`、`hasCookieCloudSource`、`hasPassportRecoveryMaterial`、`getEffectiveCookies`、`persistEffectiveCookies`。
  - 简化 `inspectCookieSource` 与 `recoverCredentialSnapshot`。
- [ ] 3.5 删除 `runtime-cookie-cloud-sync.ts`、`runtime-cookie-cloud-cache.ts`。
- [ ] 3.6 `runtime.ts`：删除同步服务、清理 shutdown、`reconcileCookieCloudSync`、`clearCookieCloudCache`、app context 中两个方法。
- [ ] 3.7 `runtime-config-service.ts`：删除 CookieCloud 变更检测、两个依赖与文案。
- [ ] 3.8 `runtime-app-context.ts` / `server-types.ts`：删除 `getEffectiveCookies`、`persistEffectiveCookies`；`hasCookieSourcePayload` 只看 `loginCookies`。
- [ ] 3.9 `runtime-fans-sync.ts`：删除 `hasCookieCloudSource` 依赖、`mergeLatestCookieSnapshot` 与无用 helper。
- [ ] 3.10 `runtime-cookie-status.ts`：改用本地诊断，删除 `source`。
- [ ] 3.11 `runtime-notify.ts`：Cookie 数量行 detail 固定为本地来源说明。
- [ ] 3.12 `server-cookie-source-routes.ts`：删除 persist/effective 路由与 import。
- [ ] 3.13 `server-config-routes.ts`：删除 CookieCloud 校验、`cookieCloudConfigured`、cloud 分支。

验证：
- `npm run type-check:docker`
- `grep -rn -i "cookiecloud\|cookie_cloud\|cookie-cloud" src` 应只剩阶段 4 的 WebUI 文件。

## 阶段 4：WebUI

- [ ] 4.1 `resource-config.ts`：`CookieSourceConfig` 删除 `cookieCloud`，`hasCookieSourceConfigured` 简化。
- [ ] 4.2 `cookie-source-state.ts`：删除 `cookieCloud` reactive、cron preview、`getCookieCloudConfig`、`getCookieSourceLabel`。
- [ ] 4.3 `cookie-source-actions.ts`：删除 sync/save/toggle/disable CookieCloud 函数；`checkCookieSource` 直接请求诊断。
- [ ] 4.4 `cookie.ts`：删除 CookieCloud 解构、处理器与导出。
- [ ] 4.5 `components/LoginConfigPage.vue`：删除 CookieCloud 区块及 `EnableSwitch`/`CronField` 的 CookieCloud 用法。
- [ ] 4.6 文案批量替换：`resource-fans.ts`、`resource-yuba.ts`、`expiring.ts`、`keepalive.ts`、`double.ts`、`overview.ts`。
- [ ] 4.7 `styles/tables.css`：删除 `.cookie-cloud-actions`。

验证：
- `npm run type-check:webui`
- `grep -rn -i "cookiecloud\|cookie-cloud" src` 应为空。

## 阶段 5：测试

- [ ] 5.1 `test/config-guardrails-contract.test.js`
  - 更新键顺序与归一化断言；删除 CookieCloud 归一化/校验用例。
  - 更新部分更新用例。
  - 新增旧字段剥离用例（加载 + 保存）。
- [ ] 5.2 `test/server-route-guardrails-contract.test.js`
  - 更新初始配置、诊断 mock、overview 断言。
  - 删除 persist/effective 行为用例，新增 404 断言。
  - 删除 CookieCloud 密码泄露断言。
- [ ] 5.3 `test/douyu-passport-contract.test.js`
  - 删除三个 CookieCloud 用例与两个 persist 用例。
  - 更新 `createManualRecoveryDeps`。
  - 更新恢复用例名称与断言。

验证：`npm run test:contracts` 全绿。

## 阶段 6：文档与规格

- [ ] 6.1 `README.md` 删除功能表 CookieCloud 行。
- [ ] 6.2 `SECURITY.md`、`CONTRIBUTING.md`、`.github/ISSUE_TEMPLATE/bug_report.yml`、`feature_request.yml` 清理表述。
- [ ] 6.3 `CHANGELOG.md`：`Unreleased` 增加“移除 CookieCloud 同步功能；旧配置字段静默剥离”。
- [ ] 6.4 `.trellis/spec/backend/*`：清理 CookieCloud 架构、恢复、路由、日志、测试说明。
- [ ] 6.5 `.trellis/spec/frontend/*`：删除 CookieCloud sync/check 契约与 read routing 提及。

验证：
- `grep -rn -i "cookiecloud\|cookie_cloud\|cookie-cloud" .trellis/spec` 应为空。
- 人工复查 README/SECURITY/CONTRIBUTING 上下文语句通顺。

## 阶段 7：全量验证与收尾

- [ ] 7.1 `npm run lint`
- [ ] 7.2 `npm run type-check`
- [ ] 7.3 `npm run test:contracts`
- [ ] 7.4 `npm run build`（含 webui build + docker tsc）
- [ ] 7.5 最终 grep：
  - `grep -rn -i "cookiecloud\|cookie_cloud\|cookie-cloud" src test config.example.json README.md SECURITY.md CONTRIBUTING.md .github .trellis/spec`
  - 预期无输出。
- [ ] 7.6 人工核对 `git diff --stat`：只包含本任务相关文件；未误删 archive/CHANGELOG 历史。
- [ ] 7.7 任务归档前执行 Trellis 3.3 spec update 检查与 3.4 commit 流程。

## 回滚点

| 回滚点 | 条件 | 操作 |
| --- | --- | --- |
| 阶段 1 后 | 配置层设计需调整 | `git checkout -- src/core src/docker/config-* config.example.json` |
| 阶段 3 后 | recovery 契约无法在无 CookieCloud 下保持 | 回到 design §5.5 修订后重做 |
| 阶段 4 后 | WebUI 构建失败且短期无法收敛 | `git checkout -- src/docker/webui`，后端改动可保留待续 |

## 审查门禁

- 每个阶段结束必须通过对应 type-check。
- 阶段 5 结束时必须 `npm run test:contracts` 全绿。
- 阶段 7 必须四项全绿后才能提交。
- 提交前确认 `config/config.json`（gitignored）未被加入暂存区。
