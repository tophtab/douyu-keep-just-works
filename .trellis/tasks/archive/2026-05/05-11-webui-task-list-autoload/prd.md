# Fix WebUI Task List Autoload

## Goal

Fix the Docker WebUI regression where keepalive and double-card pages can remain stuck at "正在准备加载粉丝牌列表，也可以点击刷新手动加载。" instead of automatically loading `/api/fans`.

## What I Already Know

* User confirms the current pushed version still gets stuck on first load for both double-card and keepalive task pages.
* The visible text proves cookies are considered configured and the page is in the task-list empty/not-loaded state.
* Current `src/docker/html.ts` uses `scheduleFansListEnsureForActiveTab()` with a zero-delay timer to call `ensureFansListForActiveTab()`.
* Current guards already distinguish empty `/api/fans/status` from loaded `/api/fans`, so the remaining defect is likely the deferred ensure not transitioning into `loadFansList()`.

## Requirements

* Entering keepalive or double-card with cookies configured, no visible rows, and no loaded fans-list snapshot must immediately trigger `loadFansList(false)`.
* The page should move from "正在准备加载..." to the existing loading state ("请稍候...") while `/api/fans` is in flight.
* Duplicate concurrent requests must still be prevented by the existing pending guard.
* Overview, expiring, yuba, logs, and manual refresh behavior must remain unchanged.

## Acceptance Criteria

* [ ] Initial load of `/Configurations/DailyJobConfig` triggers `/api/fans` when no rows are available.
* [ ] Initial load of `/Configurations/DoubleCardConfig` triggers `/api/fans` when no rows are available.
* [ ] Clicking the keepalive/double-card tabs from overview triggers `/api/fans` when no rows are available.
* [ ] `npm run lint`, `npm run type-check`, and `npm run build:docker` pass.

## Technical Notes

* Main file: `src/docker/html.ts`.
* Relevant contract: `.trellis/spec/guides/docker-medal-sync-contract.md`.
