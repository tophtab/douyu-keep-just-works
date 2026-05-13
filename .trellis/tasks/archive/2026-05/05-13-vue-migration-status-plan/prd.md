# Vue Migration Status Review

## Goal

Determine whether the Docker WebUI Vue migration is complete. If it is not complete, define a follow-up implementation plan. If it is complete, record the evidence and any remaining maintenance-only follow-up.

## Status Conclusion

The Vue migration appears complete in the current working tree.

The Docker WebUI is now built by Vite with Vue 3, mounted through `src/docker/webui/main.ts`, served as static assets from `build/docker/docker/webui`, and covered by a contract test that asserts the WebUI is Vue-only and that legacy bridge/runtime files stay deleted.

## What I Already Know

* `package.json` defines `build:webui` as `npm run type-check:webui && vite build`.
* `package.json` defines `type-check:webui` as `vue-tsc -p tsconfig.webui.json --noEmit`.
* `vite.config.ts` uses `@vitejs/plugin-vue`, roots the app at `src/docker/webui`, and outputs to `build/docker/docker/webui`.
* `src/docker/webui/` contains Vue SFCs for the shell and pages: `App.vue`, `AppShell.vue`, `OverviewPage.vue`, `LoginConfigPage.vue`, task pages, tables, controls, and shared components.
* `src/docker/webui/main.ts` mounts Vue with `createApp(App).mount('#app')`.
* `test/project-maintenance-contract.test.js` has a contract named `Docker WebUI is Vue-only and served as Vite static Docker assets`.
* Production WebUI source did not match legacy bridge/runtime markers such as `installLegacy`, `startLegacyApp`, `WEBUI_BRIDGE_EVENTS`, `bridge-contract`, `legacy-app`, or old `app-*.js` entries.
* The prior Trellis task directories related to Docker WebUI Vue migration are currently deleted in the working tree; I did not touch or restore those existing changes.

## Verification Performed

* `rg` scan for legacy bridge/runtime symbols in `src/docker/webui`, `src/docker`, `test`, `package.json`, and `vite.config.ts`.
* `npm run type-check:webui` passed.
* `npm run test:contracts` passed: 8 tests passing, including the Vue-only Docker WebUI contract.
* `npm run build:webui` passed and produced Vite assets under `build/docker/docker/webui`.
* `npm run build:docker` passed, including WebUI build and Docker-side TypeScript compilation.

## Requirements

* Treat the Vue migration itself as complete unless new evidence appears.
* Preserve the Vue-only contract test as the regression guard for future changes.
* Do not reintroduce the legacy WebUI bridge, old app entry files, or DOM action wiring.
* Any future WebUI work should build on the current Vue component/composable structure.

## Acceptance Criteria

* [x] Docker WebUI source is Vue-based and mounted through Vue.
* [x] Vite build pipeline is wired into Docker build flow.
* [x] Legacy WebUI bridge/runtime files are absent from production source.
* [x] Contract tests assert Vue-only status and legacy file deletion.
* [x] WebUI type-check passes.
* [x] WebUI production build passes.
* [x] Full Docker build passes.

## Definition of Done

* Tests added/updated where behavior changes.
* Lint / typecheck / CI green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope

* Reworking the current Vue UI design.
* Adding new Docker WebUI features.
* Restoring deleted Trellis task history.
* Changing current unrelated `.trellis/` working-tree modifications.

## Technical Notes

* Relevant source: `src/docker/webui/`, `src/docker/webui.ts`, `src/docker/server-webui-routes.ts`.
* Relevant build config: `package.json`, `vite.config.ts`, `tsconfig.webui.json`.
* Relevant regression coverage: `test/project-maintenance-contract.test.js`.
* Relevant specs if implementation resumes later: `.trellis/spec/frontend/index.md`, `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/state-management.md`, `.trellis/spec/frontend/type-safety.md`, `.trellis/spec/frontend/quality-guidelines.md`.

## Follow-Up Plan If Needed

No migration continuation plan is needed for the Vue migration itself. If the team wants extra confidence beyond the completed migration evidence, the next task should be a validation-only pass:

1. Smoke test the served WebUI routes in a container or local Docker runtime.
2. Optionally add a Playwright smoke test for login shell, overview, navigation, and one task config save flow.
