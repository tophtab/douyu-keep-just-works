# Frontend Request Smoothing Research

## Question

How can the Docker WebUI reduce avoidable Douyu-backed requests while keeping the UI responsive?

## Comparable Patterns

### Stale-while-revalidate view cache

How it works:

- Keep the last successful response in client state.
- Render the cached snapshot immediately when returning to a tab.
- Start a background refresh only when the snapshot is older than a short TTL or the user explicitly refreshes.
- Show a subtle "refreshing" state without replacing the table with a loading empty state.

Why tools use it:

- Data-heavy dashboards stay interactive because repaint does not wait on the network.
- It bounds request frequency while still allowing explicit refresh.

Fit here:

- Fits `fansStatus`, `managed.fans`, `yubaStatus`, overview, and logs.
- Especially useful for `/api/fans/status`, because one cache miss fans out to Douyu fans list, backpack/gift status, and per-room double-card checks.

### Request dedupe and latest-request guards

How it works:

- Track in-flight requests by resource key.
- If a matching request is already running, return the same promise instead of starting another.
- For user-triggered refreshes, optionally use a monotonic sequence or `AbortController` so late responses cannot overwrite newer state.

Why tools use it:

- Prevents double-clicks, tab switches, and startup/lazy-load races from multiplying identical requests.
- Keeps UI state deterministic when network responses return out of order.

Fit here:

- Backend already coalesces some pending status/fans requests.
- Frontend can still avoid extra HTTP requests, duplicate render churn, and stale response overwrites.
- Existing auth and cron preview code already use sequence guards, so this matches local style.

### Intent-aware refresh queue

How it works:

- Classify refresh intent: "view status", "reconcile config", "after task mutation", "after manual task run".
- Route each intent to the cheapest endpoint that satisfies the visible UI.
- Add a short cooldown for repeated manual refresh clicks.

Why tools use it:

- Not every UI update needs the heaviest end-to-end sync.
- The user gets faster feedback because cheap local/state requests are not blocked behind expensive upstream calls.

Fit here:

- `refreshOverviewSurface(true)` currently does `syncFans(false)` followed by `loadFansStatus(false)` when cookies exist.
- That is correct for explicit full sync, but too heavy if the user only wants the visible status/table refreshed.
- It may be better to separate "刷新状态" from "同步粉丝牌/任务配置".

### Progressive status rendering

How it works:

- Fetch cheap data first and render immediately.
- Fetch expensive detail as a second phase.
- Mark detail columns as updating while preserving the existing rows.

Why tools use it:

- Large fan-out APIs do not block the whole page.
- Users can keep editing config while slow status details arrive.

Fit here:

- Possible split: `/api/fans` for list/config rows, `/api/fans/status` for gift/double-card details.
- Bigger API/UI change than client-only dedupe, but provides the smoothest experience when room count is high.

## Repo Constraints

- Frontend is a single generated HTML string in `src/docker/html.ts`, using plain JS and no client library.
- Existing style favors small state helpers and explicit render functions.
- Backend already has:
  - `getCachedFansList(cookie)` with short TTL and pending reuse.
  - `getCachedStatus(...)` for fans/yuba status.
  - cache invalidation after task execution and config changes.
- `/api/fans/status` is the expensive visible endpoint because it can call:
  - Douyu fans list.
  - gift/backpack status.
  - `checkDoubleCard(...)` once per fan room.
- `/api/fans/reconcile` has side effects and should not be treated as a harmless cacheable status read.

## Feasible Approaches

### Approach A: Client request gate + stale UI cache (recommended MVP)

How:

- Add per-resource frontend request metadata: in-flight promise, loaded timestamp, min refresh interval, latest sequence.
- For automatic tab loads and post-render lazy loads, reuse cached data within TTL.
- For manual refresh, allow bypassing TTL but disable/debounce the button while in-flight.
- Keep previous rows visible with a small updating indicator instead of replacing them with "please wait".

Pros:

- Smallest frontend-only change.
- Keeps UI smooth with cached content.
- Avoids duplicate HTTP calls from tab switching, double clicks, and overlapping startup/lazy-load paths.
- Complements existing backend cache.

Cons:

- A forced refresh can still trigger the full expensive `/api/fans/status` path.
- Does not reduce the cost of a legitimate cache miss with many fan rooms.

### Approach B: Split visible refresh from config reconciliation

How:

- Make "刷新" default to status-only refresh for visible pages.
- Keep "同步粉丝牌/任务配置" as an explicit action for reconciliation.
- Avoid calling `/api/fans/reconcile` unless saving task config, manual sync, or detected stale room config requires it.

Pros:

- Reduces the heaviest side-effecting path.
- More honest UX: refresh reads status; sync mutates aligned config.
- Matches the existing PRD decision that startup should skip unconditional reconciliation.

Cons:

- Users may expect one refresh button to do everything.
- Requires copy/action clarity so users know when room list/config has been reconciled.

### Approach C: Progressive backend status API

How:

- Add lighter endpoints or query modes, for example list-only, gift-only, double-card-only, or stale-ok status.
- Render fans rows immediately, then fill expensive columns when details arrive.
- Optionally limit double-card checks with backend concurrency to avoid bursts toward Douyu.

Pros:

- Best long-term smoothness for large medal lists.
- Lets the UI stay usable even when one expensive detail source is slow.

Cons:

- Larger cross-layer change.
- More acceptance criteria and tests.
- Needs careful contract updates so config reconciliation, status display, and task execution stay distinct.

## Recommendation

Use Approach A plus the low-risk part of Approach B for the MVP:

- Frontend dedupe, TTL, cooldown, and stale-while-revalidate rendering.
- Keep reconciliation explicit and avoid using it for plain visual refresh.
- Defer progressive API splitting unless user reports many rooms or status refresh remains slow after request smoothing.
