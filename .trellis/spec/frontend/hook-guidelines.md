# Hook Guidelines

> How Vue composables and stateful frontend helpers are used in this project.

---

## Overview

This is a Vue project, so "hooks" are Vue composables. Composables live either in `src/docker/webui/composables/` when reusable across pages, or as `use*` exports in feature modules such as `theme.ts`, `overview.ts`, `resources.ts`, and task page modules.

---

## Custom Hook Patterns

Use `ref`, `computed`, `watch`, `onMounted`, and `onBeforeUnmount` from Vue. Return only the state and actions that templates or callers need:

```typescript
export function useThemeMode() {
  const themeMode = ref<ThemeMode>('system')
  const savingThemeMode = ref<ThemeMode | null>(null)
  const themeNote = computed(() => /* derived text */)

  onMounted(() => {
    document.addEventListener(CONFIG_EVENT_NAME, handleConfigEvent)
  })

  onBeforeUnmount(() => {
    document.removeEventListener(CONFIG_EVENT_NAME, handleConfigEvent)
  })

  return { savingThemeMode, selectThemeMode, themeMode, themeModes, themeNote }
}
```

Always remove document, window, and media-query listeners in `onBeforeUnmount`.

---

## Data Fetching

Use `requestJson` from `src/docker/webui/request.ts` for WebUI API calls. It centralizes JSON parsing, unauthorized handling, and optional error toasts.

```typescript
await requestJson('/api/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ui: { themeMode: nextThemeMode } }),
  errorToast: message => `保存主题失败：${message}`,
})
```

Resource loaders in `resources.ts` track pending requests and request sequence numbers for expensive server resources. Reuse those patterns when preventing duplicate in-flight reads or stale responses.

## Task Page Actions

Task pages that save/disable/trigger scheduled Docker tasks should keep page-specific form state, table rows, and user-facing copy in the page composable, but share mechanical actions through `src/docker/webui/task-page-actions.ts`.

Use these helpers before adding another local copy of the same task-page plumbing:

```typescript
await saveEnabledTask({ payload, enabled, successMessage, failurePrefix, refresh })
await disableEnabledTask({ payload, successMessage, failurePrefix, restoreEnabled, refresh })
toggleEnabledTask(enabled, saveTask, disableTask)
await triggerFansBackedTask('keepalive')
```

Use `refreshTaskSurface(activeTab)` for the common `refreshOverviewSurface(activeTab, false)` pattern. This keeps the page composables focused on task-specific defaults, validation, and computed UI text while preserving the existing optimistic-toggle rollback behavior.

---

## Naming Conventions

- Composable function names start with `use`.
- Composable files under `composables/` use kebab-case filenames, such as `use-cron-preview.ts`.
- Returned action names should describe user actions: `refreshOverview`, `selectThemeMode`, `submitLogin`, `saveTaskConfig`.

---

## Common Mistakes

- Do not fetch with raw `fetch` from new composables when `requestJson` applies.
- Do not leave global event listeners installed after component unmount.
- Do not duplicate cron preview logic; use `useCronPreview`.
- Do not let a failed optimistic save leave toggles permanently out of sync; follow `saveTaskConfig`/`disableTaskConfig` in `task-shared.ts`.
