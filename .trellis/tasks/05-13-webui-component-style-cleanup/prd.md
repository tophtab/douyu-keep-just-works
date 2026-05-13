# WebUI componentization and style organization cleanup

## Goal

Finish the remaining Docker WebUI Vue cleanup by shrinking `App.vue`, extracting cohesive shell/page/task/table components, and organizing styles without changing the user-facing behavior or Docker deployment contract.

## What I Already Know

- `src/docker/webui-src/App.vue` is still the main composition file and is about 978 lines.
- `AuthShell.vue` already exists, but authenticated shell, sidebar navigation, top toolbar, pages, task cards, cron fields, switches, action rows, and repeated tables still live in `App.vue`.
- Page composables already exist in TypeScript files such as `overview.ts`, `cookie.ts`, `collect.ts`, `yuba.ts`, `keepalive.ts`, `double.ts`, `expiring.ts`, and `resources.ts`; this task should mostly move markup into SFCs and keep state/action ownership in those composables.
- Shared WebUI styles are under `src/docker/webui-src/styles/` in `base.css`, `components.css`, `tables.css`, and `responsive.css`.
- Transitional `legacy-*` modules and `DOUYU_KEEP_WEBUI_*` browser bridges are still present and should remain functional while Vue migration compatibility is needed.

## Requirements

- Extract authenticated application shell from `App.vue`:
  - `AppShell.vue` owns the authenticated layout, main/sidebar structure, page title region, toast/live region placement remains app-level or shell-level as appropriate.
  - `SidebarNav.vue` owns brand, tablist, keyboard/tab attributes, and theme selector.
  - `TopToolbar.vue` owns refresh/logout toolbar buttons.
- Extract page SFCs for at least:
  - `OverviewPage.vue`
  - `LoginConfigPage.vue`
  - `CollectPage.vue`
  - `YubaPage.vue`
  - Task pages that share the same structure should use common components and may be extracted together when practical.
- Extract repeated task UI:
  - `TaskStatusCard.vue`
  - `CronField.vue`
  - `EnableSwitch.vue`
  - `ActionBar.vue`
- Extract repeated tables or table sections:
  - fans status overview table
  - yuba status table
  - allocation tables for keepalive/double/expiring where the shared shape is practical without over-generalizing.
- Preserve existing user-facing Chinese copy, route IDs, tabpanel/tab ARIA contracts, form labels, data labels, live regions, and task action wiring.
- Keep Docker WebUI source under `src/docker/webui-src/`; do not introduce Vue Router, Pinia, Vuetify, or other heavy UI frameworks.
- Improve style organization by moving component-specific styles into scoped SFC styles when local, while keeping truly shared primitives in `styles/`.
- Leave broad removal of transitional `legacy-*` and `DOUYU_KEEP_WEBUI_*` naming out of scope unless a rename is purely internal to a new component and does not affect bridge contracts.

## Acceptance Criteria

- [x] `App.vue` becomes a small composition/root file rather than containing page markup.
- [x] Authenticated shell, navigation, top toolbar, major pages, task status card, cron field, enable switch, action bar, and repeated table views are represented as Vue components.
- [x] Existing composables continue to provide page state/actions, and extracted components consume props/events instead of duplicating request logic.
- [x] Existing route URLs, tab IDs, page IDs, `aria-*` relationships, and form control names/IDs stay stable.
- [x] `npm run lint` passes.
- [x] `npm run type-check` passes.
- [x] `npm run build:webui` passes.

## Out Of Scope

- Visual redesign.
- Removing the transitional legacy bridge layer wholesale.
- Backend API or config schema changes.
- Introducing a router, global store, or UI framework.

## Technical Notes

- Relevant guidelines read:
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/directory-structure.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/backend/directory-structure.md`
- Implementation should prefer shallow component boundaries over tiny deep fragments.
- Shared styles may remain in `styles/` when they are reused across multiple components; scoped styles are for styles with a single component owner.
