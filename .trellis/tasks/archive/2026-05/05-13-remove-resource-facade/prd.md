# remove resource facade compatibility exports

## Goal

Remove the `resource-state.ts` compatibility re-export layer created in the previous refactor, update WebUI modules to import directly from the focused resource modules, and reduce avoidable code/import indirection while preserving current behavior.

## Requirements

* Keep `resource-state.ts` only for top-level overview/log/protected-data/refresh orchestration it actually owns.
* Stop exporting raw config, fans/gift, yuba, and request-resource helpers through `resource-state.ts`.
* Update WebUI imports to read directly from:
  * `resource-config.ts` for raw config/default config/cookie-source helpers.
  * `resource-fans.ts` for fans/gift/managed state and fans loaders.
  * `resource-yuba.ts` for yuba status state and loader.
  * `resource-state.ts` only for overview/log/refresh/protected-state orchestration.
* Remove or repoint the old `resources.ts` compatibility barrel if it only re-exports the facade.
* Update contract tests and specs so future work does not restore compatibility re-exports.

## Acceptance Criteria

* [x] No page/task module imports config/fans/yuba state from `resource-state.ts`.
* [x] `resource-state.ts` no longer re-exports focused resource module symbols.
* [x] `resources.ts` compatibility barrel is removed or no longer points at `resource-state.ts`.
* [x] Maintenance and request-smoothing contracts pass.
* [x] `npm run lint`, `npm run type-check`, and `npm test` pass.

## Implementation Summary

* Removed the compatibility export block from `resource-state.ts`.
* Updated WebUI modules to import raw config, fans/gift state, and yuba state directly from their owning `resource-*` modules.
* Deleted `src/docker/webui/resources.ts`, the old compatibility barrel.
* Updated frontend specs and maintenance contracts to prevent reintroducing resource facade re-exports.

## Verification

* [x] `npm run type-check`
* [x] `npm run test:contracts`
* [x] `npm test`
* [x] `npm run lint`

## Out of Scope

* Changing API routes, response shapes, task behavior, scheduling, or UI copy.
* Rewriting the remaining overview/log orchestration.
