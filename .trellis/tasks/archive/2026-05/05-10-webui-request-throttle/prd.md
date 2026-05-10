# Reduce WebUI Douyu Status Request Frequency

## Goal

Reduce Douyu request bursts caused by Docker WebUI initialization, reloads, and repeated status requests without adding external dependencies or meaningful memory growth.

## What I Already Know

* The user is worried that WebUI access, especially list/status pages, may cause excessive Douyu interface requests.
* Current WebUI initialization calls `syncFans(false)`, then `loadFansStatus(false)` and `loadYubaStatus(false)` even when the user lands on pages that do not need Yuba data.
* `/api/fans/status` fetches fans, backpack/gift status, and one double-card status request per fan room.
* `/api/yuba/status` fetches followed Yuba groups and then checks each group head with concurrency 5.
* Tab switching to `Configurations/DoubleCardConfig` generally does not fetch Douyu by itself; page refresh/direct URL entry runs initialization and currently does.
* The desired design should not introduce Redis, database storage, or cache libraries. Use small in-memory single-slot caches.

## Requirements

* Do not automatically load Yuba status during general WebUI initialization.
* Load Yuba status lazily only when the Yuba tab/page actually needs it, or when the user explicitly triggers a Yuba refresh/task path that already needs it.
* Add a short in-memory TTL cache for `/api/fans/status`.
* Add a longer in-memory TTL cache for `/api/yuba/status`.
* Add request coalescing for both cached status endpoints so simultaneous requests share the same in-flight promise.
* Keep memory bounded: one latest snapshot per status endpoint plus one pending promise per endpoint.
* Avoid adding any new runtime dependency.
* Invalidate relevant status caches after cookie changes, CookieCloud persistence/sync that updates local cookies, task config changes that affect room lists, manual fan sync, and task executions that may change displayed status.
* Preserve existing response shapes for frontend callers.

## Acceptance Criteria

* Opening or refreshing a non-Yuba WebUI page no longer calls `/api/yuba/status`.
* Visiting the Yuba page loads `/api/yuba/status` on demand when status has not been loaded in the current browser state.
* Repeated `/api/fans/status` calls within the TTL return cached data instead of refetching Douyu.
* Repeated `/api/yuba/status` calls within the TTL return cached data instead of refetching Douyu.
* Concurrent requests to either cached endpoint produce at most one upstream Douyu fetch chain per endpoint.
* `npm run type-check` passes.
* `npm run lint` passes or any pre-existing lint issue is clearly identified.

## Definition of Done

* Implementation follows existing Docker runtime patterns.
* No new package dependencies are added.
* Cache invalidation is explicit and close to existing config/task mutation paths.
* User-facing behavior remains understandable: status pages can still be refreshed, but repeated refreshes are protected by cache.

## Out of Scope

* Persistent cache across container restarts.
* Redis, database, LRU, or per-room/per-Yuba cache.
* A global token bucket or full request queue.
* Changing scheduled background task frequencies.

## Technical Notes

* Relevant files: `src/docker/index.ts`, `src/docker/html.ts`, `src/docker/server.ts`, `src/core/api.ts`, `src/core/yuba.ts`.
* Relevant specs: backend directory/error/logging/quality guidelines; frontend index points current Docker WebUI changes back to backend guidelines.
* Current WebUI local 5s interval only polls local overview/log endpoints; the heavy Douyu calls are initialization and explicit status refresh paths.
