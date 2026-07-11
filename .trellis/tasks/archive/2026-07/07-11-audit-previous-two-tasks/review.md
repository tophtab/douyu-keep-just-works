# Previous Two Tasks Audit

Date: 2026-07-11

## Executive Conclusion

- **第一次任务 `review-code-quality`：成功落地。** 获批的业务改动、Trellis 更新、任务归档和 journal 均存在于当前历史；提交历史重建没有丢失代码或任务工件。当前重新运行的全部质量门禁通过，未发现送礼、配置归一化或凭证恢复阶段化产生的可复现功能回退。
- **第二次任务 `review-code-optimization`：成功落地，存在一个低优先级边界瑕疵。** `did` 复用、配置保存助手、CI 门禁和 5 项行为测试均已落地；日志懒加载在“已登录、没有配置 Cookie 来源、直接进入 `/Logs`”时不会立即请求完整日志，但默认自动刷新或手动刷新可以恢复。
- 当前没有 P0/P1/P2 问题。存在 1 个 P3 WebUI 边界问题，以及若干不影响运行的测试/记录质量问题。

## Findings

### P3: 无 Cookie 来源时直达日志页不会立即加载完整日志

Introduced by: second task, commit `5db8f91`.

Evidence:

- `src/docker/webui/resource-state.ts:161-165` 在检查当前标签页前先因 `hasCookieSourceConfigured(config) === false` 返回。
- 日志分支位于 `src/docker/webui/resource-state.ts:176-178`，因此无 Cookie 来源时不可达。
- `loadProtectedData` 已从启动请求中删除 `loadLogs()`，见 `src/docker/webui/resource-state.ts:227-232`。
- `AppShell` 只在认证后通过 `v-if` 挂载；`useLogsPage` 的 watcher 没有 `immediate: true`，所以直达 `/Logs` 时不会观察到一次从未认证到已认证的变化。自动刷新最多约 5 秒后补救，手动刷新也可补救。
- 聚焦复现调用 `loadProtectedData('logs')` 且模拟无 Cookie 来源，实际请求仅为 `['/api/overview']`，没有 `/api/logs`。
- 当前契约明确要求直达 `/Logs` 在认证后加载日志，见 `.trellis/spec/frontend/contracts.md:72-75`。

Impact:

- 新部署、清空登录配置或凭证尚未填写时，用户最需要查看启动/配置日志，却会先看到“暂无日志”。
- 默认自动刷新开启时通常约 5 秒后恢复；关闭自动刷新或在首次间隔前观察时，需要手动刷新。因此不是永久不可用，但属于真实行为回退和误导性空状态。

Recommended follow-up:

- 让日志标签页判断先于 Cookie 来源 guard，或让日志页首次挂载时立即加载。
- 增加“无 Cookie 来源 + 直达 logs”回归测试。

### Accepted non-finding: 第一次任务退出旧配置迁移

Introduced by: first task, commit `2a5c9a1`; explicitly approved trade-off rather than accidental implementation drift.

Evidence:

- `src/core/config-normalization.ts:199-206` 只接受 `manualPassport.cookie`，不再转换 `manualPassport.ltp0`。
- `src/core/config-normalization.ts:221-228` 缺少 `doubleCard.enabled` 时统一归一化为 `false`，不再从 `send` 推断。
- `resolveWeight` 不再读取 `percentage`；旧权重输入会使用当前 fallback。
- 聚焦诊断对三个旧字段的结果为：`manualPassport` 被移除、旧 `percentage: 7` 变为权重 `1`、旧双倍卡房间变为未启用。
- `src/docker/runtime.ts:104-109` 启动时读取归一化配置后立即写回磁盘，因此旧字段在首次启动当前版本后会永久丢失。

Assessment:

- 已经运行过过渡版本并写回新格式的配置不受影响。
- 从更老版本直接跳到当前版本的用户理论上可能丢失 Passport 恢复材料、礼物权重或双倍卡勾选状态。
- 用户已明确当前不考虑这种跨旧版本升级场景，且近期版本的配置字段没有相关变化。在该产品和部署前提下，这不再作为当前问题或待修复项。

No follow-up is recommended under the confirmed deployment assumptions.

### P3: 第二次任务的日志测试遗漏了导致回归的条件

Evidence:

- `test/code-optimization-contract.test.js:102-150` 是真实模块级行为测试，但将 `hasCookieSourceConfigured` 固定为 `true`。
- 测试覆盖“overview 不提前加载日志、随后进入 logs 加载”，没有覆盖无 Cookie 来源或直达 `/Logs`。
- 因此 38 项测试全部通过仍无法检测上述 P3 边界回归。

Additional coverage gap:

- 当前 `saveConfigPatch` 测试覆盖请求、完整配置替换和返回 `fans`，见 `test/code-optimization-contract.test.js:152-184`。
- `.trellis/spec/frontend/contracts.md:151-156` 还要求任务保存/禁用流程、空 `fans` 权威性、未授权和错误路径；当前测试没有直接执行这些调用链。源码审查未发现现有实现错误，但规范声明的测试覆盖尚未完全落地。

### P3: 历史记录仍有一个旧提交号引用和较弱的提交原子性

Evidence:

- 第二次任务归档 `prd.md:10` 仍写“从上次应用提交 `2730aba`”，但第一次任务当前正式提交为 `2a5c9a1`。
- 第一次任务 journal 和 workspace index 已正确改为 `2a5c9a1`。
- `2a5c9a1` 同时包含应用改动、依赖锁、后端规范和一批 Trellis/平台工具更新。用户当时明确授权合并，但这使后续回滚、cherry-pick 和 bisect 难以只针对应用改动。

Impact:

- 不影响运行时，也不影响第一次任务内容完整性。
- 会降低历史审计清晰度；旧哈希仍是可解析的 unreachable Git 对象，因此不会妨碍本次核查。

## First Task Verification Matrix

| Approved item | Current evidence | Result |
|---|---|---|
| Remove final gift-send delay while preserving serial two-second spacing | `src/core/job-gift-utils.ts:70-105`; second task behavior test asserts send/sleep/send ordering | Passed |
| Fix production `form-data` advisory | `axios@1.16.0 -> form-data@4.0.6`; current production audit reports 0 vulnerabilities | Passed |
| Rename config ownership module | `src/core/config-normalization.ts` exists; `src/core/medal-sync.ts` is absent; no current import references remain | Passed |
| Retire exactly three legacy conversions | Current normalization ignores `percentage`, `manualPassport.ltp0`, and `send`-inferred selection while retaining top-level `cookie`, defaults and reconciliation | Passed; compatibility scope accepted |
| Split credential recovery into same-file stages | `runtime-cookie-recovery.ts` contains local, CookieCloud, Passport, Yuba and persistence stages; old/new control-flow comparison found no semantic drift | Passed |
| Preserve current tests and Docker runtime | Current lint, type checks, 38 tests and Docker build pass | Passed |
| Rebuild mistaken commit history without loss | `2730aba^{tree}` equals `2a5c9a1^{tree}`; `2ba2b95^{tree}` equals `4581439^{tree}`; journal diff only replaces old hash plus newline normalization | Passed |

### First task residual test risk

Existing credential tests cover manual Passport main+Yuba success, Yuba failure after main recovery, CookieCloud device material, and missing `dy_did`. They do not exhaustively differential-test every local-valid/CookieCloud-valid/reason-text branch. Source comparison and current tests found no regression, so this is residual confidence risk rather than a known defect.

## Second Task Verification Matrix

| Approved item | Current evidence | Result |
|---|---|---|
| Task-local room DID reuse | Shared resolver created once per multi-gift task; only fulfilled values cached; send remains serial | Passed |
| Lazy full-log loading | Normal credentialed tab-switch path works; no-credential direct route misses the immediate request but recovers by refresh | Passed with minor edge issue |
| Centralized config mutation and full snapshot application | `resource-config.ts:63-77`; task, Cookie and theme flows use the helper; dependency direction is one-way | Passed, coverage incomplete |
| CI contract-test gate | `.github/workflows/docker.yml:8-33,67-77` includes test/lint paths and runs contract tests before Docker build | Passed |
| Five focused behavior tests | All five execute modules and pass; one condition gap permits the logs regression | Passed with gap |

## Current Verification Results

- `npm run lint`: passed.
- `npm run type-check`: passed for Docker TypeScript and Vue WebUI.
- `npm run test:contracts`: 38 passed, 0 failed.
- `npm run build:docker`: passed.
- WebUI output: JavaScript 154.08 kB / 51.41 kB gzip; CSS 20.62 kB / 4.93 kB gzip.
- `npm audit --omit=dev --audit-level=moderate`: passed, 0 vulnerabilities.
- `git diff --check` for both task change ranges: passed.
- Both task work commits remain ancestors of current `HEAD`.

## History Integrity Details

- Old first work commit `2730aba` and replacement `2a5c9a1` have the same tree: `384766c93c0d2ef51660896cb199a030d6987af7`.
- Old archive commit `2ba2b95` and replacement `4581439` have the same tree: `9f177624c7021ddb876e92aa5b51c72f76e24b33`.
- The old commits remain available as unreachable objects and in reflog, allowing direct verification.
- Journal replacement intentionally changed `2730aba` to `2a5c9a1`; no task summary content was lost.

## Final Assessment

The first task was implemented and landed successfully. Its commit-history repair was also successful at the content level. Under the user's confirmed upgrade assumptions, the retired legacy config conversions are intentional scope rather than a current defect.

The second task also landed successfully overall. The no-credential direct-log case is a low-priority edge issue and a test gap, not evidence that the task's main optimization work failed. No evidence indicates that the second task broke the first task's credential recovery, config normalization, dependency fix, or gift-send behavior.
