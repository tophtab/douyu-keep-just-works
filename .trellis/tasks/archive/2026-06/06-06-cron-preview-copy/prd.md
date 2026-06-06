# 调整 cron 预览和项目文案

## Goal

调整 Docker WebUI 中 cron 表达式下方的未来执行时间提示和侧边栏项目描述，删除成功状态的未来三次执行时间列表，并按用户指定拆分/精简项目文案。

## What I already know

* 用户最终决定删除所有 cron 表达式下方的 `未来三次：...` 成功预览。
* 当前 `.cron-preview` 使用 `white-space: nowrap` 和 `overflow-x: auto`，会导致长内容显示成截图 1 的横向滚动条。
* 用户希望 `基于Curtion/douyu-keep vibe coding` 另起一行。
* 用户希望 `斗鱼自动赠送荧光棒续粉丝牌|检测双倍|鱼吧签到，docker版，` 改成 `斗鱼自动赠送荧光棒续粉丝牌|检测双倍|鱼吧签到`。
* cron 预览文案来自 `src/docker/webui/composables/use-cron-preview.ts`，组件显示来自 `src/docker/webui/components/CronField.vue`。
* 侧边栏描述来自 `src/docker/webui/components/SidebarNav.vue`。

## Assumptions

* 删除已生成的 `未来三次：...` 成功预览，同时删除空值和加载中的辅助提示；保留错误提示。
* 不修改 `/api/cron-preview` 后端接口和 cron 计算逻辑。
* 侧边栏描述只做文案和换行调整，不重做整体导航样式。

## Requirements

* cron 字段只在校验失败等有实际问题时显示辅助提示。
* 成功获取未来执行时间后，不再显示 `未来三次：...` 日期列表。
* 空成功文案不渲染 helper 状态行。
* 侧边栏主描述显示为 `斗鱼自动赠送荧光棒续粉丝牌|检测双倍|鱼吧签到`。
* `基于Curtion/douyu-keep vibe coding` 在侧边栏描述中单独另起一行。

## Acceptance Criteria

* [ ] WebUI 源码中不再返回或渲染 `未来三次：${...}` 日期列表。
* [ ] 空 cron 和加载中的 cron 不显示 helper 文案。
* [ ] cron 成功校验后不显示空 helper 占位行。
* [ ] `.cron-preview` 不再因默认样式强制 `nowrap` + 横向滚动。
* [ ] 侧边栏文案不再包含 `docker版`。
* [ ] 侧边栏 `基于Curtion/douyu-keep vibe coding` 单独成行。
* [ ] lint 和 type-check 通过，或记录无法运行的原因。

## Definition of Done

* WebUI 文案/样式修改完成。
* 相关契约测试按需更新。
* lint / type-check 通过。

## Out of Scope

* 调整 cron 表达式默认值。
* 改动 Docker 后端任务调度逻辑。
* 重设计整个侧边栏或页面主题。

## Technical Notes

* `src/docker/webui/composables/use-cron-preview.ts` 当前在成功状态返回 `未来三次：...`，本任务改为空文本。
* `src/docker/webui/styles/components.css` 当前 `.cron-preview` 使用 `overflow-x:auto` 和 `white-space:nowrap`。
* `src/docker/webui/components/SidebarNav.vue` 当前把描述、`docker版` 和致谢来源合并在一个段落中。
