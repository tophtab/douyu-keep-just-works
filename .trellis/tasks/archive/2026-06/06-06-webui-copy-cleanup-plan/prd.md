# Plan WebUI copy cleanup

## Goal

Clean up Docker WebUI Chinese copy and task-page layout so task controls use a consistent "某某任务开关" naming pattern, low-value explanatory subtitles/descriptions are removed from the visible interface, Cron preview/action spacing is consistent, and the double-task allocation explanation block is restored.

## What I Already Know

- Fish-bar check-in switch copy should become "鱼吧任务开关".
- The user wants "启动领取任务" changed to "领取任务开关".
- The user wants similar controls such as "双倍任务", "保活任务", and "领取任务" to follow the "某某任务开关" format.
- The user does not want explanatory page subtitles like:
  - "先看基础状态，再确认当前粉丝牌列表。"
  - "管理登录状态、手填 Cookie 和 CookieCloud 同步。"
  - "查看领取任务状态，并维护领取任务的启停和调度。"
  - "查看保活状态，并维护随粉丝牌同步的房间配置。"
- The user also reported two layout issues from a screenshot:
  - Some task pages have an unwanted blank gap between the Cron preview text and the action buttons. "领取任务" looks correct; "双倍" and "临期" show the issue.
  - The "未来三次" Cron preview wraps onto multiple lines on "双倍" and "临期"; the user wants the preview to stay on one long line like the cleaner task pages.
- The user clarified that spacing must be unified across task/settings pages, not just locally reduced where it looks wrong.
- The user restored a screenshot of the old double-task UI and wants the double allocation explanation area brought back:
  - Show the "分配说明" heading.
  - Show the explanatory text and current weight/percentage preview.
  - Keep the two preset actions next to the explanation, but stack them vertically as one column instead of right-aligning them in one row.
  - Rename "参与房间全部设为 1" to "平均权重".
  - Rename "按粉丝牌等级填入" to "等级权重".
- Sidebar description should use the GitHub repository description, replacing the current vague local description:
  - "斗鱼自动赠送荧光棒续粉丝牌|检测双倍|鱼吧签到，docker版，基于Curtion/douyu-keep vibe coding"
- UI-facing double-card task copy should be "双倍任务", not "双倍卡任务".
- The user asked for planning only. Do not implement code changes until the user explicitly says work can start.

## Confirmation Status

### Confirmed By User

- Static task switch labels should follow the "某某任务开关" naming pattern.
- "启动领取任务" should become "领取任务开关".
- Fish-bar check-in switch label should be "鱼吧任务开关".
- Generic page subtitle/description lines like "先看基础状态，再确认当前粉丝牌列表。" should not be visible.
- Sidebar description should use the GitHub repository description:
  - "斗鱼自动赠送荧光棒续粉丝牌|检测双倍|鱼吧签到，docker版，基于Curtion/douyu-keep vibe coding"
- Double/expiring Cron preview text for "未来三次" should stay on one visual line instead of wrapping.
- Task/settings page spacing must be unified, not adjusted page-by-page by eye.
- Double-task "分配说明" block should be restored from the old UI pattern.
- Double-task preset buttons should be placed as a vertical one-column stack beside the explanation block.
- Double-task preset button labels are finalized as "平均权重" and "等级权重".
- UI-facing double-card task copy should use "双倍任务" / "双倍任务未配置", not "双倍卡任务" / "双倍卡任务未配置".

### Explicit Non-Goals

- Toast wording is not changed in this pass.
  - Toast messages are operation result messages such as "双倍任务已保存并启用" or "停用双倍任务失败：..."。
  - If toast text is discussed in a later task, refer to it as "toast 操作结果文案".

## Repository Findings

- Page subtitle copy is centralized in `src/docker/webui/navigation.ts`.
- The subtitles are rendered by `src/docker/webui/components/AppShell.vue`.
- Sidebar brand explanatory copy is in `src/docker/webui/components/SidebarNav.vue`.
- Static enable switch labels/titles are in:
  - `src/docker/webui/components/CollectPage.vue`
  - `src/docker/webui/components/KeepalivePage.vue`
  - `src/docker/webui/components/DoublePage.vue`
  - `src/docker/webui/components/ExpiringPage.vue`
  - `src/docker/webui/components/YubaPage.vue`
- Save/disable operation feedback strings are in:
  - `src/docker/webui/collect.ts`
  - `src/docker/webui/keepalive.ts`
  - `src/docker/webui/double.ts`
  - `src/docker/webui/expiring.ts`
  - `src/docker/webui/yuba.ts`
- Backend task metadata includes user-facing task names in `src/docker/task-metadata.ts`, including a current mismatch: `doubleCard` is "双倍卡任务" there but "双倍任务" in WebUI navigation.
- Core runtime logs and errors in `src/core/**` also contain task names, but they are operational messages, not the main page copy the user complained about.
- Cron preview rendering is shared by `src/docker/webui/components/CronField.vue`.
- Cron preview styling is currently in `src/docker/webui/styles/components.css` under `.helper` and `.cron-preview`.
- The action button row is shared by `src/docker/webui/components/ActionBar.vue`, with `.actions` styles in `src/docker/webui/styles/components.css`.
- `DoublePage.vue` and `ExpiringPage.vue` place Cron fields inside `.grid.cols-3`, which gives the preview less horizontal room than the two-column pages and makes the long "未来三次" text more likely to wrap.
- `KeepalivePage.vue`, `DoublePage.vue`, `ExpiringPage.vue`, and `YubaPage.vue` add inline `margin-top:16px` to `ActionBar`; `CollectPage.vue` does not. This is the direct cause of the spacing inconsistency compared with the collect page.
- `v3.2.0` had a double-task explanation block in `src/docker/webui/components/DoublePage.vue`:
  - A `status-box` under the action buttons.
  - A "分配说明" kicker.
  - `doubleModeHelp` explanatory copy.
  - `doubleRatioPreview` showing current weights and calculated percentages.
  - The two preset buttons next to the explanation.
- Current `DoublePage.vue` still has the two preset buttons, but the explanation block, `doubleModeHelp`, `doubleRatioPreview`, and related split layout are gone.
- Current `src/docker/webui/double.ts` also no longer exports the old computed values needed by that block, including `doubleModeHelp` and `doubleRatioPreview`.
- Current `src/docker/webui/allocation-task.ts` no longer exports `formatRatioPercent`, which the old percentage preview used.

## Layout Issue Diagnosis

### Issue 1: Blank gap above action buttons

Cause:
- The task pages do not use one consistent vertical spacing pattern.
- `CollectPage.vue` places `ActionBar` directly after `CronField` without an extra inline top margin.
- `KeepalivePage.vue`, `DoublePage.vue`, `ExpiringPage.vue`, and `YubaPage.vue` add `style="margin-top:16px"` on `ActionBar`.
- `CronField.vue` already gives the preview line its own spacing with `.cron-preview { margin-top:8px; }`. Adding another page-level `ActionBar` top margin creates the larger blank band between the preview text and buttons.

Decision:
- Define one shared vertical spacing pattern for task/settings panels.
- Remove ad hoc inline spacing from individual task pages where possible.
- Treat the collect page as the visual baseline for the gap between Cron preview and action buttons.
- If a page needs vertical separation for a distinct block, use a shared class/rule rather than per-page inline `margin-top`.

### Issue 2: "未来三次" preview wraps on double and expiring

Cause:
- `CronField.vue` renders preview text as normal inline text inside `.helper.cron-preview`.
- `.helper` allows normal text wrapping.
- `DoublePage.vue` and `ExpiringPage.vue` put the Cron field in `.grid.cols-3`, so the Cron preview only gets one third of the row width on desktop.
- The preview value is long: "未来三次：2026/06/06 17:21 / 2026/06/06 20:21 / 2026/06/06 22:21". In a one-third-width grid cell, normal wrapping breaks it onto multiple lines.

Decision:
- Keep Cron preview text single-line on desktop/tablet.
- The direct style fix is to set the preview to `white-space: nowrap`.
- To avoid stretching the entire panel or overlapping controls, pair that with controlled horizontal overflow for the preview area, such as `overflow-x: auto`.
- On very narrow mobile screens, keep the preview usable. Horizontal scrolling is acceptable if it preserves the user's requested one-line display; wrapping can be re-enabled only under a mobile-specific breakpoint if one-line overflow harms usability.

### Issue 3: Double-task explanation block was removed

Cause:
- The old `v3.2.0` double page had a dedicated explanation/preview block.
- Current `DoublePage.vue` kept only the two preset buttons and removed the surrounding "分配说明" block.
- Current `double.ts` still has enough row data to rebuild the preview, but the old computed helpers were removed.

Decision:
- Restore the double-task explanation block because it carries real task-specific information, not low-value generic page description.
- Keep it scoped to the double page; do not reintroduce generic page subtitles.
- Layout should be:
  - Left side: "分配说明", explanatory sentence, current weight preview, calculated percentage preview.
  - Right side: two preset buttons stacked vertically in one column.
- Button copy should be concise and visually balanced:
  - "平均权重"
  - "等级权重"
- Rationale: "平均权重" communicates that participating rooms get the same weight, and "等级权重" communicates that weights come from fan badge levels. They are short, parallel four-character labels that fit stacked buttons cleanly.

## Copy Rules

- Page navigation labels and page titles stay short noun phrases:
  - 概况
  - 登录
  - 领取任务
  - 保活任务
  - 双倍任务
  - 临期任务
  - 鱼吧签到
  - 运行日志
- Switch controls use "某某任务开关":
  - 领取任务开关
  - 保活任务开关
  - 双倍任务开关
  - 临期任务开关
  - 鱼吧任务开关
- Do not use "启动..." or "启用..." as section titles for switches. The switch state already communicates on/off.
- Keep action buttons verb-based:
  - 保存并启用
  - 立即领取
  - 立即保活
  - 立即检测
  - 立即执行
  - 立即签到
- Toast wording is not currently part of the confirmed copy changes.
  - Existing save/disable toasts may keep task-operation result wording like "双倍任务已保存并启用".
  - If toast copy is changed later, describe it as "toast 操作结果文案".
- Align UI-facing task metadata naming where it directly contradicts the WebUI labels.
  - `doubleCard` display label should become "双倍任务", not "双倍卡任务".
  - `doubleCard` not-configured message should become "双倍任务未配置".
- Leave `src/core/**` runtime logs and core error text alone unless the user later asks for deeper terminology cleanup.

## Proposed Implementation Plan

1. Remove visible page subtitles.
   - Recommended implementation: make `subtitle` optional/empty in `navigation.ts` and hide the `<p class="page-subtitle">` element in `AppShell.vue` when no subtitle exists.
   - This removes the repetitive descriptive lines without leaving blank vertical space.
2. Replace sidebar description copy.
   - In `SidebarNav.vue`, replace the current paragraph "更聚焦的 Docker 管理台。先看概况，再分别管理登录、领取、保活、双倍、临期和鱼吧签到任务。"
   - Use the GitHub repository description exactly:
     - "斗鱼自动赠送荧光棒续粉丝牌|检测双倍|鱼吧签到，docker版，基于Curtion/douyu-keep vibe coding"
3. Rename switch labels/titles.
   - `CollectPage.vue`: "启动领取任务" section title and "启用领取任务" switch label become "领取任务开关".
   - `KeepalivePage.vue`: "启用保活任务" label/title become "保活任务开关".
   - `DoublePage.vue`: "启用双倍任务" label/title become "双倍任务开关".
   - `ExpiringPage.vue`: "启用临期任务" label/title become "临期任务开关".
   - `YubaPage.vue`: "启用鱼吧签到任务" label/title become "鱼吧任务开关".
4. Leave toast wording out of this pass unless separately requested.
   - Current save/disable toast messages describe operation results, for example "双倍任务已保存并启用".
   - If toast text is discussed, call it "toast 操作结果文案".
5. Align UI-facing task metadata names.
   - Change `src/docker/task-metadata.ts` `doubleCard` display label from "双倍卡任务" to "双倍任务".
   - Change `doubleCard` not-configured message from "双倍卡任务未配置" to "双倍任务未配置".
   - Do not rename backend task keys such as `doubleCard`.
6. Fix Cron preview wrapping on double and expiring pages.
   - Implement `.cron-preview` as a single-line preview on desktop/tablet with `white-space: nowrap`.
   - Add controlled horizontal overflow on the preview text, for example `overflow-x: auto`, so the long "未来三次" line does not force the grid/panel wider.
   - Do not solve this by shortening dates or hiding preview entries; the user's desired output is one long line.
   - Keep responsive behavior reasonable: on very narrow mobile widths, prefer horizontal scrolling for the preview; only re-enable wrapping under a mobile-specific breakpoint if one-line overflow harms usability.
7. Normalize spacing between Cron preview and action buttons.
   - Define a shared spacing pattern for task/settings panels and action rows.
   - Remove page-specific `ActionBar` inline `margin-top:16px` from affected task pages so they match the collect page baseline.
   - If any spacing is still needed after that, add it through a shared class/rule instead of inline per-page styles.
   - Verify double and expiring pages specifically, because the screenshot shows the issue there.
8. Restore the double-task allocation explanation block from the old `v3.2.0` behavior.
   - Reintroduce `doubleModeHelp` and `doubleRatioPreview` computed state in `double.ts`.
   - Reintroduce the "分配说明" block in `DoublePage.vue`.
   - Reintroduce or replace the old split layout styles, but make the right-side action area a vertical column instead of a single horizontal row.
   - Rename preset buttons to "平均权重" and "等级权重".
   - Keep this restoration separate from the decision to remove generic page subtitles; this is task-specific functional guidance and should remain visible.
9. Run frontend verification after implementation.
   - Type check/build the Docker WebUI path.
   - If feasible, use a quick browser/screenshot pass to confirm header spacing is clean after subtitle removal, action-button spacing matches across task pages, and Cron previews stay single-line on double/expiring.

## Acceptance Criteria

- [ ] No visible page header subtitle shows the removed explanatory sentences.
- [ ] Switch controls use the "某某任务开关" naming pattern.
- [ ] "启动领取任务" no longer appears in WebUI copy.
- [ ] "启用领取任务", "启用保活任务", "启用双倍任务", "启用临期任务", and "启用鱼吧签到任务" no longer appear as static switch labels/titles.
- [ ] Fish-bar switch label is "鱼吧任务开关".
- [ ] Sidebar description uses the GitHub repository description exactly.
- [ ] `doubleCard` UI-facing task metadata uses "双倍任务" / "双倍任务未配置", not "双倍卡任务".
- [ ] Toast copy is not changed in this pass unless a separate user decision is made.
- [ ] Double and expiring Cron preview text for "未来三次" stays on one visual line at normal desktop width.
- [ ] Double and expiring action buttons do not have an obvious blank gap above them compared with the collect page.
- [ ] Task/settings pages use a shared spacing pattern rather than inconsistent inline top margins.
- [ ] Double page shows a "分配说明" block with mode explanation and current weight/percentage preview.
- [ ] Double preset buttons appear as a vertical one-column stack beside the explanation block.
- [ ] Double preset button labels are "平均权重" and "等级权重".
- [ ] Mobile behavior for long Cron preview text remains usable without overlapping or clipping important controls.
- [ ] Core task execution logs/errors are not changed as part of this copy cleanup.
- [ ] Existing unrelated dirty files are not modified or reverted.

## Out Of Scope

- Reworking layout beyond what is necessary to avoid blank subtitle space, Cron preview wrapping, and the reported action-button gap.
- Changing task scheduling behavior, config format, API contracts, or runtime logs.
- Renaming backend task keys such as `collectGift`, `doubleCard`, or `yubaCheckIn`.
- Changing toast operation-result wording.
- Committing or archiving while the user has other active work running.

## Handoff State

- Requirements are converged and ready for implementation.
- Keep this task in `planning` until the implementation pass starts.
- Next session should run Trellis continue/current-task context, read this PRD, then start the task and implement.
