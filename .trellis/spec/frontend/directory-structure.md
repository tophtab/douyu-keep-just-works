# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The frontend is a Docker WebUI Vue 3 application under `src/docker/webui-src/`. It uses:

- Vue single-file components
- Vite for development and production bundling
- TypeScript checked by `vue-tsc`
- Existing CSS and transitional browser modules under `src/docker/webui/`

This project does not currently use Vue Router, Pinia, Vuetify, UnoCSS, or an Electron renderer.

---

## Directory Layout

```text
src/docker/
├── webui-src/
│   ├── App.vue
│   ├── index.html
│   ├── legacy-modules.d.ts
│   └── main.ts
└── webui/
    ├── app-*.js
    ├── styles.css
    ├── styles-components.css
    ├── styles-responsive.css
    └── styles-tables.css
```

---

## Module Organization

- Put Vue app entry code in `src/docker/webui-src/main.ts`.
- Put the Vite HTML shell in `src/docker/webui-src/index.html`.
- Put Vue shell/component code in `src/docker/webui-src/*.vue`.
- Keep transitional legacy browser modules in `src/docker/webui/*.js` until they are migrated.
- Keep shared visual styles in `src/docker/webui/styles*.css` while the conservative migration preserves the current UI.
- Keep Docker runtime serving concerns in `src/docker/webui.ts` and `src/docker/server-webui-routes.ts`.

## Naming Conventions

- Use PascalCase for Vue component filenames such as `App.vue`.
- Use lowercase TypeScript filenames for frontend helpers such as `main.ts`.
- Keep transitional legacy module filenames stable until their behavior is migrated and the contract tests are updated.

## Anti-Patterns

- Do not create `src/renderer/` or Electron renderer entrypoints for Docker WebUI work.
- Do not introduce Vue Router until route ownership moves from the existing page route map to Vue.
- Do not introduce Pinia or a UI component framework without a repeated concrete need.
- Do not put Docker API route behavior in Vue components; call the existing Express JSON APIs.
