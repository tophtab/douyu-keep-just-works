# Component Guidelines

> How Vue components are built in this project.

---

## Overview

Components use Vue 3 single-file components with `<script setup lang="ts">`. The root app composes shell components and page components, while page-specific behavior is usually provided by composables in sibling TypeScript modules.

---

## Component Structure

Use typed props and emits at the top of `<script setup>`:

```vue
<script setup lang="ts">
defineProps<{
  loginError: string
  password: string
  submittingLogin: boolean
}>()

const emit = defineEmits<{
  submit: []
  'update:password': [value: string]
}>()
</script>
```

Keep templates declarative. Prefer passing callback props or emitting events over querying DOM nodes for Vue-owned controls.

### Shared Table Row Builders

When multiple WebUI tables show the same domain columns, keep the table component presentational and extract the repeated data-to-row mapping into a shared row builder under `src/docker/webui/`.

Good:

```typescript
export function buildFanDisplayRows(fans: Fans[]) {
  return fans.map((fan, index) => ({
    index: index + 1,
    name: fan.name || '未知主播',
    roomId: fan.roomId,
  }))
}
```

Page composables should call the shared builder and add only page-specific columns, such as task values, enabled flags, or double-card status. Avoid copying the same `name` / `roomId` / `level` / `rank` / `today` / `intimacy` mapping across overview and task pages.

---

## Props Conventions

- Use `defineProps<T>()` with inline interfaces for component-local shapes.
- Import shared domain types from `src/core/types.ts` when the shape crosses backend/frontend boundaries.
- For `v-model`, expose `update:*` emits as shown in `AuthShell.vue`.
- Function props are accepted for shell-level composition when the caller owns navigation or task actions, as in `AppShell.vue`.

---

## Styling Patterns

Current styling is global CSS imported by `main.ts`:

```typescript
import './styles/base.css'
import './styles/shell.css'
import './styles/components.css'
import './styles/tables.css'
import './styles/responsive.css'
```

Use existing classes such as `btn`, `actions`, `page`, `field-block`, and table classes before inventing new styling primitives. Keep repeated visual structures as components rather than copying large template blocks.

### Custom Scrollbars

Global WebUI scrollbar styling belongs in `src/docker/webui/styles/base.css`. Keep the WebKit/Blink rules aligned with the neko reference: `::-webkit-scrollbar`, `::-webkit-scrollbar-track`, `::-webkit-scrollbar-thumb`, and `::-webkit-scrollbar-thumb:hover` only. Do not add standard `scrollbar-width` / `scrollbar-color` compatibility rules or extra scrollbar subpart resets unless a future task explicitly changes the reference target.

### Shared Section Components

Use `PageSection.vue` for reusable panel sections that need consistent heading, header-action, and body spacing. Use `TaskSettingsSection.vue` for scheduled task settings panels that combine an enable switch, form controls, actions, and optional table/status content.

For scheduled task pages that share the same two-button "保存并启用" plus immediate-run action, use `TaskActionBar.vue` instead of rebuilding `ActionBar` arrays and page-local index dispatch functions. The component emits `save` and `trigger`; call the same task composable functions the page already owns.

For optional tables that use the exact `section-block` + `empty` + `table-shell` structure, use `TableSection.vue`. Keep table rendering in the specific table component passed through the slot, and pass wrapper IDs as normal attributes so they inherit onto the root `section-block`.

Good:

```vue
<TaskSettingsSection
  v-model="taskEnabled"
  input-id="task-enable"
  name="task-enable"
  label="任务开关"
  title="任务开关"
  :control-columns="2"
>
  <template #controls>
    <CronField ... />
  </template>
  <template #actions>
    <TaskActionBar
      secondary-label="立即保活"
      @save="saveKeepaliveConfig"
      @trigger="triggerKeepaliveTask"
    />
  </template>
  <TableSection
    id="keepalive-table-wrap"
    :show-table="showKeepaliveTable"
    :empty-text="keepaliveEmptyText"
  >
    <AllocationTable ... />
  </TableSection>
</TaskSettingsSection>
```

Avoid hand-written `panel` wrappers, one-off `panel-head` blocks, or inline spacing such as `style="margin-top:16px"` for task and overview sections. Do not force `TaskActionBar.vue` onto pages with different action semantics, such as login, overview, or logs. Use `TableSection.vue` when a page needs the same table-or-empty rhythm.

---

## UI Copy Conventions

Task enable switch titles and labels should use the concise `某某任务开关` pattern for scheduled task pages, such as `领取任务开关`, `保活任务开关`, `双倍任务开关`, `临期任务开关`, and `鱼吧任务开关`.

Do not use `启动...` or `启用...` as static switch section titles. The switch state and save action already communicate whether a task is enabled. Keep action buttons verb-based, such as `保存并启用`, `立即领取`, `立即保活`, `立即检测`, `立即执行`, and `立即签到`.

Generic page header subtitles should stay absent unless they add task-specific, actionable information. Do not reintroduce broad explanatory subtitles such as "manage login/status/task settings" under every page title. Task-specific guidance belongs near the relevant controls, as with the double-task `分配说明` block.

Operation-result toast copy is a separate surface. Do not change save/disable/trigger toast wording as part of static UI copy cleanup unless the task explicitly includes toast operation-result copy.

---

## Accessibility

Current patterns to preserve:

- Login errors use `role="alert"`.
- Toast live updates use an off-screen `role="status"` region with `aria-live="polite"`.
- Page sections use tabpanel semantics and `aria-hidden`/`hidden` tied to the active tab.
- Inputs have visible labels connected with `for`/`id`.
- Navigation key handling is centralized by `usePageNavigation`.

---

## Common Mistakes

- Do not place runtime constants before `defineProps` or `defineEmits` in `<script setup>`; Vue macros must come immediately after imports/type definitions to satisfy lint ordering.
- Do not add imperative `data-action` handlers for Vue-owned controls.
- Do not hide authenticated shell state with inline `style="display:none"`; use Vue state as in `App.vue`.
- Do not put API fetch logic directly into deeply presentational table components.
- Do not create a new one-off CSS theme when existing global styles cover the surface.
