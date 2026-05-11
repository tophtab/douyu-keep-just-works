# Fix WebUI refresh tab and startup fan sync

## Goal

Improve Docker WebUI refresh behavior so reloading a deep-linked page, especially `/Configurations/ExpiringGiftConfig`, does not briefly show the overview page, and reduce avoidable Douyu requests during F5 initialization.

## What I already know

* The user observed that F5 on `/Configurations/ExpiringGiftConfig` briefly shows the overview page, including the "粉丝牌列表正在更新" loading state, before returning to the expiring gift page.
* The WebUI serves the same HTML shell for every Docker UI page route.
* The static HTML marks the overview tab and overview page active by default.
* Client state derives `activeTab` from `window.location.pathname`, but the actual UI tab switch currently happens after protected data initialization.
* F5 initialization currently loads local data first: `/api/config/raw`, `/api/overview`, `/api/logs`.
* If CookieCloud is enabled, startup may sync CookieCloud before Douyu requests.
* Before this change, startup called `POST /api/fans/reconcile`, which fetched the Douyu fans list and reconciled local task room config.
* Before this change, startup then called `GET /api/fans/status`, which could fetch Douyu fans list, gift/backpack status, and double card status when the five-minute status cache missed.
* `reconcile` and `status` overlap on the fans list request. `reconcile` does not check double card status; it only uses the fans list to align local task config.

## Assumptions (temporary)

* Deep-link refresh should keep the user visually on the requested page as early as possible.
* F5 should avoid doing configuration reconciliation unless it is needed for correctness.
* Status display can continue to use the existing status cache semantics unless the implementation finds a low-risk improvement.

## Decisions

* F5 startup skips automatic `POST /api/fans/reconcile`; reconciliation remains on explicit sync and save flows that need config alignment.
* Fans-list fetching uses a dedicated short TTL cache around `getFansList(cookie)`, shared by `/api/fans`, `/api/fans/reconcile`, and `/api/fans/status`.
* The no-overview-flash fix uses early client-side tab activation, keeping `getHtml()` route-agnostic.
* Current iteration scope is Approach A plus the light part of Approach B: frontend request gating/stale rendering, plus separating ordinary status refresh from explicit fan/config synchronization.
* The toolbar has separate actions: status refresh uses read-only status/list endpoints, while "同步粉丝牌/任务配置" is the only toolbar action that calls `POST /api/fans/reconcile`.

## Research References

* [`research/frontend-request-smoothing.md`](research/frontend-request-smoothing.md) — Client-side stale UI cache, request dedupe, intent-aware refresh, and progressive status rendering are the main viable ways to reduce Douyu-backed request pressure while keeping the WebUI responsive.

## Open Questions

* None for the selected MVP; implementation can proceed.

## Candidate Approaches

**Approach A: Client request gate + stale UI cache** (Recommended MVP)

* Keep last successful data visible while a background refresh runs.
* Deduplicate in-flight frontend requests by resource.
* Add short TTL/cooldown for automatic refresh and repeated clicks.
* Use latest-request guards so slow responses cannot overwrite newer state.
* Decision for this iteration: implement Approach A.

**Approach B: Split refresh from reconciliation**

* Treat visible "刷新" as status refresh.
* Keep room/config reconciliation on explicit sync, save, or a clearly labeled "同步粉丝牌/任务配置" action.
* Avoid side-effecting `/api/fans/reconcile` for plain visual refresh.
* Decision for this iteration: implement the light B split without redesigning all task-page controls.

**Approach C: Progressive status API**

* Render list/config rows first.
* Load gift and double-card details as a second phase.
* Consider backend concurrency limits for per-room Douyu checks.

## Requirements (evolving)

* Reloading any known WebUI route should not flash the overview tab/page before switching to the requested route.
* Reloading `/Configurations/ExpiringGiftConfig` should not show overview fans loading text as an intermediate visual state.
* Startup fan/config synchronization should avoid redundant Douyu fans-list requests where possible.
* F5 startup should not run `getFansList(cookie)` multiple times in the same initialization path when the first result can be avoided or reused.
* Fans-list fetching should have a short TTL/pending-request reuse mechanism that can serve both config reconciliation and status display without caching task-reload side effects.
* The distinction between config reconciliation and status display should remain clear in code and behavior.
* Frontend should avoid duplicate status/list requests from tab switches, startup lazy loads, double clicks, and overlapping refresh paths.
* Frontend should keep the last successful table/list visible during refresh instead of blanking the page for avoidable loading states.
* Manual refresh should stay possible, but repeated clicks while the same resource is loading should not create request bursts.
* Ordinary toolbar refresh should be status/list-only and must not call `/api/fans/reconcile`.
* Explicit toolbar sync should remain available for aligning medal rooms with keepalive, double-card, and expiring-gift task config.

## Acceptance Criteria (evolving)

* [x] F5 on `/Configurations/ExpiringGiftConfig` initially presents the expiring gift page, not the overview page.
* [x] F5 on other deep-linked pages presents the matching page without an overview flash.
* [x] Startup no longer performs an unconditional Douyu fans-list request solely for config reconciliation.
* [x] F5 startup does not call both `POST /api/fans/reconcile` and uncached `GET /api/fans/status` in a way that repeats `getFansList(cookie)` unnecessarily.
* [x] Consecutive fans-list consumers within the configured TTL reuse the same fans-list result unless a cookie/config change invalidates it.
* [x] Fans status display still works on overview and expiring gift pages.
* [x] Existing manual sync/save flows continue to reconcile room config correctly.
* [x] Automatic tab/lazy-load paths reuse recent frontend data instead of issuing duplicate HTTP requests.
* [x] Repeated manual refresh clicks while fans status is loading issue at most one active `/api/fans/status` request from the browser.
* [x] Fans/overview pages preserve the last successful visible rows while a background refresh is pending.
* [x] Late responses from older refreshes cannot overwrite newer status in the UI.
* [x] Ordinary toolbar refresh no longer calls side-effecting `POST /api/fans/reconcile`.
* [x] A separate toolbar sync action still reconciles fan medals with task room config.

## Definition of Done

* Tests added/updated where practical.
* Lint/typecheck pass.
* Behavior verified against the affected WebUI refresh path.
* Notes updated if this changes user-visible refresh/sync semantics.

## Out of Scope

* Redesigning the task configuration model.
* Changing Douyu API parsing unrelated to startup refresh behavior.
* Changing CookieCloud sync behavior except as needed for startup ordering.
* Progressive list-then-detail status loading.
* Backend double-card status fan-out throttling.

## Technical Notes

* Relevant route map: `src/docker/html.ts` `DOCKER_WEBUI_PAGE_ROUTES`.
* Static overview active state is in `src/docker/html.ts` around the tab markup and `page-overview` section.
* Startup protected loading is in `loadProtectedData()`.
* `syncConfigWithFans()` calls `getCachedFansList(cookie)` then `reconcileDockerConfig(...)`, invalidating fans status cache while leaving the short-lived fans-list cache available for immediate reuse.
* `fetchFansStatus()` uses cached status, and on cache miss calls `getCachedFansList(...)`, `getGiftStatus(...)`, and per-room `checkDoubleCard(...)`.
* Frontend request smoothing now keeps per-resource metadata for fans sync, fans list, fans status, and yuba status in `src/docker/html.ts`.
* Automatic frontend reads use a 30-second fresh-data window before issuing another browser request; manual refresh and task-trigger reloads can force a refresh while still reusing an in-flight request.
* The global refresh button is disabled while the visible tab's backing resource is already loading, preventing click bursts.
* The toolbar sync button calls `syncFansAndRefresh()`; ordinary `refreshOverviewSurface()` only calls read-only status/list APIs for the current page.
* Existing rows stay visible during background fans/yuba/list refreshes when a previous successful snapshot exists.
* Candidate no-flash fixes:
  * Early client-side fix: after DOM helpers and auth state are initialized, call `setActiveTab(state.activeTab, { syncPath: false })` before protected data requests complete, or hide the app shell until this activation happens.
  * Server-side fix: pass the request path into `getHtml()` and render matching active tab/page markup from the server.
  * Recommended first pass: early client-side fix. It is lower-risk and avoids making the HTML template request-aware.
* Candidate fan-sync fixes:
  * Remove automatic `syncFans(false)` from `loadProtectedData()` and leave reconciliation to explicit sync/save flows.
  * If startup still needs status display, call `loadFansStatus(false)` directly for pages that need it, relying on the existing five-minute status cache.
  * If a combined sync-and-status flow is later needed, reuse the fans returned by `reconcile` instead of calling `getFansList(cookie)` again.
  * Add a dedicated short-lived fans-list cache around `getFansList(cookie)` rather than caching the full `/api/fans/reconcile` result. `reconcile` has side effects (config save/task reload), so caching the full endpoint could accidentally skip necessary reconciliation. Caching the source fans list lets `reconcile` still recompute against the latest local config while avoiding duplicate Douyu fans-list requests.
