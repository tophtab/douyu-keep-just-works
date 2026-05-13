# Remove Unused logs.ts

## Goal

Remove the unused `src/docker/webui-src/logs.ts` split attempt and keep the current Docker WebUI logs implementation in `resources.ts`, which is what `LogsPage.vue` imports today.

## What I Already Know

* `components/LogsPage.vue` imports `useLogsPage` from `../resources`.
* No runtime source imports `src/docker/webui-src/logs.ts`.
* `logs.ts` is still referenced by the WebUI contract test and frontend directory-structure spec.
* Keeping both files creates duplicate log loading/clearing logic and confusion.

## Requirements

* Delete `src/docker/webui-src/logs.ts`.
* Remove stale `logs.ts` references from frontend specs and contract tests.
* Preserve current logs behavior through `resources.ts`.
* Verify type-check, lint, and tests pass.

## Acceptance Criteria

* [ ] `src/docker/webui-src/logs.ts` is gone.
* [ ] `rg "from './logs'|from '../logs'|logs.ts|bindLegacyLogsBridge"` has no stale runtime/doc/test references.
* [ ] `npm run type-check:webui`, `npm run lint`, and `npm test` pass.

## Out of Scope

* Moving log logic out of `resources.ts`.
* Changing user-facing log page behavior.
