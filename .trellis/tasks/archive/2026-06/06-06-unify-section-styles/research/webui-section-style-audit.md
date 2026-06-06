# WebUI Section Style Audit

## Summary

The section style can be reused. The current WebUI already reuses the status-card layer (`TaskStatusCard`) and allocation-table layer (`AllocationTable`), but it does not reuse the middle page-section/layout layer. That missing layer causes similar pages to drift through inline margins, slightly different heading structures, and inconsistent switch placement.

## Existing Reuse

- `src/docker/webui/components/TaskStatusCard.vue` provides the shared "任务状态" card used by login and scheduled task pages.
- `src/docker/webui/components/AllocationTable.vue` provides the shared allocation table used by keepalive, double, and expiring pages.
- `src/docker/webui/components/ActionBar.vue`, `CronField.vue`, and `EnableSwitch.vue` already provide shared controls.
- `src/docker/webui/styles/components.css` defines global primitives such as `.panel`, `.panel-head`, `.section-title`, `.section-kicker`, `.grid`, `.actions`, `.status-box`, and `.task-section`.

## Drift Points

- `CollectPage.vue` uses `TaskStatusCard` with inline `style="margin-bottom:16px"`, then a plain `.panel` with `.panel-head`, a manually written `<h3 class="section-title" style="margin-top:0">`, and an `EnableSwitch` without `title`.
- `KeepalivePage.vue`, `DoublePage.vue`, `ExpiringPage.vue`, and `YubaPage.vue` use `TaskStatusCard` followed by `<div class="panel" style="margin-top:16px">`, then an `EnableSwitch` with `title`. This makes the switch title come from `.switch-title` instead of `.section-title`.
- Repeated inline `style="margin-top:16px"` appears around task panels, table wrappers, overview content, login panels, and log panels. This hard-codes spacing at call sites instead of expressing section rhythm once.
- `OverviewPage.vue` manually writes a status panel that resembles `TaskStatusCard`, but uses `.panel + .section-kicker + .section-title + .summary-grid + .strip-metric`, so it visually resembles task cards without sharing the component.
- `OverviewPage.vue` adds a separate `status-box` before the fans table when `overviewFansFeedbackText` is present. That creates a one-off annotation surface above the fan badge list.

## User-Visible Effects

- "领取任务" and "保活任务" do not align because one page uses `.panel-head` plus `.section-title`, while the other uses `EnableSwitch`'s internal `.switch-title`.
- "保活任务", "双倍任务", "临期任务", and "鱼吧签到" are already close enough to share a task settings section component.
- "概况" and "粉丝牌列表" can share a generic panel/section wrapper so heading typography and content spacing are consistent.
- The overview fan badge annotation is likely unnecessary as a permanent standalone block. Errors can stay in empty/status states, but the normal table should not receive a unique note above it unless there is actionable failure text.

## Recommended Reuse Strategy

1. Add a small reusable section wrapper component, for example `PageSection.vue`, that owns:
   - `.panel`
   - optional kicker/title
   - optional header action slot
   - consistent body spacing
2. Add a task settings wrapper component, for example `TaskSettingsPanel.vue`, or use `PageSection.vue` with slots, to standardize:
   - status-card-to-panel gap
   - switch title placement
   - form grid spacing
   - action bar spacing
   - table/status block spacing
3. Replace inline margin styles with semantic classes such as:
   - `.page-stack`
   - `.section-body`
   - `.section-block`
   - `.section-actions`
4. Update `CollectPage.vue` first so "领取任务" follows the same switch/header pattern as the scheduled task pages.
5. Update `OverviewPage.vue` to use the same section wrapper and remove or downgrade the standalone fans feedback `status-box` unless it contains an actionable error.

## Minimum Implementation Scope

- New shared section component under `src/docker/webui/components/`.
- Small CSS additions in `src/docker/webui/styles/components.css`.
- Refactor `CollectPage.vue`, `KeepalivePage.vue`, `DoublePage.vue`, `ExpiringPage.vue`, `YubaPage.vue`, and `OverviewPage.vue`.
- Optional follow-up: apply the same wrapper to `LoginConfigPage.vue` and `LogsPage.vue` after task pages are consistent.

## Relevant Specs

- `.trellis/spec/frontend/directory-structure.md`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/guides/code-reuse-thinking-guide.md`
