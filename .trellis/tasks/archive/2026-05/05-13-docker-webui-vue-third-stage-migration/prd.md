# Third-Stage Docker WebUI Vue Migration

## Goal

Implement the next low-risk Docker WebUI Vue migration slice after Vue owns shell navigation and route state. The goal is to move cohesive global UI behavior into Vue components/composables while preserving current routes, authentication behavior, styling, Docker build semantics, and legacy task/data workflows.

## What I Already Know

- First-stage migration is complete in commit `4a80d70 feat: build Docker WebUI with Vue and Vite`.
- Docker image build verification passed after fixing the builder-stage optional dependency handling.
- Second-stage migration is complete in commit `7c2d43b feat: migrate Docker WebUI navigation to Vue`.
- `src/docker/webui-src/App.vue` currently owns the large WebUI shell markup and Vue-controlled navigation.
- `src/docker/webui-src/navigation.ts` owns page route state, tab metadata, History API syncing, keyboard tab navigation, and a transitional `douyu-keep-webui:navigation` event for legacy modules.
- `src/docker/webui-src/main.ts` still imports legacy `src/docker/webui/app-*.js` modules in a fixed order.
- Legacy modules still own most data fetching, task actions, task forms, table rendering, logs, auth actions, and theme persistence/rendering.
- The theme controls are already shell-level UI in `App.vue`, but their state, save action, body attribute/meta updates, and `aria-pressed` state are still owned by legacy modules.

## Assumptions

- Keep the third-stage migration incremental and low-risk.
- Do not redesign the UI while migrating behavior.
- Preserve existing Chinese user-facing copy.
- Keep current Express API routes and response contracts unchanged.
- Keep Vue/Vite dependencies in `devDependencies`; the runtime Docker image serves built static assets only.
- Keep legacy modules in place until their behavior is fully replaced and verified.

## Requirements

- Migrate one coherent global UI behavior slice from transitional legacy modules into Vue-owned code.
- Prefer the theme mode slice for this stage because it is shell-level, small, user-visible, and already colocated with Vue-owned sidebar markup.
- Move theme mode UI state and browser side effects into Vue composables/components under `src/docker/webui-src/`.
- Preserve the existing `ui.themeMode` config contract and `/api/config` save behavior.
- Preserve current `body[data-theme]`, `theme-color`, `color-scheme`, button active state, `aria-pressed`, and system color-scheme behavior.
- Preserve the existing toast/error behavior for failed saves.
- Migrate toast/live-region feedback ownership into Vue while keeping legacy action modules able to request toasts through a narrow compatibility bridge.
- Keep data-fetching, task actions, task forms, tables, logs, and auth/session workflows in legacy modules unless a small compatibility bridge is needed.
- Reduce duplicate legacy DOM ownership for the migrated slice.
- Update or add tests where build, behavior, or contract boundaries change.

## Acceptance Criteria

- [x] Theme mode selection is represented by Vue SFC/composable state rather than legacy DOM button mutation.
- [x] Selecting light/dark/system still persists `ui.themeMode` through the existing backend config endpoint.
- [x] The resolved theme still updates `document.body[data-theme]`, `theme-color`, and `color-scheme`.
- [x] System theme changes still update the resolved theme when mode is `system`.
- [x] Theme controls keep accessible selected state and focus behavior.
- [x] Toast/live-region DOM is represented by Vue SFC/composable state rather than legacy DOM mutation.
- [x] Legacy `toast(message, ok)` callers still show the same visible success/error toast and update the polite live region.
- [x] Existing WebUI routes, login/session flow, and page navigation remain unchanged.
- [x] Transitional legacy modules still load in the required order for non-migrated behavior.
- [x] `npm run lint`, `npm run type-check`, and relevant tests pass.
- [x] Docker build semantics remain valid after the migration slice.

## Definition of Done

- The selected slice no longer depends on duplicate legacy DOM ownership.
- Remaining legacy modules are explicitly left transitional.
- Specs are updated if the task establishes a new Vue migration pattern or boundary.
- Docker runtime still has no Vite dev server or frontend build tooling dependency.

## Out of Scope

- Replacing all `app-*.js` modules in one pass.
- Migrating task forms, tables, logs, resource actions, or all API data fetching.
- Replacing the auth/login/session flow in this slice.
- Adding Pinia, Vue Router, Vuetify, Tailwind, or another UI framework.
- Changing Express API contracts.
- Redesigning page visuals.
- Publishing Docker images.

## Expansion Sweep

- Future evolution: this slice should create a reusable pattern for Vue-owned shell controls that need backend persistence and browser side effects.
- Related scenarios: later slices can migrate auth shell state, toast/live-region behavior, and then individual page data surfaces using the same composable-first pattern.
- Failure and edge cases: config save can fail or return unauthorized; `matchMedia` can be absent or throw; theme meta nodes may be missing in tests or older browsers.

## Technical Approach

Use a narrow Vue-owned theme migration:

- Add a small theme composable under `src/docker/webui-src/` that owns allowed modes, resolved theme, system preference observation, browser side effects, and save behavior.
- Wire the existing sidebar theme buttons in `App.vue` to Vue state/events instead of relying on `data-action="theme-mode"` and legacy DOM mutation.
- Add a small toast composable under `src/docker/webui-src/` that owns visible toast state and `#toast-live`; bridge transitional legacy calls with a `douyu-keep-webui:toast` browser event.
- Keep the existing legacy request/toast infrastructure reachable through a narrow compatibility boundary if that avoids broad API-client migration in this stage.
- Remove or bypass only the legacy theme-specific mutation path after Vue owns the slice; leave unrelated legacy modules untouched.

## Decision (ADR-lite)

**Context**: Navigation is already Vue-owned, but the shell still has small global controls whose state is mutated by legacy DOM helpers.

**Decision**: Start the third stage with the theme mode slice instead of a task page or auth rewrite.

**Consequences**: This reduces duplicate ownership in a small, testable area and establishes a Vue composable pattern for global browser side effects. It intentionally leaves larger data-heavy workflows for later migration slices.

## Technical Notes

- Relevant current files:
  - `src/docker/webui-src/App.vue`
  - `src/docker/webui-src/main.ts`
  - `src/docker/webui-src/navigation.ts`
  - `src/docker/webui/app-dom.js`
  - `src/docker/webui/app-actions.js`
  - `src/docker/webui/app-pages.js`
  - `src/docker/webui/app-events.js`
  - `src/docker/webui/app-state.js`
  - `src/docker/webui.ts`
  - `src/docker/server-webui-routes.ts`
  - `vite.config.ts`
- Relevant specs:
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/state-management.md`
  - `.trellis/spec/frontend/hook-guidelines.md`
  - `.trellis/spec/frontend/type-safety.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/backend/directory-structure.md`
  - `.trellis/spec/guides/docker-webui-auth-contract.md`

## Verification Results

- `npm run lint` passed.
- `npm run type-check` passed.
- `npm run test:contracts` passed.
- `npm test` passed, including `npm run build:docker`.
- Browser smoke test against built Docker WebUI on `127.0.0.1:51419` passed:
  - Login with `WEB_PASSWORD=password` reached the Vue shell.
  - Theme buttons updated `aria-pressed`, active class, `body[data-theme]`, `theme-color`, and `color-scheme`.
  - Theme save persisted `ui.themeMode` in the Docker config file.
