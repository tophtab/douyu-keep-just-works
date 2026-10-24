# 统一推送设置与密码设置页样式并修正文案

## Context

- 全站样式是 `src/docker/webui/styles/` 下的全局 CSS（`main.ts` 引入），规范要求「不要新增组件级 scoped 样式」（`.trellis/spec/frontend/directory-structure.md`）。
- `src/docker/webui` 中只有 3 个组件带 `<style scoped>`，其中两个是本次目标页：`PushSettingsPage.vue`、`SecurityPage.vue`（另一个是 `LogsPage.vue`，不在本次范围）。
- `SecurityPage.vue` 的密码强度 / 不一致提示使用硬编码颜色 `#ff6b6b` / `#ffb454` / `#3ddc84`，既未使用 `--danger` / `--warning` / `--success` 令牌，也不随亮色 / 暗色主题变化。
- `SecurityPage.vue` 的 `.field-with-eye` 与全局 `.auth-input-wrap`（`styles/shell.css`）逐条重复。
- 两页的 scoped 块还重复覆盖了全局已处理的 `.field-block` 间距，并用 `gap:14px` 偏离全局 16px 节奏。
- 文案不一致：导航与页面标题仍叫「账号安全」；状态卡缺少 kicker，账号安全状态卡标题为「登录密码」，与「任务状态 / 双倍」「登录状态 / 登录」的结构不统一。
- 推送页 `Endpoint 令牌` 是 `type="password"`，但比其他密码框少一个明文切换按钮。

## Goal

让「推送设置」和「密码设置」两页完全使用全局样式体系与设计令牌，并统一状态卡结构、文案和密码框交互。

## Requirements

- **R1 — 移除组件级 scoped 样式。** 删除 `PushSettingsPage.vue`、`SecurityPage.vue` 的 `<style scoped>` 块。
- **R2 — 颜色走设计令牌。** 密码强度与两次输入不一致提示改用 `--danger` / `--warning` / `--success`；亮色 / 暗色主题下均正确跟随。
- **R3 — 复用全局类。** 用全局 `.auth-input-wrap` 替代重复定义的 `.field-with-eye`；布局使用全局 `.grid` / `.section-body` 的 16px 间距，不再用局部 `gap:14px` 与冗余的 `.field-block{margin-bottom:0}`。
- **R4 — 状态卡结构统一。** 推送状态卡 kicker 为「推送状态」、标题保持「推送」；密码状态卡 kicker 为「密码状态」、标题由「登录密码」改为「密码」。
- **R5 — 文案重命名。** 导航项与页面标题「账号安全」→「密码设置」；README 中对应称呼同步修改。CHANGELOG 历史条目与归档任务不改写。
- **R6 — 推送令牌可切换明文。** `Endpoint 令牌` 输入框增加与登录页 / 密码页一致的明文切换按钮（`tabindex="-1"`、`aria-pressed`、`title` / `aria-label` 随状态变化）。
- **R7 — 消除动作行重复。** 扩展 `ActionBar.vue` 支持按钮 `disabled`，推送页两组操作改用 `ActionBar`；密码页保留原生 `type="submit"` 按钮（回车提交语义），继续使用全局 `.actions` / `.btn`。
- **R8 — 密码切换按钮复用。** 抽出共享的密码明文切换按钮组件，供登录页、密码页 3 个密码框与推送令牌框共用，避免第 4 次复制 SVG 模板。
- **R9 — 定时选择器时间输入框统一宽度。** 「时 / 分 / 秒」三个输入框使用固定宽度 100px（与「时（多个用,分隔）」标签文字等长），不再按列拉伸；弹层宽度改为贴合内容，左右 padding 对称；窄屏（≤480px）下只保留「时」宽，分 / 秒等分剩余空间。
- **R10 — 清掉最后一个 scoped 样式块。** 将 `LogsPage.vue` 的 `.logs-refresh-toggle` 规则移入 `styles/components.css`，删除该组件的 `<style scoped>`，使全站不再有组件级样式。

## Non-goals

- 不改 `LogsPage.vue` 的 scoped 样式。
- 不改变页面路由（`/Configurations/SecurityConfig`）与 `security` tab key。
- 不调整密码校验、强度算法、接口或存储。
- 不重写历史 CHANGELOG / 归档任务文档。
- 不做视觉改版之外的布局重构。

## Acceptance Criteria

- [x] `PushSettingsPage.vue`、`SecurityPage.vue` 不再包含 `<style scoped>`。
- [x] `SecurityPage.vue` 不再出现硬编码十六进制颜色；强度「弱 / 中 / 强」与不一致提示在亮色、暗色主题下分别使用 `--danger` / `--warning` / `--success`。
- [x] 两页的表单间距与其他设置页一致（全局 16px），无重复间距覆盖规则。
- [x] 推送状态卡显示 kicker「推送状态」+ 标题「推送」；密码状态卡显示 kicker「密码状态」+ 标题「密码」。
- [x] 侧边栏与页面标题显示「密码设置」；README 同步；路由不变。
- [x] 推送页令牌框的眼睛按钮与登录页行为一致（图标、提示、aria、跳过 Tab）。
- [x] 推送页操作按钮仍显示加载中文案并在请求期间禁用；窄屏（≤560px）按钮占满整行。
- [x] 定时选择器中「时」「分」「秒」三个输入框均为 100px（实测 100px / 100px / 100px），与标签文字等长；窄屏下不溢出。
- [x] `src/docker/webui` 下不再有任何 `<style scoped>`；运行日志页的圆形刷新按钮仍为 38×38、图标 18×18。
- [x] Cron 表达式输入框保持原有整行宽度，未做收窄。
- [x] `npm run lint`、`npm run type-check`、`npm run test:contracts`、`npm run build:docker` 通过。
