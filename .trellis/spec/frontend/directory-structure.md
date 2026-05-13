# Directory Structure

> How frontend code is organized in this project.

---

## Overview

Docker WebUI source lives entirely under `src/docker/webui/`. Vite builds it into `build/docker/docker/webui/`; do not copy source files manually into the build output.

---

## Directory Layout

```text
src/docker/webui/
  App.vue                    Vue root.
  main.ts                    CSS imports and Vue mount.
  components/                Vue single-file components for shell and pages.
  composables/               Reusable Vue composables.
  styles/                    Global CSS split by base, shell, components, tables, responsive.
  *.ts                       Page composables, request helpers, resource state, utilities.
  index.html                 Vite HTML entry with Docker bootstrap tokens.
```

Current examples:

- `components/AppShell.vue` composes navigation, toolbar, and tab panels.
- `components/LoginConfigPage.vue`, `CollectPage.vue`, `YubaPage.vue`, `KeepalivePage.vue`, `DoublePage.vue`, `ExpiringPage.vue`, and `LogsPage.vue` are page components.
- `composables/use-cron-preview.ts` is a reusable composable.
- `request.ts`, `resource-state.ts`, `resource-config.ts`, `resource-fans.ts`, `resource-yuba.ts`, `resource-request.ts`, `logs-resource.ts`, `task-shared.ts`, `theme.ts`, and `toast.ts` hold shared frontend logic.

---

## Module Organization

Vue components should stay presentational where practical. Stateful page logic belongs in a nearby `use*` composable module, usually a sibling `.ts` file:

```typescript
// src/docker/webui/theme.ts
export function useThemeMode() {
  const themeMode = ref<ThemeMode>('system')
  // ...
  return { savingThemeMode, selectThemeMode, themeMode, themeModes, themeNote }
}
```

Do not add compatibility bridge installers or old imperative app runtimes. Cross-page resource ownership belongs in Vue composables or shared TypeScript modules. Keep `resource-state.ts` as the public facade for refresh orchestration and compatibility exports, while focused resource modules own raw config, fans/gift, yuba, and request tracking. Cover ownership changes in the maintenance contract test.

---

## Naming Conventions

- Vue components use PascalCase filenames: `TaskStatusCard.vue`, `AllocationTable.vue`.
- Composables use `use*` function names: `useThemeMode`, `useOverviewPage`, `useCronPreview`.
- Shared helpers use clear action names such as `requestJson`, `showToast`, `formatDate`, and `saveTaskConfig`.
- CSS is global and split by surface area under `styles/`; do not add component-scoped styling unless a task intentionally changes the style architecture.

---

## Examples

Good patterns to copy:

- `App.vue` wires top-level composables and passes state into shells.
- `AppShell.vue` keeps tab panels accessible with `role="tabpanel"`, `aria-labelledby`, and `hidden`.
- `task-shared.ts` centralizes task UI helpers used by several task pages.
- `resource-state.ts` composes Vue-owned server-resource loading and protected-state clearing; focused `resource-*` modules own concrete resources and request coalescing.
