# Targeted WebUI Frontend Slimming Plan

## Goal

Reduce repeated Docker WebUI frontend code through narrow, business-shaped abstractions. The work should make task page components shorter and more consistent without introducing a broad design system or generic primitives that move complexity into props.

## What I Already Know

- The maintained frontend lives under `src/docker/webui/` and uses Vue 3 SFCs, Vite, TypeScript, and global CSS.
- Current frontend specs prefer existing classes and shared components before inventing new styling primitives.
- Existing shared components already cover major page structure: `PageSection.vue`, `TaskSettingsSection.vue`, `ActionBar.vue`, `TaskStatusCard.vue`, `CronField.vue`, and task tables.
- Recent history contains reverts for broad page/field primitives, so this task should avoid generic `Field`, `Panel`, or all-in-one page-frame abstractions.
- The clearest repeated code is in scheduled task page templates:
  - repeated `handleAction(index)` wrappers around save/trigger actions
  - repeated `ActionBar` action arrays for "保存并启用" plus a task-specific immediate action
  - repeated `section-block` + `empty` + `table-shell` wrappers around optional tables
  - repeated allocation table row mutation helpers in Keepalive, Double, and Expiring pages

## Requirements

- Keep the change narrowly scoped to actual repeated task-page structure.
- Prefer small shared components/helpers with simple APIs over broad styling primitives.
- Preserve current UI copy, task behavior, accessibility semantics, and table rendering.
- Avoid changing backend, API contracts, task scheduling logic, or resource loading behavior.
- Do not reintroduce old imperative WebUI patterns or compatibility globals.
- Do not implement visual redesign beyond preserving the existing layout through shared wrappers.

## Proposed Implementation Plan

1. Add a small `TaskActionBar.vue` component.
   - Purpose: replace repeated task-page `ActionBar` usage and local `handleAction(index)` functions.
   - Suggested props:
     - `primaryLabel?: string` defaulting to `保存并启用`
     - `secondaryLabel: string`
   - Suggested emits:
     - `save`
     - `trigger`
   - Template should wrap existing `ActionBar` and keep `class="section-actions"` at the call site or inside the component consistently.
   - Expected call site shape:
     ```vue
     <TaskActionBar secondary-label="立即保活" @save="saveKeepaliveConfig" @trigger="triggerKeepaliveTask" />
     ```

2. Add a small `TaskTableSection.vue` component.
   - Purpose: replace repeated task table wrapper markup.
   - Suggested props:
     - `showTable: boolean`
     - `emptyText: string`
   - Attribute inheritance should allow `id="keepalive-table-wrap"` to land on the root `section-block` wrapper.
   - Template should preserve the exact existing structure:
     ```vue
     <div class="section-block">
       <div v-if="!showTable" class="empty">{{ emptyText }}</div>
       <div v-else class="table-shell"><slot /></div>
     </div>
     ```
   - Use for Keepalive, Double, Expiring backpack, Expiring allocation, and Yuba table blocks.
   - Do not force Overview/Logs/Login into this component; those pages have different information structure.

3. Add row mutation helpers only if they reduce page-local boilerplate without weakening type safety.
   - Candidate location: `src/docker/webui/allocation-task.ts`, because allocation rows already live there.
   - Suggested helpers:
     ```ts
     export function updateAllocationRowValue<T extends { value: number }>(row: T, value: number): void
     export function updateAllocationRowEnabled<T extends { enabled?: boolean }>(row: T, value: boolean): void
     ```
   - Use them to remove local interfaces and `updateRowValue` / `updateRowEnabled` functions from task page components.
   - If `vue-tsc` or readability gets worse, skip this step and keep local helpers.

4. Apply the components page by page.
   - `CollectPage.vue`: replace `ActionBar` + `handleAction` only.
   - `KeepalivePage.vue`: replace action bar, table wrapper, and possibly row helper.
   - `DoublePage.vue`: replace action bar, table wrapper, and possibly row helpers.
   - `ExpiringPage.vue`: replace action bar, both table wrappers, and possibly row helper.
   - `YubaPage.vue`: replace action bar and table wrapper.
   - Leave `LoginConfigPage.vue`, `OverviewPage.vue`, and `LogsPage.vue` alone unless a very small, obvious reuse falls out naturally.

## Acceptance Criteria

- [ ] Task page UI copy remains unchanged.
- [ ] Task save/trigger actions still call the same composable functions.
- [ ] Empty table states and populated table shells render with the same classes as before.
- [ ] The change deletes more repeated page template/handler code than it adds in new shared components/helpers.
- [ ] No broad `Field`, `Panel`, `PageFrame`, or design-system-style abstraction is introduced.
- [ ] `npm run lint` passes.
- [ ] `npm run type-check:webui` passes.
- [ ] `npm run build:webui` passes if component structure or CSS-visible layout changes are made.

## Out Of Scope

- Login page redesign.
- Overview/logs page restructuring.
- Field/input primitive refactors.
- CSS theme changes.
- Backend route, config, scheduler, or resource-loader changes.
- Visual regression tooling setup.

## Handoff Notes

- Before implementation, re-run `git status --short` and inspect target files because another session may have modified WebUI files.
- If any target page has changed, re-read it and adapt the plan instead of overwriting those changes.
- Start with `TaskActionBar.vue`; it gives the smallest and easiest verification.
- Then add `TaskTableSection.vue`; verify root attributes preserve wrapper IDs.
- Only add allocation row helpers after the component simplifications are green.
- Keep implementation incremental and run `npm run type-check:webui` after the first pass.

## Relevant Files To Inspect During Implementation

- `src/docker/webui/components/CollectPage.vue`
- `src/docker/webui/components/KeepalivePage.vue`
- `src/docker/webui/components/DoublePage.vue`
- `src/docker/webui/components/ExpiringPage.vue`
- `src/docker/webui/components/YubaPage.vue`
- `src/docker/webui/components/ActionBar.vue`
- `src/docker/webui/components/TaskSettingsSection.vue`
- `src/docker/webui/allocation-task.ts`
- `src/docker/webui/styles/components.css`

## Definition Of Done

- Focused task-page code slimming is complete.
- Quality checks above pass.
- Any spec update is considered; update frontend component guidelines only if the new wrapper components become a convention worth preserving.
