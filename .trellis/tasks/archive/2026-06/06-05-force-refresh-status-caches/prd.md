# Force Refresh Status Caches

## Goal

Make the WebUI refresh behavior match user expectations: automatic page loading should keep using runtime caches to avoid unnecessary Douyu requests, while the global top-right refresh button should force-refresh the active page's backend-backed data. Also preserve the Yuba JWT cookies that the live passport-to-Yuba SSO bridge returns, so the local Yuba cookie snapshot matches observed browser-relevant credentials more closely.

## What I Already Know

* The WebUI has 8 pages: overview, login, collect, keepalive, double-card, expiring-gift, yuba, and logs.
* Frontend code never calls Douyu directly. It calls local `/api/*` endpoints, and the Docker runtime decides whether to return cached data or call Douyu.
* The top-right refresh button currently calls `refreshOverviewSurface(activeTab, true)`.
* `refreshOverviewSurface` reloads config and overview, then reloads data for the active page:
  * overview / expiring-gift: fans status
  * keepalive / double-card: fans list
  * yuba: Yuba status
  * logs: logs
  * login / collect: overview only
* Runtime caches currently live in `DockerRuntimeCache`:
  * fans list: 60 seconds
  * fans status: 5 minutes
  * Yuba status: 10 minutes
* A normal `/api/yuba/status` request can return the cached Yuba snapshot for up to 10 minutes.
* Live QR login debugging showed the current Yuba status path works with the currently persisted Yuba fields (`acf_yb_auth`, `acf_yb_uid`, `acf_yb_t`, `acf_yb_new_uid`): 24/24 followed groups returned `isSigned > 0`.
* Live QR login debugging also showed `/ybapi/authlogin` returns `acf_jwt_token` and `acf_dmjwt_token`, but `src/core/douyu-passport.ts` currently drops them because they are not in `YUBA_RETURNED_COOKIE_KEYS`.

## Requirements

### Refresh Semantics

* Keep automatic page-load and tab-switch data loading cache-friendly.
* Change the top-right manual refresh action to force-refresh the active page's backend-backed data.
* Force-refresh must mean "invalidate the relevant Docker runtime cache before fetching the requested data", not only "send another frontend request".
* Keep pending-request smoothing: repeated clicks while a refresh is already running should not produce overlapping duplicate refreshes.
* Preserve existing success/error toasts and unauthorized handling patterns.

### Active Page Mapping

* `overview`
  * Reload config and overview.
  * Force-refresh fans status because the overview page displays fans, gift, and double-card status.
* `login`
  * Reload config and overview.
  * Do not force-refresh fans or Yuba status because login page has no status table.
* `collect`
  * Reload config and overview.
  * Do not force-refresh fans or Yuba status because collect page has no data table.
* `keepalive`
  * Reload config and overview.
  * Force-refresh fans list / fan-backed task surface so room rows are current.
* `double-card`
  * Reload config and overview.
  * Force-refresh fans list / fan-backed task surface so room rows and double allocation rows are current.
* `expiring-gift`
  * Reload config and overview.
  * Force-refresh fans status because the page displays backpack rows, gift expiry, and fan allocation rows.
* `yuba`
  * Reload config and overview.
  * Force-refresh Yuba status by invalidating the Yuba runtime status cache before fetching `/api/yuba/status`.
* `logs`
  * Reload config and overview.
  * Reload logs; no Douyu cache invalidation is needed.

### Backend API Design

* Add a local API-level way to force-refresh cache-backed resources. Prefer query parameters on existing read endpoints unless the implementation finds a cleaner existing pattern:
  * `/api/yuba/status?force=1`
  * `/api/fans/status/base?force=1` and/or `/api/fans/status/details?force=1`
  * `/api/fans?force=1` if the fans list should bypass its 60 second cache.
* The force flag should only affect the relevant cache scope:
  * Yuba status force refresh invalidates `yuba`.
  * Fans status force refresh invalidates `fans`.
  * Fans list force refresh invalidates the fans list cache; if implementation cannot isolate it cleanly, document and test the chosen broader invalidation.
* Normal endpoint calls without `force=1` must preserve current cached behavior.

### Yuba Cookie Preservation

* Extend Yuba SSO cookie preservation to include:
  * `acf_jwt_token`
  * `acf_dmjwt_token`
* Continue requiring the existing Yuba login readiness fields:
  * `acf_yb_auth`
  * `acf_yb_uid`
  * `acf_yb_t`
* Do not expose raw cookies, JWTs, LTP0, login codes, or Yuba auth bridge URLs in public responses, logs, or test snapshots.
* `acf_yb_did` is not required for this task because live SSO did not return it; do not invent it unless a future observed response provides it.

## Acceptance Criteria

* [ ] Top-right refresh on the Yuba page invalidates Yuba status cache and fetches a fresh Yuba status snapshot.
* [ ] Top-right refresh on overview and expiring-gift invalidates fans status cache and fetches fresh fans/gift/double-card status data.
* [ ] Top-right refresh on keepalive and double-card refreshes the fan-backed room rows according to the chosen fans-list invalidation design.
* [ ] Top-right refresh on logs reloads logs without invalidating Douyu status caches.
* [ ] Top-right refresh on login and collect reloads config/overview without unnecessary Douyu status refresh.
* [ ] Automatic tab-load behavior remains cache-friendly and does not force-refresh backend caches.
* [ ] Normal non-force status endpoints keep the existing TTL behavior.
* [ ] Passport-to-Yuba SSO persists `acf_jwt_token` and `acf_dmjwt_token` when Douyu returns them.
* [ ] Public API responses and logs still mask or omit secret cookie material.
* [ ] Focused contract tests cover force refresh routing/cache invalidation and Yuba JWT preservation.
* [ ] `npm run type-check` and relevant contract tests pass.

## Definition Of Done

* Tests added or updated for backend route/cache behavior and Yuba SSO cookie merging.
* Frontend request code updated so only manual top-right refresh sends force-refresh intent.
* Frontend loading/toast behavior remains consistent with existing page patterns.
* Lint/type-check/contract tests pass.
* No unrelated UI redesign, navigation restructure, or task behavior changes.

## Out Of Scope

* Browser automation for Yuba login.
* Replacing runtime caches with a persistent cache store.
* Changing cache TTL values unless strictly necessary for the force-refresh implementation.
* Adding per-table refresh buttons beyond the existing top-right global refresh.
* Changing scheduled task execution semantics.
* Writing refreshed cookies back to the user's browser or CookieCloud.

## Technical Notes

* Frontend entry points:
  * `src/docker/webui/App.vue`
  * `src/docker/webui/overview.ts`
  * `src/docker/webui/resource-state.ts`
  * `src/docker/webui/resource-yuba.ts`
  * `src/docker/webui/resource-fans.ts`
  * `src/docker/webui/task-page-actions.ts`
* Backend entry points:
  * `src/docker/server-fans-routes.ts`
  * `src/docker/runtime-app-context.ts`
  * `src/docker/runtime-cache.ts`
  * `src/docker/server-types.ts`
  * `src/docker/runtime.ts`
* Yuba SSO entry point:
  * `src/core/douyu-passport.ts`
* Existing guardrail tests to inspect/update:
  * `test/request-smoothing-contract.test.js`
  * `test/project-maintenance-contract.test.js`
  * `test/douyu-passport-contract.test.js`
* Manual live debugging from this session:
  * `/ybapi/authlogin` returned `acf_yb_auth`, `acf_jwt_token`, `acf_dmjwt_token`, `acf_yb_new_uid`, and `acf_yb_uid`.
  * The current persisted Yuba fields were sufficient for Yuba status in that live sample; the stale display problem is therefore primarily a refresh/cache semantics issue, not a Yuba login failure.
