# brainstorm: 合并 passport cookie 到登录 Cookie 面板

## Goal

调整 Docker WebUI 登录页的信息架构，把手填 passport Cookie 放回“登录 Cookie”面板中，和斗鱼直播、斗鱼鱼吧 Cookie 并列展示，避免独立面板造成“多拎出一栏”的视觉和理解偏差。

## What I already know

* 用户明确指出 passport Cookie 不应该单独成栏，应属于“登录 Cookie”。
* 当前页面已有斗鱼直播和斗鱼鱼吧两个 Cookie 输入，需要扩展为三栏。
* 当前实现把 passport Cookie 做成独立 panel，并有单独保存按钮。
* 后端 `/api/config` 已支持同一次保存 `manualCookies` 和 `manualPassport`。
* `/api/config` 响应会 mask manual passport cookie，因此前端保存后需要保留用户刚输入的原始 passport 值。

## Assumptions (temporary)

* 本任务只调整手填登录 Cookie 区域，不改 CookieCloud 行为。
* 用户希望保存手填 Cookie 时一起保存三份手填 Cookie，而不是保留独立 passport 保存按钮。
* 不改后端配置模型和运行时恢复逻辑。

## Open Questions

* 无阻塞问题；用户已确认开始修改。

## Requirements (evolving)

* “登录 Cookie”面板中展示三项输入：斗鱼直播 Cookie、斗鱼鱼吧 Cookie、passport.douyu.com Cookie。
* 删除独立的“手填 passport Cookie”面板。
* “保存手填 Cookie”一次保存 `manualCookies` 和 `manualPassport`。
* 保存后不要把接口返回的 masked passport Cookie 写回输入框。
* 保留登录状态卡中的 passport Cookie 配置状态展示。
* 更新相关 contract test，避免继续要求独立 passport 保存动作。

## Acceptance Criteria (evolving)

* [x] LoginConfigPage 中没有独立“手填 passport Cookie”panel。
* [x] 登录 Cookie 区域有三列/三项输入。
* [x] 保存手填 Cookie 请求体包含 main、yuba、manualPassport.cookie。
* [x] 保存后 passport 输入框保留未 mask 的当前值。
* [x] 相关 lint/typecheck/contract test 通过。

## Definition of Done (team quality bar)

* Tests added/updated where implementation changes occur.
* Lint / typecheck / CI green when code is changed.
* Docs/notes updated if behavior or architecture guidance changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* 不修改 CookieCloud 同步逻辑。
* 不修改 safeAuth/passport 恢复逻辑。
* 不做登录页大规模视觉重设计。

## Technical Notes

* Primary UI file: `src/docker/webui/components/LoginConfigPage.vue`.
* Page state/save logic: `src/docker/webui/cookie.ts`.
* Existing contract coverage: `test/project-maintenance-contract.test.js`.
* Relevant specs: `.trellis/spec/frontend/*`, shared thinking guide index.

## Verification

* `npm run lint` passed.
* `npm run type-check:webui` passed.
* `node --test test/project-maintenance-contract.test.js` passed.
* `npm run build:webui` passed.
* `npm run type-check` passed.
* Playwright layout probe confirmed desktop three-column login cookie inputs and mobile single-column stacking.
