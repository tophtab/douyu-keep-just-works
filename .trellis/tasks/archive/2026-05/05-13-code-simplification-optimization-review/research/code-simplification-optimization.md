# Code Simplification and Optimization Review

## Scope

Static review of the current Docker WebUI frontend and Docker/core backend. No implementation changes were made.

## Repository Shape

* Frontend: Vue/Vite Docker WebUI under `src/docker/webui-src/`.
* Backend: Docker Express runtime under `src/docker/`, shared Douyu logic under `src/core/`.
* Current source size for `src/core` plus `src/docker` excluding generated output is about 14k lines.
* Largest files are transitional WebUI orchestration/composables: `resources.ts`, `legacy-state.ts`, `yuba.ts`, `expiring.ts`, `double.ts`, `cookie.ts`.

## Frontend Findings

### 1. The Vue migration bridge is now the largest complexity source

`src/docker/webui-src/main.ts` installs 20 bridge modules in a strict order before mounting Vue and starting the transitional legacy app. `legacy-app.ts`, `legacy-state.ts`, `actions.ts`, `resources.ts`, `task-actions.ts`, `task-pages.ts`, and page composables communicate through window globals and document events.

Impact:

* High cognitive load: data ownership is split between Vue refs, legacy state objects, window bridges, and CustomEvent payloads.
* Hard to reason about lifecycle: one visible page can be updated through direct Vue refs, a page event, a config event, an overview event, or a legacy render function.
* Optimization ceiling: as long as the compatibility bridge remains central, many local refactors must preserve duplicate event and state paths.

Recommended direction:

* Treat bridge removal as the main frontend simplification epic.
* Complete ownership transfer page by page, then delete bridge layers in dependency order:
  1. `task-actions.ts` and legacy data-action trigger paths once all task buttons are Vue-owned.
  2. `task-pages.ts` once page state comes from composables/resources directly.
  3. `legacy-app.ts` after auth/navigation/resource orchestration no longer depends on window bridges.
  4. `legacy-core.ts` and `legacy-state.ts` last, after default config/state helpers move to typed modules.

### 2. Send-task composables have a repeated skeleton

`keepalive.ts`, `double.ts`, and `expiring.ts` repeat the same shape:

* local refs for `overview`, `rawConfig`, `managedConfig`, `fans`, loading flags, enabled flag, cron, model, fan rows
* config getter with defaults
* `applyRawConfig`
* `apply<Page>Detail`
* payload builder
* save / disable / trigger actions
* task card, note, empty text, table visibility, model-change handler
* legacy action installer

Impact:

* Good candidate for a shared `useAllocationTaskPage` or smaller helpers.
* Lowest-risk extraction is not one giant abstraction; extract the stable slices first:
  * shared managed fan state application
  * shared save/disable/trigger factory
  * shared note/empty-text helper for fan-list-backed pages
  * shared default/current-config resolution

Recommended direction:

* Phase 1: extract pure helpers that do not change Vue lifecycle.
* Phase 2: introduce a generic composable only for common allocation page mechanics.
* Keep task-specific logic local: double ratio tools, expiring backpack details, gift scope, validation copy.

### 3. Defaults and task metadata are duplicated across core, runtime, and frontend

Default cron/model/threshold values appear in:

* `src/core/medal-sync.ts`
* `src/docker/webui-src/legacy-core.ts`
* `src/docker/webui-src/collect.ts`
* `src/docker/webui-src/keepalive.ts`
* `src/docker/webui-src/double.ts`
* `src/docker/webui-src/expiring.ts`
* `src/docker/webui-src/yuba.ts`
* `src/docker/webui-src/cookie.ts`
* `src/docker/runtime.ts` for CookieCloud sync cron

Impact:

* Any default change requires broad manual search and contract updates.
* Frontend fallback defaults can drift from backend normalization.

Recommended direction:

* Export shared default constants from a small core module, or include defaults in a typed task metadata map that both backend and WebUI can import.
* Start with constants only; avoid moving behavior until defaults are unified.

### 4. CustomEvent event names and window global bridge keys are scattered

There are many `douyu-keep-webui:*` strings and `DOUYU_KEEP_WEBUI_*` globals spread across WebUI source.

Impact:

* Rename risk and typo risk remain high.
* The boot order in `main.ts` is fragile because bridge dependencies are implicit in module install order.

Recommended direction:

* Introduce a typed `webui-bridge-contract.ts` that centralizes event names and bridge keys while the legacy layer still exists.
* This is a short-term simplification that makes later bridge deletion safer.

### 5. Type safety is intentionally weakened around legacy bridges

Files such as `actions.ts` and `task-actions.ts` use `unknown`, `never`, and casts to bridge legacy dependency bags. This appears transitional but now creates a lot of noise.

Impact:

* Harder to refactor safely; TypeScript cannot fully validate bridge wiring.
* The code reads more complex than the real domain behavior.

Recommended direction:

* Do not over-invest in perfect bridge types if bridge removal is near-term.
* If bridge removal is not soon, extract shared `Legacy*Deps` interfaces so bridge casts collapse in one place.

## Backend Findings

### 1. Task metadata exists but is underused

`src/docker/task-metadata.ts` already centralizes `TaskType`, `TASK_TYPES`, labels, and config lookup. However task-specific branching is still manually repeated in:

* `server-task-routes.ts`
* `runtime-task-runners.ts`
* `runtime-scheduler.ts`
* `server-config-routes.ts`
* `runtime.ts`
* `config-store.ts`
* `core/medal-sync.ts`

Impact:

* Adding or changing a task means touching many switch/if sites.
* Some places are already metadata-driven (`reconcileTaskJobs`), while others duplicate the same task list manually.

Recommended direction:

* Expand `task-metadata.ts` into a typed descriptor table:
  * key
  * label
  * config getter
  * validator
  * trigger handler
  * scheduled runner
  * cache invalidation scope
  * overview summary fields, where practical
* Migrate one backend surface at a time to reduce risk.

### 2. Route boilerplate can be compressed safely

`server-fans-routes.ts`, `server-cookie-source-routes.ts`, and `server-task-routes.ts` repeat async try/catch response patterns with small differences in error classification.

Impact:

* Minor line count issue, but good maintainability win.
* Makes status code rules easier to audit.

Recommended direction:

* Introduce a local `jsonRoute` helper taking `{ run, classifyError }`.
* Keep the specialized classification functions, but remove repeated try/catch blocks.

### 3. Config validation and normalization duplicate task logic

`config-validation.ts` validates job-like tasks with some task-specific branches. `core/medal-sync.ts` normalizes/reconciles defaults and send maps with similar model/default logic, including separate keepalive/double/expiring paths.

Impact:

* This is a real drift risk because the UI, validation, normalization, and runtime allocation all need the same rules.
* The code has existing contract-guide pressure around allocation semantics, so repeated logic is particularly expensive.

Recommended direction:

* Extract shared allocation config helpers:
  * normalize model
  * normalize threshold
  * normalize send item
  * merge send config with task-specific default value strategy
  * validate send config with task-specific extras
* Keep task-specific config interfaces; only share the mechanics.

### 4. Gift allocation functions are async without awaiting and mutate input

`computeGiftCountOfNumber`, `computeGiftCountOfPercentage`, and `computeGiftCountOfProportion` are declared async and return `Promise.reject`, but do synchronous computation. Call sites deep-clone inputs before calling because the functions mutate send items.

Impact:

* Extra async mental overhead and repeated deep clone calls.
* Mutation makes call sites defensive and hides cost.

Recommended direction:

* Make allocation functions synchronous and pure, returning cloned objects.
* Delete `computeGiftCountOfPercentage` if contract tests confirm it is unused and no longer part of the supported model.
* Replace JSON clone calls in `job.ts` and `gift.ts` with internal cloning inside allocation helpers.

### 5. Core job execution has extractable repeated mechanics

`executeKeepaliveJob`, `executeDoubleCardJob`, and `executeExpiringGiftJob` share:

* load gift/backpack budget
* wait
* compute send counts by model
* assign gift id
* log target count
* call `sendGifts`

Impact:

* Current code is understandable, but repeated mechanics make feature additions harder.
* The best refactor is a small pure helper for "compute jobs by allocation model" and "send each gift group", not a sweeping rewrite.

Recommended direction:

* Extract `computeSendJobs(number, send, model)` after allocation helpers become pure.
* Extract gift group construction for glow-stick vs backpack gifts.
* Leave the task-specific logs and early exits in each task for readability.

## Cross-Layer Findings

### 1. Defaults should become a contract instead of duplicated literals

The strongest cross-layer simplification is a shared defaults/metadata contract. Backend normalization, WebUI fallback state, and legacy bootstrap currently each carry their own copies.

Recommended near-term contract:

* `src/core/task-defaults.ts` or expanded `src/docker/task-metadata.ts`
* WebUI imports defaults rather than hardcoding.
* Tests assert WebUI fallback defaults match backend defaults.

### 2. The task concept should be metadata-driven across layers

Task concepts are repeated in overview fields, triggers, scheduler, frontend tabs, and config forms. A task descriptor map would make "what tasks exist" explicit, while still preserving task-specific UI pages.

Recommended scope:

* Backend first: route/trigger/scheduler/status metadata.
* Frontend later: defaults/event names/page metadata, not full page rendering.

## Prioritized Plan

### P0: Low-risk cleanup

1. Centralize error/message helpers already repeated across backend files.
2. Centralize default cron/model/threshold constants.
3. Centralize WebUI bridge event names while bridge remains.
4. Convert gift allocation helpers to synchronous pure functions, with focused unit tests.

### P1: Medium-size simplification

1. Expand `task-metadata.ts` and use it for trigger routing and scheduler initialization/status maps.
2. Extract shared allocation-page helpers for keepalive/double/expiring Vue composables.
3. Extract async route wrapper for Express JSON routes.
4. Replace repeated save/disable/trigger blocks in task composables with a task action factory.

### P2: Larger cleanup

1. Continue Vue ownership migration and delete bridge modules once they are no longer needed.
2. Collapse `legacy-app.ts`, `legacy-state.ts`, `task-pages.ts`, and `task-actions.ts` after final migration.
3. Move remaining cross-layer task defaults/status summaries into a typed contract.

## Suggested Follow-Up Tasks

1. Centralize shared task defaults and add contract tests.
2. Purify gift allocation helpers and remove defensive JSON cloning.
3. Backend task metadata refactor for trigger routing and scheduler startup.
4. Frontend allocation task composable extraction for keepalive/double/expiring.
5. Vue bridge deletion roadmap and first deletion slice.

