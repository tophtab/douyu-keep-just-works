# 通用表格空态组件收敛

## Goal

把已经抽出的 `TableSection` 作为唯一的通用“表格或空态”容器，删除旧的 `TaskTableSection` 包装组件和相关规范残留，避免两个同义组件长期并存。

## What I Already Know

* 用户确认方向：承认这是通用组件，改名/抽出成 `TableSection`。
* 当前概况页已经使用 `TableSection`。
* 任务页仍在使用 `TaskTableSection`，而 `TaskTableSection` 只是包装 `TableSection`。
* 前端规范和维护契约测试需要同步更新，避免旧组件名称继续作为推荐模式。

## Requirements

* 所有 `TaskTableSection` 使用点改为 `TableSection`。
* 删除 `src/docker/webui/components/TaskTableSection.vue`。
* 更新前端组件规范，把可选表格空态容器描述为 `TableSection`。
* 更新维护契约测试，断言任务页和概况页使用通用 `TableSection`。
* 不改变 UI 结构、文案、后端接口或数据加载逻辑。

## Acceptance Criteria

* [ ] 代码库中没有 `TaskTableSection` 引用或文件。
* [ ] 任务页和概况页都使用 `TableSection`。
* [ ] `TableSection` 仍渲染 `section-block`、`empty`、`table-shell` 结构。
* [ ] 前端规范不再推荐 `TaskTableSection`。
* [ ] lint、contract tests、Docker build 通过。

## Definition Of Done

* 工作提交完成。
* Trellis session 记录完成。
* 代码推送到当前分支。

## Out Of Scope

* 重新设计表格样式。
* 修改空态文案。
* 改动后端 API 或任务逻辑。

## Technical Notes

* Relevant files:
  * `src/docker/webui/components/TableSection.vue`
  * `src/docker/webui/components/*Page.vue`
  * `.trellis/spec/frontend/component-guidelines.md`
  * `test/project-maintenance-contract.test.js`
