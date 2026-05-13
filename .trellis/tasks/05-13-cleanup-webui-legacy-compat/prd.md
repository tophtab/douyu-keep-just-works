# Cleanup WebUI Legacy Compatibility Layer

## Goal

Remove the Docker WebUI migration compatibility layer and make Vue the single owner of the frontend runtime, page state, resource loading, refresh behavior, and user actions. The goal is to reduce complexity, stop carrying transitional bridge code, and make large files such as `resources.ts` shrink because they no longer need to support both Vue and the old imperative app.

## What I Already Know

* The user wants migration-period compatibility/adaptation code cleaned up instead of preserved.
* The user prefers moving compatible/adapted behavior into Vue wherever possible.
* `src/docker/webui/main.ts` currently installs many `installLegacy*Bridge()` modules, mounts Vue, and then calls `startLegacyApp()`.
* `src/docker/webui/resources.ts` is large because it contains Vue log state plus legacy system/fans/resource action bridges.
* Legacy-related WebUI files total about 5,677 physical lines across modules that reference `DOUYU_KEEP_WEBUI`, `installLegacy`, `Legacy*`, `startLegacyApp`, or `useLegacyPageEvents`.
* Current contract tests explicitly assert that the bridge layer exists, so this task must update those tests to make Vue-only ownership the maintained contract.

## Assumptions

* We should remove legacy runtime behavior, not merely move it into smaller `legacy-*` files.
* Existing user-facing WebUI behavior should remain intact: auth, navigation, overview refresh, cookie config, task config pages, yuba status, logs, toasts, and unauthorized handling.
* Backend API contracts should remain unchanged unless implementation discovers a small frontend-only helper endpoint gap.
* No new state library should be introduced; Vue refs/computed/composables remain the state pattern.

## Requirements

* Vue is the only frontend runtime started from `main.ts`; `startLegacyApp()` is removed.
* `window.DOUYU_KEEP_WEBUI_*` bridge installers are removed where their only purpose is legacy app compatibility.
* Page composables own their own loading, save, trigger, and refresh flows through `requestJson` and shared Vue helpers.
* Cross-page shared state is promoted to top-level Vue composables only when multiple pages or toolbar refresh need it.
* Request coalescing / stale-response protection remains for fans, yuba, and other expensive resources currently protected by legacy resource request state.
* Existing accessibility and component structure remain Vue-based and do not reintroduce imperative DOM rendering.
* Contract tests are updated from "legacy bridge exists" to "Vue-only runtime exists and legacy bridge is absent".

## Acceptance Criteria

* [ ] `src/docker/webui/main.ts` mounts Vue without installing legacy bridges or starting `startLegacyApp()`.
* [ ] No production WebUI module exports `installLegacy*Bridge()` or registers `window.DOUYU_KEEP_WEBUI_*` except bootstrap data that is still required by `index.html`.
* [ ] Legacy-only modules such as `legacy-app.ts`, `legacy-core.ts`, `legacy-state.ts`, `pages.ts`, `task-pages.ts`, and `actions.ts` are removed or made unnecessary.
* [ ] `resources.ts` no longer contains legacy bridge action factories and is either small or split into Vue-only resource composables.
* [ ] Auth, navigation, theme, overview refresh, logs, cookie config, collect/yuba/keepalive/double/expiring task pages continue to type-check and build.
* [ ] Contract tests cover the new Vue-only ownership and fail if legacy bridge registration returns.
* [ ] `npm run type-check:webui`, `npm run lint`, and relevant contract/build tests pass.

## Definition of Done

* Tests added or updated for the new WebUI runtime contract.
* Lint, type-check, and build/test quality gates pass.
* Trellis frontend specs are updated if the maintained convention changes from transitional bridge support to Vue-only runtime.
* Risky behavior changes are called out before implementation finishes.

## Technical Notes

* Relevant source:
  * `src/docker/webui/main.ts`
  * `src/docker/webui/App.vue`
  * `src/docker/webui/auth.ts`
  * `src/docker/webui/navigation.ts`
  * `src/docker/webui/overview.ts`
  * `src/docker/webui/resources.ts`
  * `src/docker/webui/request.ts`
  * `src/docker/webui/task-shared.ts`
  * `src/docker/webui/cookie.ts`
  * `src/docker/webui/collect.ts`
  * `src/docker/webui/keepalive.ts`
  * `src/docker/webui/double.ts`
  * `src/docker/webui/expiring.ts`
  * `src/docker/webui/yuba.ts`
  * `src/docker/webui/legacy-app.ts`
  * `src/docker/webui/legacy-core.ts`
  * `src/docker/webui/legacy-state.ts`
  * `src/docker/webui/pages.ts`
  * `src/docker/webui/task-pages.ts`
  * `src/docker/webui/actions.ts`
  * `src/docker/webui/task-actions.ts`
* Relevant tests:
  * `test/project-maintenance-contract.test.js`
  * `test/request-smoothing-contract.test.js`
* Relevant specs:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/directory-structure.md`
  * `.trellis/spec/frontend/hook-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/type-safety.md`
  * `.trellis/spec/frontend/quality-guidelines.md`

## Feasible Approaches

### Approach A: Vue-only runtime in one cleanup pass (recommended)

Remove the legacy app and bridge registrations now, then move any remaining cross-page responsibilities into Vue composables. Update contract tests in the same task.

Pros: reaches the user's desired end state directly; removes the biggest complexity source; prevents bridge code from continuing to grow.
Cons: larger diff; needs careful regression checking across every WebUI page.

### Approach B: Resource layer first, app bridge later

First migrate `resources.ts`, fans/yuba request tracking, overview refresh, and logs to Vue-only ownership while keeping `startLegacyApp()` temporarily.

Pros: smaller first step; lower immediate risk.
Cons: preserves the transitional runtime and much of the mental overhead; likely leaves many bridge modules alive.

### Approach C: Delete legacy modules aggressively, then repair compile/test failures

Remove bridge modules and adapt the remaining Vue composables based on type/test failures.

Pros: fast discovery of hidden dependencies.
Cons: riskier and messier; can obscure intended data-flow design.

## Recommended Direction

Use Approach A, but implement it in small internal slices:

1. Make `main.ts` Vue-only and identify all compile failures.
2. Move auth/unauthorized/refresh responsibilities currently waiting on `legacyReady` into Vue-owned composables.
3. Replace legacy resource request state with Vue/shared composable request coalescing.
4. Remove legacy modules and bridge event contracts that are no longer used.
5. Rewrite contract tests to assert the Vue-only runtime and no legacy bridge registration.

## Out of Scope

* Redesigning the visual UI.
* Changing backend Docker API route semantics.
* Adding Pinia/Vuex/React Query/SWR or another global state dependency.
* Reworking unrelated backend runtime scheduling behavior.
