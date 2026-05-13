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

* Migrate responsibilities currently owned by the legacy runtime into Vue first, then remove the bridge layer after Vue owns the behavior.
* Vue is the only frontend runtime started from `main.ts`; `startLegacyApp()` is removed.
* `window.DOUYU_KEEP_WEBUI_*` bridge installers are removed where their only purpose is legacy app compatibility.
* Page composables own their own loading, save, trigger, and refresh flows through `requestJson` and shared Vue helpers.
* Cross-page shared state is promoted to top-level Vue composables only when multiple pages or toolbar refresh need it.
* Request coalescing / stale-response protection remains for fans, yuba, and other expensive resources currently protected by legacy resource request state.
* Existing accessibility and component structure remain Vue-based and do not reintroduce imperative DOM rendering.
* Contract tests are updated from "legacy bridge exists" to "Vue-only runtime exists and legacy bridge is absent".

## Acceptance Criteria

* [x] `src/docker/webui/main.ts` mounts Vue without installing legacy bridges or starting `startLegacyApp()`.
* [x] No production WebUI module exports `installLegacy*Bridge()` or registers `window.DOUYU_KEEP_WEBUI_*` except bootstrap data that is still required by `index.html`.
* [x] Legacy-only modules such as `legacy-app.ts`, `legacy-core.ts`, `legacy-state.ts`, `pages.ts`, `task-pages.ts`, and `actions.ts` are removed or made unnecessary.
* [x] `resources.ts` no longer contains legacy bridge action factories and is either small or split into Vue-only resource composables.
* [x] Auth, navigation, theme, overview refresh, logs, cookie config, collect/yuba/keepalive/double/expiring task pages continue to type-check and build.
* [x] Contract tests cover the new Vue-only ownership and fail if legacy bridge registration returns.
* [x] `npm run type-check:webui`, `npm run lint`, and relevant contract/build tests pass.

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

Use Approach A, with the user-confirmed migration order: move responsibilities into Vue first, then delete the compatibility bridges. Implement it in small internal slices:

1. Make `main.ts` Vue-only and identify all compile failures.
2. Move auth/unauthorized/refresh responsibilities currently waiting on `legacyReady` into Vue-owned composables.
3. Replace legacy resource request state with Vue/shared composable request coalescing.
4. Remove legacy modules and bridge event contracts that are no longer used.
5. Rewrite contract tests to assert the Vue-only runtime and no legacy bridge registration.

## Decision (ADR-lite)

**Context**: The WebUI migration to Vue left a transitional runtime where Vue components and legacy imperative bridge modules both participate in state, refresh, and action flows. This keeps files such as `resources.ts` large and makes the frontend harder to reason about.

**Decision**: Migrate the remaining runtime responsibilities into Vue composables first, then remove the compatibility bridge modules and `startLegacyApp()` once Vue owns the behavior.

**Consequences**: The implementation will be larger than a file split, but it removes the migration layer instead of preserving it. Contract tests must change from asserting bridge presence to asserting a Vue-only runtime and preventing bridge registration from returning.

## Implementation Plan

1. Move global runtime ownership to Vue:
   * Make auth readiness, unauthorized handling, top-level refresh, and active-page lazy loading Vue-owned.
   * Keep user-facing behavior stable while removing `legacyReady` dependencies.
2. Move shared resources to Vue:
   * Create Vue-owned resource/composable helpers for raw config, overview, logs, fans list/status, yuba status, and request coalescing.
   * Wire toolbar refresh and page refresh flows to those helpers.
3. Remove bridge/runtime code:
   * Delete `startLegacyApp()` usage and bridge installers from `main.ts`.
   * Remove legacy-only modules after no production imports remain.
4. Update contracts and specs:
   * Rewrite WebUI maintenance contracts for Vue-only runtime.
   * Update frontend specs that currently describe bridge preservation as a maintained convention.
5. Verify:
   * Run WebUI type-check, lint, contract tests, and Docker/WebUI build checks.

## Out of Scope

* Redesigning the visual UI.
* Changing backend Docker API route semantics.
* Adding Pinia/Vuex/React Query/SWR or another global state dependency.
* Reworking unrelated backend runtime scheduling behavior.
