# Unify Default Config Source

## Goal

Make `src/core` the single source of truth for default Docker/WebUI task configuration. Runtime user config remains independent and must not be overwritten by default changes, while WebUI fallback defaults and `config.example.json` must be derived from or checked against the core defaults.

## What I Already Know

* The user wants `src/core` to be the only default configuration source.
* `config/config.json` is runtime user state and must remain separate from defaults.
* Existing runtime load/save already normalizes saved config via `normalizeDockerConfig`.
* Existing WebUI fallback defines `DEFAULT_RAW_CONFIG` by hand in `src/docker/webui/resource-config.ts`.
* Existing `config.example.json` is hand-written and drifted from `DEFAULT_KEEPALIVE_CRON`.
* Current core defaults live in `src/core/task-defaults.ts` and default config factories live in `src/core/medal-sync.ts`.

## Requirements

* Preserve `config/config.json` as user-owned runtime configuration.
* Do not overwrite existing user cron/active settings when default values change.
* Use core default factories/constants as the source for default WebUI raw config.
* Keep double-card task disabled by default.
* Remove the hand-written WebUI `DEFAULT_RAW_CONFIG` object.
* Expose a browser-safe core default raw config factory for WebUI fallback use.
* Make `config.example.json` match core defaults.
* Add automated coverage so sample/default drift is caught.
* Keep implementation scoped to Docker runtime/WebUI config behavior.

## Acceptance Criteria

* [x] When `/api/config/raw` has no saved config, WebUI falls back to the same default object produced from `src/core`.
* [x] WebUI does not maintain a separate hand-written default config object.
* [x] Double-card task defaults to disabled in raw defaults, fan-reconciled defaults, and the example config.
* [x] `config.example.json` uses `0 0 8 */7 * *` for keepalive and otherwise remains aligned with core default cron values.
* [x] Existing saved config remains the source of truth when present.
* [x] Tests fail if `config.example.json` cron defaults drift from `src/core/task-defaults.ts`.
* [x] Lint, type-check, and contract tests pass.

## Out of Scope

* Changing the user's current `config/config.json`.
* Migrating saved user cron values from older defaults.
* Redesigning all task page local default field initialization.
* Changing scheduling semantics beyond default source consolidation.

## Technical Notes

* Likely files:
  * `src/core/medal-sync.ts`
  * `src/docker/server-config-routes.ts`
  * `src/docker/webui/resource-config.ts`
  * `config.example.json`
  * `test/project-maintenance-contract.test.js`
* Existing route `/api/config/raw` returns `{ exists: false }` when no config exists; WebUI can keep that response shape and use the shared core default factory locally.
* Existing tests already assert no re-export of `DEFAULT_RAW_CONFIG`; extend them to assert the WebUI fallback no longer declares it and example defaults match core.

## Definition of Done

* Tests added/updated.
* Lint/typecheck/contracts pass or any blocker is documented.
* No user-owned config file is changed.
