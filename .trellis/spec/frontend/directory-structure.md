# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The frontend is a Docker WebUI Vue 3 application under `src/docker/webui-src/`. It uses:

- Vue single-file components
- Vite for development and production bundling
- TypeScript checked by `vue-tsc`
- Docker WebUI source files under `src/docker/webui-src/`

This project does not currently use Vue Router, Pinia, Vuetify, UnoCSS, or an Electron renderer.

---

## Directory Layout

```text
src/docker/
├── webui-src/
│   ├── App.vue
│   ├── components/
│   │   ├── AppShell.vue
│   │   ├── AuthShell.vue
│   │   ├── *Page.vue
│   │   └── reusable task/table components
│   ├── legacy-app.ts
│   ├── index.html
│   ├── main.ts
│   └── styles/
│       ├── base.css
│       ├── shell.css
│       ├── components.css
│       ├── responsive.css
│       └── tables.css
```

---

## Module Organization

- Put Vue app entry code in `src/docker/webui-src/main.ts`.
- Put the Vite HTML shell in `src/docker/webui-src/index.html`.
- Put Vue shell/component code in `src/docker/webui-src/*.vue`.
- Put extracted cohesive shell/page components under `src/docker/webui-src/components/`.
- Put shared Docker WebUI styles under `src/docker/webui-src/styles/`, imported by `main.ts` in base, shell, components, tables, responsive order.
- Keep Docker runtime serving concerns in `src/docker/webui.ts` and `src/docker/server-webui-routes.ts`.

## Docker WebUI Component Boundaries

- `App.vue` owns root composition: bootstrap data, auth session, navigation/theme/toast roots, and overview refresh state shared by the toolbar and overview page.
- `components/AppShell.vue` owns the authenticated layout, page tabpanel mounting, and page-level component composition.
- `components/SidebarNav.vue` owns brand, tablist attributes, keyboard handler wiring, and theme selector markup.
- `components/TopToolbar.vue` owns the refresh/logout toolbar controls.
- `components/AuthShell.vue` owns the login shell markup while `App.vue` wires it to `useAuthSession()`.
- `components/*Page.vue` owns page markup and calls its existing page composable unless a parent must share state across shell regions.
- `components/TaskStatusCard.vue`, `CronField.vue`, `EnableSwitch.vue`, and `ActionBar.vue` own repeated task page controls while page composables still own request and persistence logic.
- `components/*Table.vue` owns repeated fans, Yuba, allocation, and backpack table markup; pages pass reactive row models and handle mutation events.

## Style Ownership

- `styles/base.css` owns Docker WebUI base variables and global body/theme foundations.
- `styles/shell.css` owns Docker WebUI auth shell, navigation, app shell, header, toolbar, and page visibility styles.
- `styles/components.css` owns Docker WebUI cards, panels, forms, buttons, and task component primitives.
- `styles/tables.css` owns Docker WebUI table, empty-state, log, toast, and screen-reader utility styles.
- `styles/responsive.css` owns Docker WebUI motion and responsive overrides.

## Naming Conventions

- Use PascalCase for Vue component filenames such as `App.vue`.
- Use lowercase TypeScript filenames for frontend helpers such as `main.ts`.
- Keep transitional legacy module filenames stable until their behavior is migrated and the contract tests are updated.

## Anti-Patterns

- Do not create `src/renderer/` or Electron renderer entrypoints for Docker WebUI work.
- Do not introduce Vue Router until route ownership moves from the existing page route map to Vue.
- Do not introduce Pinia or a UI component framework without a repeated concrete need.
- Do not put Docker API route behavior in Vue components; call the existing Express JSON APIs.
