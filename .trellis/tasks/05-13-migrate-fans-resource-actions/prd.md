# Migrate fans resource actions to Vue composable

## Goal

Move Docker WebUI fans resource loading out of the legacy browser module and into the Vue/TypeScript source layer, while preserving the existing request smoothing, refresh, task-page, and status update behavior.

## What I already know

* User reported that fans resources are still legacy and specifically named `syncFans`, `loadFansList`, and `loadFansStatus`.
* `src/docker/webui/app-fans-resource-actions.js` still owns those three functions.
* `src/docker/webui-src/resources.ts` currently owns system resources but not fans resources.
* Vue task pages (`keepalive.ts`, `double.ts`, `expiring.ts`, `collect.ts`) still receive `loadFansStatus` through legacy deps.
* `src/docker/webui/app-resource-actions.js`, `app-actions.js`, and `app.js` consume the fans actions through `window.DOUYU_KEEP_WEBUI_*` bridges.
* Existing tests still assert the legacy fans module shape, so tests need to move with the implementation.

## Assumptions

* The migration should keep the transitional legacy bridge shape so the remaining legacy modules can still call `syncFans`, `loadFansList`, and `loadFansStatus`.
* No backend API change is required.
* `app-fans-resource-actions.js` should stop owning the implementation and can be removed from the Vite bootstrap order if no longer referenced.

## Requirements

* Implement fans resource actions in Vue/TypeScript, preferably near `resources.ts` as a composable/bridge-compatible module.
* Preserve behavior for:
  * missing cookie source handling and toast text
  * duplicate request coalescing via existing legacy `resourceRequests`
  * stale request sequence guards
  * fans list loading and managed fans updates
  * fans status base/details two-step loading
  * unauthorized handling
  * refresh and task-page re-render dispatches
* Wire the new TypeScript implementation into `app-resource-actions.js` / `main.ts` so legacy callers continue to work while implementation lives under `webui-src`.
* Update tests that currently require the implementation to live in `app-fans-resource-actions.js`.

## Acceptance Criteria

* [ ] `syncFans`, `loadFansList`, and `loadFansStatus` are implemented in `src/docker/webui-src/` TypeScript.
* [ ] `app-fans-resource-actions.js` no longer owns the fans resource implementation and is not imported by `main.ts`.
* [ ] Legacy callers still get compatible actions through `window.DOUYU_KEEP_WEBUI_RESOURCE_ACTIONS.create(...)`.
* [ ] Overview, keepalive, double-card, expiring-gift, and collect reload flows still call the migrated fans actions.
* [ ] Relevant contract tests pass after updating assertions for the new source location.
* [ ] `npm run typecheck` and targeted tests pass.

## Definition of Done

* Tests added/updated where the contract moved from legacy JS to TypeScript.
* Lint/typecheck/tests green for the touched area.
* Specs reviewed for whether this migration creates reusable guidance.

## Out of Scope

* Removing all remaining legacy modules.
* Rewriting task-page state management wholesale.
* Changing backend fans API routes or cache semantics.

## Technical Notes

* Relevant files inspected:
  * `src/docker/webui/app-fans-resource-actions.js`
  * `src/docker/webui-src/resources.ts`
  * `src/docker/webui-src/main.ts`
  * `src/docker/webui/app-resource-actions.js`
  * `src/docker/webui/app-actions.js`
  * `src/docker/webui/app.js`
  * `src/docker/webui/app-managed-data.js`
  * `src/docker/webui/app-state.js`
  * `src/docker/webui/app-task-pages.js`
  * `src/docker/webui-src/keepalive.ts`
  * `src/docker/webui-src/yuba.ts`
* Relevant specs:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/hook-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/type-safety.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/backend/directory-structure.md`
  * `.trellis/spec/backend/quality-guidelines.md`
