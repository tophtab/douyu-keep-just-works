# Rename Docker WebUI Source Directory

## Goal

Rename the Docker WebUI Vue/Vite source directory from `src/docker/webui/` to `src/docker/webui/` now that the former legacy `app-*.js` source layer has been removed. Keep the Docker build output at `build/docker/docker/webui/` and preserve all runtime behavior.

## What I already know

* The user confirmed they want the rename after asking whether `webui` can become `webui`.
* Vue/Vite does not require a source directory named `webui`; the Vite root can point at `src/docker/webui`.
* The previous project convention used `webui` to avoid confusion with the old legacy `src/docker/webui/app-*.js` source directory.
* That legacy source directory has now been removed; `src/docker/webui` can be reclaimed as the Vue source directory if specs and tests are updated.
* Build output must remain `build/docker/docker/webui/`.

## Assumptions

* This is a path-only/source-layout migration, not a UI behavior change.
* Existing legacy bridge TypeScript files may keep their `legacy*` names for compatibility concepts; only the directory changes.
* The old legacy JavaScript files such as `app.js`, `app-actions.js`, and `app-task-pages.js` must remain deleted.

## Requirements

* Move all files under `src/docker/webui/` to `src/docker/webui/`.
* Update Vite, TypeScript, ESLint, tests, docs, and Trellis specs to use `src/docker/webui/` as the Docker WebUI source directory.
* Preserve Vite output at `build/docker/docker/webui/`.
* Update contract tests so they assert the Vue source directory exists at `src/docker/webui/` and the former legacy `app-*.js` files remain absent.
* Remove stale `webui` references from active project docs/specs/tests.
* Keep runtime behavior, routes, API contracts, Chinese UI copy, and Docker build semantics unchanged.

## Acceptance Criteria

* [x] `src/docker/webui-src/` no longer exists.
* [x] `src/docker/webui/` contains the Vue/Vite source files, including `index.html`, `main.ts`, `App.vue`, components, styles, and composables.
* [x] `vite.config.ts` uses `src/docker/webui` as the root while building to `build/docker/docker/webui`.
* [x] `tsconfig.webui.json` includes `src/docker/webui/**/*.ts`, `*.vue`, and `*.d.ts`.
* [x] Contract tests and specs reflect the new source directory and continue forbidding the old legacy `app-*.js` modules.
* [x] `npm run lint`, `npm run type-check`, `npm run test:contracts`, and `npm test` pass.

## Definition of Done

* The rename is committed as a coherent source-layout change.
* The working tree is clean after verification and Trellis wrap-up.
* No generated build output is committed.

## Out of Scope

* Changing UI behavior or visual design.
* Removing TypeScript compatibility bridge names.
* Changing Docker runtime output paths or Express static serving paths.
* Publishing Docker images.

## Technical Notes

* Task directory: `.trellis/tasks/05-13-rename-docker-webui-source-dir`
* Directly impacted files discovered by scan:
  * `vite.config.ts`
  * `tsconfig.webui.json`
  * `tsconfig.docker.json`
  * `eslint.config.mjs`
  * `CONTRIBUTING.md`
  * `test/request-smoothing-contract.test.js`
  * `test/project-maintenance-contract.test.js`
  * `.trellis/spec/frontend/*`
  * `.trellis/spec/backend/directory-structure.md`
  * `.trellis/spec/guides/docker-*.md`
