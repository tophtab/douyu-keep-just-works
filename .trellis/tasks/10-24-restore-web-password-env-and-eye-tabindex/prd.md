# 恢复 WEB_PASSWORD 兜底并修复密码眼睛按钮 Tab 焦点

## Context

- 3.12.0（提交 `cdc0f09`）删除了 `WEB_PASSWORD` 环境变量，`src/docker/runtime.ts` 不再向 `WebPasswordStore` 传 `initialPassword`。
- 升级用户的 `.env` / compose 密码因此失效，`WebPasswordStore` 回落到内置默认值 `password`（`src/docker/auth-password.ts`）。
- `SecurityPage.vue` 的三个密码框把眼睛按钮放在输入框之后，Tab 从密码框出发会停在「显示当前密码明文」按钮上，打断输入流。
- 眼睛按钮获得焦点不会切换明文，只有 Enter / 空格 / 点击才切换；问题在焦点顺序。

## Goal

恢复 `WEB_PASSWORD` 作为 `config/auth.json` 之后的兜底密码来源，并让密码框的眼睛按钮不再占用 Tab 焦点。

## Requirements

- **R1 — 恢复环境变量兜底。** `WebPasswordStore` 验证优先级恢复为：`config/auth.json` > `WEB_PASSWORD` 环境变量 > 内置默认值 `password`。界面改过密码后仍以 `auth.json` 为准，环境变量不再生效。
- **R2 — 环境变量来源在 UI 中可识别。**「账号安全」页密码来源文案需要区分「初始密码 / 非初始密码」之外的来源：环境变量密码应显示为已自定义（非默认），且「当前密码」校验走环境变量值。
- **R3 — 眼睛按钮跳过 Tab。** 登录页与账号安全页所有密码明文切换按钮加 `tabindex="-1"`，Tab 从密码框直接进入下一个可输入控件；鼠标 / 触屏点击仍能切换。接受纯键盘用户无法切换明文的代价。
- **R4 — 不持久化明文显示状态。** 登录页不再用 `localStorage` 记住「显示明文」偏好；每次进入登录页、登录成功后都默认隐藏。账号安全页保持现有「刷新即隐藏」行为。
- **R5 — 图标语义保持一致。** 保持现有动作语义：隐藏时显示睁眼（点击显示），显示时显示划线眼（点击隐藏）；通过 `title` / `aria-label` 明确表达动作，不因焦点变化自动切换。
- **R6 — 文档同步。** 更新 CHANGELOG（修复条目）与 README / compose 示例中关于 `WEB_PASSWORD` 的说明，避免再次误导升级用户。

## Non-goals

- 不引入密码字段加密、Vault、密钥管理等新机制。
- 不改变 `auth.json` 的存储格式、scrypt 参数与 0600 权限。
- 不调整登录失败限流、会话有效期。

## Acceptance Criteria

- [ ] 设置 `WEB_PASSWORD=secret123` 且无 `config/auth.json` 时，登录 `secret123` 成功，`password` 失败。
- [ ] 存在 `config/auth.json` 时，其密码优先于 `WEB_PASSWORD`。
- [ ] 删除 `auth.json` 且未设置 `WEB_PASSWORD` 时，回落到默认 `password`。
- [ ] 账号安全页密码来源对 `WEB_PASSWORD` 显示为非默认（「正常」），默认值才显示「默认密码」。
- [ ] 登录页 / 账号安全页按 Tab 不再停在眼睛按钮；眼睛按钮仍可通过鼠标点击切换明文。
- [ ] 登录页明文显示状态不再跨刷新 / 跨会话保留，每次进入默认隐藏。
- [ ] `npm run lint`、`npm run type-check`、`npm run test:contracts`、`npm run build:docker` 通过。
- [ ] CHANGELOG、README 与 compose 示例对 `WEB_PASSWORD` 的描述一致。

## Constraints

- 环境变量密码只作为兜底：一旦用户通过 WebUI 改过密码，`auth.json` 必须优先，避免环境变量悄悄覆盖用户设置。
- 环境变量未设置或为空时不得被视为密码来源。
- 不把明文密码写入日志、磁盘或 API 响应。
