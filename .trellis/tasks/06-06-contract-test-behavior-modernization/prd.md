# contract test behavior modernization

## Goal

Continue contract-test modernization after the taxonomy task by replacing the noisiest implementation-shape checks with behavior-level tests and splitting broad mixed maintenance contracts without weakening durable guardrails.

## Background

* Commit `5b74733 test: document contract test taxonomy` added `.trellis/spec/backend/testing-guidelines.md`.
* The taxonomy defines `Guardrail`, `Behavior`, `Shape`, and `Mixed`.
* `test/project-maintenance-contract.test.js` now labels each `test(...)` block.
* The user wants this follow-up work completed in three slices in this same window:
  1. Config route behavior replacement.
  2. CookieCloud check/persist behavior replacement.
  3. Split broad Mixed maintenance blocks.

## Requirements

* Preserve all durable `Guardrail` contracts.
* Prefer route-level behavior tests through `createServer(ctx)` or module-level behavior tests through `loadTypeScriptModule(...)`.
* Replace or relax implementation-shape assertions only after equivalent behavior or narrower guardrail coverage exists.
* Do not change runtime behavior unless a behavior test exposes a real bug.
* Keep changes reviewable by committing logical slices when practical.

## Slice 1: Config Route Behavior Replacement

* Add behavior coverage for config mutation route contracts:
  * `/api/config` returns the success envelope for valid saves.
  * validation failures return `400` and do not call `saveTaskConfig`.
  * config mutation responses keep manual passport material masked.
* Relax or remove redundant source-shape assertions in `test/project-maintenance-contract.test.js` that only check route helper/import shape.

## Slice 2: CookieCloud Check/Persist Behavior Replacement

* Add behavior coverage for cookie-source route contracts:
  * `/api/cookie-source/check` calls `ctx.inspectCookieSource()` without force refresh.
  * `/api/cookie-source/persist` requires active CookieCloud.
  * active persist calls `ctx.persistEffectiveCookies(true)` and returns the expected envelope.
  * config/QR route error statuses stay behavior-covered where practical.
* Preserve source guardrails for runtime CookieCloud snapshot composition and local-only diagnostics where source structure is still the boundary.

## Slice 3: Split Broad Mixed Maintenance Blocks

* Split the broad Mixed WebUI maintenance block into smaller test blocks by category/concern without changing assertions:
  * Docker/Vite build and static serving guardrails.
  * Vue-only runtime and deleted legacy bridge guardrails.
  * WebUI module ownership/resource-shape checks.
* If needed, split other Mixed blocks only when it improves clarity without broad churn.
* Do not reorganize the whole test suite in this task.

## Acceptance Criteria

* [ ] Config route shape checks are reduced and equivalent route behavior tests exist.
* [ ] Cookie-source route shape checks are reduced and equivalent route behavior tests exist.
* [ ] At least the largest WebUI Mixed block is split into clearer focused test blocks.
* [ ] Durable source guardrails remain for forbidden legacy files, direct credential recovery, secret leakage, and Vue-only runtime boundaries.
* [ ] `npm run test:contracts` passes.
* [ ] `npm run lint` passes.
* [ ] `npm run type-check` passes.

## Out of Scope

* Browser or Playwright test infrastructure.
* Runtime behavior changes unrelated to a proven test failure.
* Dependency upgrades.
* Full rewrite of `test/project-maintenance-contract.test.js`.
* Labeling every contract test file.

## Technical Notes

* Primary files:
  * `test/server-route-guardrails-contract.test.js`
  * `test/project-maintenance-contract.test.js`
  * `.trellis/spec/backend/testing-guidelines.md`
* Existing helpers:
  * `test/helpers/typescript-module-loader.js`
  * `createServer(ctx)` from `src/docker/server.ts`
* Quality commands:
  * `npm run test:contracts`
  * `npm run lint`
  * `npm run type-check`
