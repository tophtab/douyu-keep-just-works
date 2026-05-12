# split remaining large files

## Goal

Split the remaining oversized Docker runtime, Docker server, WebUI, and Yuba source files into smaller responsibility-focused modules without changing runtime behavior, API contracts, WebUI routes, or task semantics.

## What I already know

* The user reviewed large files and asked to continue splitting them.
* Current large files include `src/docker/runtime.ts`, `src/docker/server.ts`, `src/docker/webui/app.js`, `src/docker/webui/app-actions.js`, `src/docker/webui/app-pages.js`, and `src/core/yuba.ts`.
* `src/docker/webui.ts` injects WebUI scripts in a fixed order, so any new browser script file must be added before its consumer.
* Backend and current Docker WebUI guidelines say Docker WebUI is the supported UI and script/style ordering is part of the contract.

## Requirements

* Preserve behavior while reducing large-file responsibilities.
* Split `src/docker/runtime.ts` around cookie source handling, cache/status snapshots, scheduler/task execution, and app context assembly.
* Split `src/docker/server.ts` around auth/session helpers and route registration groups.
* Split WebUI client code only where the resulting script order remains explicit and readable.
* Split `src/core/yuba.ts` only if it can be done cleanly while preserving public exports.
* Keep existing API paths, response shapes, route auth behavior, task names, log messages, and cron scheduling semantics unchanged.
* Prefer conservative module boundaries over speculative abstractions.

## Acceptance Criteria

* [ ] No intended behavior changes.
* [ ] Large files are reduced by moving cohesive responsibilities into adjacent modules.
* [ ] Existing imports compile after the split.
* [ ] WebUI script injection order includes any new browser modules before consumers.
* [ ] Project lint/type-check/build checks pass using the existing scripts.

## Out of Scope

* Redesigning the WebUI or changing visible copy.
* Changing Docker config schema or API response formats.
* Adding new dependencies.
* Replacing the current plain JavaScript WebUI architecture with a framework.

## Technical Notes

* Relevant guidelines: `.trellis/spec/backend/index.md`, `.trellis/spec/frontend/index.md`, `.trellis/spec/guides/index.md`.
* Current WebUI split already includes `app-data.js`, `app-routing.js`, `app-dom.js`, `app-render.js`, `app-pages.js`, `app-actions.js`, `app-task-actions.js`, and `app.js`.
* This is primarily a separation-of-concerns refactor; validation should focus on TypeScript compile, script ordering, and route/runtime contract preservation.
