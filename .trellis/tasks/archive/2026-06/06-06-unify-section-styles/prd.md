# Unify WebUI Section Styles

## Goal

Research whether the Docker WebUI page section styles can be unified and reused across pages, then define a focused refactor path if the existing code supports it. The visible target is a more consistent presentation for task pages and overview panels.

## What I Already Know

- The user sees inconsistent typography, spacing, and section presentation across pages.
- The user specifically expects "保活任务", "双倍任务", and "临期任务" to share similar or identical section styles.
- The user wants the same reusable style pattern to apply to related places such as "领取任务", "概况", and other blue-link/blue-label areas.
- The user called out inconsistent spacing between "领取任务" and "保活任务".
- The user noticed an unnecessary one-off annotation in the overview page fan badge list.
- The maintained frontend is the Vue/Vite Docker WebUI under `src/docker/webui/`.

## Assumptions

- This task is about visual consistency and reuse, not changing task behavior.
- The right first step is to inspect current Vue components and CSS before deciding whether to extract shared components, shared classes, or both.
- The Chinese label "保护任务" in the user message likely refers to "保活任务".
- Implementation will happen in the current worktree. Backend parallel work is expected to happen in a separate worktree owned by that task.

## Requirements

- Identify where task page and overview section styles are defined.
- Determine whether repeated section patterns can be extracted for reuse.
- Compare the styles for "领取任务", "保活任务", "双倍任务", "临期任务", and "概况".
- Identify obvious one-off content/style inconsistencies, including the overview fan badge annotation.
- Prefer a reuse approach that matches the existing Vue component and CSS organization.
- Remove redundant one-off markup, inline spacing styles, and CSS hooks after introducing shared section wrappers.
- Keep the refactor visual-only: shared structure and copy cleanup should not change task behavior.
- Implementation scope now covers all authenticated WebUI pages: "领取任务", "保活任务", "双倍任务", "临期任务", "鱼吧签到", "概况/粉丝牌列表", "登录/CookieCloud", and "运行日志".
- Use the task pages ("领取任务", "保活任务", and "双倍任务") as the visual standard for section title size, spacing, and rhythm.
- Remove unnecessary section descriptors such as the "粉丝牌" kicker above the overview fan badge list.
- Ensure helper sections such as double-task "分配说明" use the same title scale as task switches instead of a separate small-caption style.
- Show the double-task status card room count as selected/total rooms once the double-task fan rows are loaded, based on the current "参与" checkbox state.

## Proposed Implementation Plan

1. Introduce a shared page section component that owns panel shell, optional kicker/title, optional header action slot, and consistent content spacing.
2. Introduce or compose a task settings section pattern for scheduled task pages: status card, settings panel, switch, form grid, action bar, optional helper/status block, and optional table/empty block.
3. Refactor "领取任务" first because it is the most visibly divergent from the other task pages.
4. Refactor "保活任务", "双倍任务", "临期任务", and "鱼吧签到" to use the same settings section rhythm and remove their repeated inline `margin-top:16px` wrappers.
5. Refactor "概况" and "粉丝牌列表" onto the same generic section wrapper; remove the standalone fan badge annotation block unless it is an actionable error/feedback state.
6. Refactor "登录/CookieCloud" and "运行日志" onto the same section wrapper after the task/overview pattern is stable.
7. Clean up obsolete CSS/classes and inline styles once call sites no longer use them.
8. Run lint, type-check, and a WebUI build; use browser screenshots to compare the main pages at desktop and mobile widths.

## Acceptance Criteria

- [x] The impacted components and CSS files are identified.
- [x] The current duplication and divergence points are summarized.
- [x] A concrete reuse strategy is recommended.
- [x] Any implementation proposal stays visual-only unless separately approved.

## Out of Scope

- Backend/API behavior changes.
- Changing task scheduling or fan badge business logic.
- Large redesign of navigation or page layout.

## Technical Notes

- Frontend spec index: `.trellis/spec/frontend/index.md`
- Code reuse guide: `.trellis/spec/guides/code-reuse-thinking-guide.md`
- Research artifact: `.trellis/tasks/06-06-unify-section-styles/research/webui-section-style-audit.md`
