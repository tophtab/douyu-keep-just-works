# Second-Stage WebUI Vue Migration

## Goal

Implement the first low-risk slice of the second-stage Docker WebUI migration after the first Vue 3 + Vite + TypeScript foundation is in place.

The goal is to move shell/navigation/page-route state from the transitional legacy `src/docker/webui/app-*.js` behavior layer into Vue single-file components and composables, while preserving current Docker WebUI behavior, routes, styling, and deployment semantics.

## What I Already Know

- First-stage migration is complete in commit `4a80d70 feat: build Docker WebUI with Vue and Vite`.
- The current frontend entry lives under `src/docker/webui-src/`.
- `src/docker/webui-src/App.vue` owns the current WebUI shell markup.
- `src/docker/webui-src/main.ts` imports the legacy browser behavior modules in order.
- The old `src/docker/webui/app-*.js` modules are still bundled by Vite as a transitional behavior layer.
- Express continues to serve Vite-built static assets from the Docker runtime.
- Docker image build verification found that Vite/Rolldown optional native bindings must be available in the builder stage.
- This task now implements the first second-stage migration slice directly.

## Assumptions

- Keep the second stage incremental and low-risk.
- Do not redesign the UI while migrating behavior.
- Prefer migrating one coherent behavior surface at a time instead of a large rewrite.
- Preserve existing Chinese user-facing copy.
- Keep current Express API routes and response contracts unchanged unless a separate PRD explicitly changes them.

## Requirements

- Migrate the selected shell/navigation/page-route slice from `src/docker/webui/app-*.js` into Vue components/composables.
- Keep the selected slice documented here before coding.
- Preserve current Docker WebUI route URLs and deep-link behavior.
- Preserve login/session behavior and protected page handling.
- Preserve existing CSS variables/classes unless a component genuinely needs scoped styling.
- Keep Vue/Vite dependencies in `devDependencies`; runtime Docker image must serve built static assets only.
- Keep legacy modules in place until their behavior is fully replaced and verified.
- Update or add contract tests where build, routing, or behavior boundaries change.

## Selected MVP Scope

Migrate a narrow UI behavior slice first:

1. Extract shell/navigation state from legacy DOM helpers into Vue-owned state.
2. Move route/page selection into Vue while preserving `DOCKER_WEBUI_PAGE_ROUTES`.
3. Keep data-fetching/task actions in legacy modules for the first second-stage slice unless needed by the shell migration.
4. Leave task forms, tables, logs, and resource actions as legacy behavior until later slices.

This keeps the first second-stage task focused on Vue ownership of page structure and navigation, not every WebUI workflow.

## Acceptance Criteria

- [x] The task migrates the shell/navigation/page-route slice documented above.
- [x] The migrated slice is represented by Vue SFCs and/or composables under `src/docker/webui-src/`.
- [x] Existing WebUI routes still return the Vue shell and navigate correctly.
- [x] Login and auth status checks still work.
- [x] Legacy modules that remain transitional are still bundled in the required order.
- [x] `npm run lint`, `npm run type-check`, and `npm test` pass.
- [x] Docker image build remains valid after the migration slice.

## Definition of Done

- The selected slice no longer depends on duplicate legacy DOM ownership.
- Remaining legacy modules are explicitly documented as transitional.
- Specs are updated if a new Vue migration pattern or boundary is established.
- Docker runtime still has no Vite dev server or frontend build tooling dependency.

## Out of Scope

- Replacing all `app-*.js` modules in one pass.
- Migrating data fetching, task actions, form rendering, table rendering, logs, or resource actions beyond what is necessary to integrate navigation state.
- Adding Pinia, Vue Router, Vuetify, Tailwind, or another UI framework.
- Changing Express API contracts.
- Redesigning page visuals.
- Publishing Docker images.

## Technical Notes

- Relevant current files:
  - `src/docker/webui-src/App.vue`
  - `src/docker/webui-src/main.ts`
  - `src/docker/webui-src/index.html`
  - `src/docker/webui/*.js`
  - `src/docker/webui.ts`
  - `src/docker/server-webui-routes.ts`
  - `vite.config.ts`
- Relevant specs:
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/state-management.md`
  - `.trellis/spec/frontend/type-safety.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/backend/directory-structure.md`
  - `.trellis/spec/guides/docker-webui-auth-contract.md`
