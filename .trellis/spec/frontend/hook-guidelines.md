# Hook Guidelines

> How reusable stateful logic is handled in this project.

---

## Overview

This is a Vue project, so there are no React hooks.
The closest equivalents are:

- Pinia stores in `src/renderer/stores/`
- renderer helper modules in `src/renderer/run/`
- simple local `ref` / `reactive` usage inside view components
- Docker WebUI composables under `src/docker/webui/composables/` when repeated Vue-owned behavior appears across several Docker pages

When this repository talks about reusable stateful logic, prefer those patterns instead of inventing a separate composables layer unless there is clear repeated behavior.

---

## Reusable Logic Patterns

- Use a Pinia store when multiple routes need the same reactive state.
- Use `run/` helpers for async workflows and side-effect-heavy procedures.
- Keep one-off validation or screen-only state inside the view component.
- In Docker WebUI, extract a composable only for non-trivial behavior repeated across multiple pages, such as cron preview request sequencing with stale-response protection.
- In Docker WebUI, put non-lifecycle helpers such as save/disable/trigger request wrappers and legacy event wiring in small shared TypeScript modules instead of page-local copies.

Examples:

- `src/renderer/stores/user.ts` encapsulates login/user state and refresh behavior.
- `src/renderer/stores/fans.ts` encapsulates fan list loading and loading status.
- `src/renderer/run/index.ts` contains the multi-step gift workflow instead of placing it in a page.
- `src/renderer/run/utils.ts` contains renderer-side async helpers for IPC and HTTP calls.

---

## Data Fetching

- Data fetching is done directly with `axios` or IPC invocations.
- Requests usually happen inside Pinia actions or view initialization functions.
- Loading flags are explicit `ref<boolean>` values in stores.

Examples:

- `src/renderer/stores/fans.ts` fetches the Douyu fans list and toggles `loading`.
- `src/renderer/stores/user.ts` fetches both the current gift count and profile info.
- `src/renderer/views/config/index.vue` fetches cron preview data through `window.electron.ipcRenderer.invoke('cron', ...)`.
- `src/docker/webui/composables/use-cron-preview.ts` fetches Docker cron preview data through `/api/cron-preview` and centralizes loading/error/display text for task pages.

---

## Naming Conventions

- Pinia store factories use `useXxx` naming: `useLogin`, `useFans`, `useLog`, `useCronStatus`.
- Store ids are short lowercase strings such as `'user'`, `'fans'`, and `'log'`.
- Async store methods use verb-based names like `getUser()` and `getFansList()`.
- Docker WebUI composable filenames use lowercase kebab-style names such as `use-cron-preview.ts`, while exported factories keep `useXxx` names.

---

## Common Mistakes

- Do not create a new composable/store when the logic is only used once in one screen.
- Do not destructure store state directly without `storeToRefs()` when reactivity matters.
- Do not hide loading or error transitions; keep them explicit in store state or component state.
