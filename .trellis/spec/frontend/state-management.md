# State Management

> How state is managed in this project.

---

## Overview

The frontend uses Vue refs and computed values. There is no Pinia, Vuex, React Query, SWR, or browser persistence layer. Server state is loaded from the Docker WebUI API through Vue-owned resource helpers.

---

## State Categories

- Local form state: refs inside page composables or components, such as cookies, cron expressions, and enabled toggles.
- Shared app state: top-level composables in `App.vue`, such as auth, navigation, theme, toast, and overview.
- Server state: API responses loaded through `requestJson` and resource helpers.
- Shared resource state: `resource-state.ts` owns only top-level overview/log/protected-data refresh orchestration. Focused sibling modules own concrete state: `resource-config.ts` for raw/default config, `resource-fans.ts` for fans/gift resources, `resource-yuba.ts` for yuba status, and `resource-request.ts` for request coalescing. `logs-resource.ts` owns the logs page composable and auto-refresh timer.

`App.vue` is the composition root:

```typescript
const { activePageMeta, activeTab, selectTab, tabs } = usePageNavigation(bootstrap.pageRoutes)
const { authenticated, logout, password, submitLogin } = useAuthSession({ clearProtectedState, loadProtectedData })
const overviewPage = useOverviewPage(activeTab)
```

---

## When to Use Global State

There is no global store. Promote state upward only when multiple shell/page surfaces need it:

- auth session belongs in `useAuthSession` and is consumed by `App.vue`.
- theme belongs in `useThemeMode` because it touches document metadata and app controls.
- overview state and top-level refresh orchestration belong in `resource-state.ts` because toolbar refresh and overview page content share it.
- raw config, fans/gift, and yuba state should live in the focused `resource-*` modules. Page modules should import these direct owners instead of relying on compatibility re-exports from `resource-state.ts`.
- task-page specifics should stay in the task page composable.

---

## Server State

Use the API as the source of truth. After saves or task triggers, refresh the relevant resources through existing refresh callbacks.

Resource state uses request tracking from `resource-request.ts` to avoid duplicate in-flight requests and stale updates:

```typescript
interface ResourceRequest {
  pending: Promise<unknown> | null
  requestSeq: number
}
```

When adding a new server resource, keep the API call in a Vue-owned composable or shared resource helper. If the resource is shared across pages, create or extend a focused `resource-*` module and import that owner directly from page modules. Do not introduce `window.DOUYU_KEEP_WEBUI_*` bridge state.

---

## Scenario: Applying Config Save Responses

### 1. Scope / Trigger
- Trigger: changes to `/api/config` save handling or any task page save/disable flow.
- Scope: WebUI task configuration saves that cross backend persistence, config normalization, optional fans reconciliation, and frontend shared resource state.

### 2. Signatures
- Backend response shape: `POST /api/config -> { ok: true, data?: { config?: DockerConfig, fans?: Fans[] } }`.
- Frontend save helper: `saveTaskConfig({ refresh: (result: SaveTaskConfigResult | null) => Promise<void>, ... })`.
- Shared task refresh: `refreshTaskSurface(activeTab: WebUiPageTab, result: SaveTaskConfigResult | null)`.
- Fans-backed state applicator: `applyManagedFansResponse(result, { updateFans: boolean })`.

### 3. Contracts
- `data.config` is the authoritative persisted config after backend defaults, normalization, and reconciliation. Apply it to `resource-config.rawConfig` before reloading derived surfaces.
- For fans-backed task tabs (`keepalive`, `double-card`, `expiring-gift`), `data.fans` is authoritative for the managed fans list, including an empty array.
- For non-fans-backed saves, update the managed config if a managed resource already exists, but do not clear an existing fans list just because the save response carries `fans: []`.
- `managed.config` must not outlive or override a newer `rawConfig` after a successful save.

### 4. Validation & Error Matrix
- Unauthorized save response -> existing unauthorized event handling owns logout/session state; do not mutate task state after the request throws.
- Failed save response -> keep the existing error toast/revert behavior in `saveTaskConfig` or `disableTaskConfig`.
- Successful save with `config` only -> update raw config and any existing managed config, then refresh overview/current-tab data.
- Successful fans-backed save with `config` and `fans` -> update raw config and managed `{ config, fans }`, then refresh overview/current-tab data.

### 5. Good/Base/Bad Cases
- Good: saving a keepalive room config immediately updates `rawConfig`, `managed.config`, and `managed.fans` from the POST result before current-tab refresh runs.
- Base: saving a collect/yuba config updates `rawConfig` from the POST result and leaves any existing fans list intact.
- Bad: reloading only `/api/config/raw` while leaving an older `managed.config` in memory, because task pages may resolve managed config before raw config.

### 6. Tests Required
- Contract tests should assert that `saveTaskConfig` passes `SaveTaskConfigResult` to refresh callbacks.
- Contract tests should assert that `refreshTaskSurface` applies `applyManagedFansResponse(result, { updateFans: isFansBackedTab(activeTab) })`.
- Contract tests should assert that managed fans helpers attach new fans to `getRawConfig()` rather than a stale managed config.

### 7. Wrong vs Correct

#### Wrong

```typescript
await postConfigPayload(payload)
await refreshOverviewSurface(activeTab, false)
```

#### Correct

```typescript
const result = await postConfigPayload(payload)
applyManagedFansResponse(result, { updateFans: isFansBackedTab(activeTab) })
await refreshOverviewSurface(activeTab, false)
```

## Scenario: CookieCloud Sync-And-Local-Check

### 1. Scope / Trigger
- Trigger: changes to WebUI CookieCloud "同步并校验", `/api/cookie-source/persist`, or CookieCloud diagnostics flow.
- Scope: one user action may combine remote CookieCloud persistence with a local-only cookie diagnostics step, but the diagnostics endpoint itself must not fetch CookieCloud.

### 2. Signatures
- Backend response shape: `POST /api/cookie-source/persist -> { ok: true, data?: { config: DockerConfig, effective: EffectiveCookiePreview, updated: boolean } }`.
- Backend response shape: `POST /api/cookie-source/check -> CookieDiagnostics`.
- Frontend helper: `syncCookieCloudToLoginCookies(showSuccessToast?, rethrowError?) -> Promise<PersistCookieSourceResponse | null | undefined>`.
- Frontend check action: `checkCookieSource(showSuccessToast?) -> Promise<CookieDiagnostics | undefined>`.

### 3. Contracts
- When CookieCloud is active, `/api/cookie-source/persist` force-refreshes CookieCloud once and persists the effective local login cookie snapshot.
- CookieCloud persist keeps the existing local cookie as a fallback when the fresh CookieCloud snapshot is missing one side; the persisted result may be a hybrid effective snapshot.
- CookieCloud persist also stores a `passport.douyu.com` cookie header in `manualPassport.cookie` when the fresh snapshot contains `LTP0`; this keeps the login page's passport field aligned with the local recovery material.
- CookieCloud persist must not replace an existing local `manualPassport.cookie` with incomplete CookieCloud passport material that lacks `LTP0`.
- `/api/cookie-source/check` must only inspect saved local login cookies; it must not call CookieCloud or force-refresh remote data.
- The WebUI "同步并校验" path runs persist first, then calls the local-only check endpoint.
- When CookieCloud is inactive, the same check endpoint diagnoses the saved manual cookies.
- Diagnostics are structural: required cookie keys, cookie count, domains, and CookieCloud update time. They are not a live Douyu login probe.
- The WebUI check summary should not display raw `cookieCount`; the useful user-facing result is the source, update time, readiness, missing key names, and passport recovery-material state.

### 4. Validation & Error Matrix
- CookieCloud inactive before sync -> frontend sync helper returns `null`; local-only check diagnoses saved manual cookies.
- `/api/cookie-source/persist` fails -> `rethrowError` makes check stop and show the sync/check failure toast.
- Unauthorized response -> existing unauthorized handling owns session state; do not mutate cookie diagnostics.
- Persist succeeds -> call `/api/cookie-source/check`; that check must read only the saved local snapshot.
- CookieCloud returns only one usable Douyu side and an existing local cookie is available -> persist keeps the existing local value for the missing side, then check diagnoses the persisted effective snapshot.
- CookieCloud returns passport `LTP0` -> persist writes `manualPassport.cookie`; the login page raw config refresh should populate the passport textarea from that local field.
- CookieCloud passport material lacks `LTP0` -> persist leaves the current `manualPassport` unchanged.
- CookieCloud active but no local snapshot -> `/api/cookie-source/check` returns a configuration error telling the user to sync CookieCloud first.

### 5. Good/Base/Bad Cases
- Good: click "同步并校验" with CookieCloud active -> `/persist` does one remote CookieCloud fetch, writes the effective local snapshot, then `/check` diagnoses the saved local snapshot.
- Good: CookieCloud includes `passport.douyu.com` `LTP0` -> `/persist` saves the composed passport cookie into `manualPassport.cookie`, and the WebUI shows it in the passport textarea after applying the returned raw config.
- Base: fresh CookieCloud data misses one side but local cookies already contain it -> `/persist` preserves the local fallback for that side.
- Base: CookieCloud lacks passport `LTP0` but a manual passport cookie is already saved -> `/persist` keeps the saved manual passport cookie.
- Base: CookieCloud inactive/manual cookie source -> no persist call; `/api/cookie-source/check` diagnoses saved manual cookies.
- Bad: `/api/cookie-source/check` calls CookieCloud directly or returns diagnostics from a remote snapshot that was not persisted locally.
- Bad: `/persist` updates main/yuba but silently ignores complete CookieCloud passport material.

### 6. Tests Required
- Contract tests should assert `/api/cookie-source/check` calls `ctx.inspectCookieSource()` without a force-refresh argument.
- Contract tests should assert `inspectCookieSource` does not call `loadCookieCloudSnapshot`.
- Contract tests should assert CookieCloud persist keeps existing local cookies as fallback when composing effective cookies.
- Tests should assert CookieCloud persist writes complete passport material to `manualPassport.cookie` and does not expose raw passport material through diagnostics.
- Contract tests should assert frontend check code runs `syncCookieCloudToLoginCookies(false, true)` before `/api/cookie-source/check`.
- Contract tests should assert the WebUI check summary does not display `cookieCount` or a raw "Cookie 数" status.
- Type checks should cover the shared `CookieDiagnostics` response shape.

### 7. Wrong vs Correct

#### Wrong

```typescript
async inspectCookieSource(forceRefresh = false): Promise<CookieDiagnostics> {
  const snapshot = await this.loadCookieCloudSnapshot(forceRefresh)
  return this.createCookieCloudDiagnostics(snapshot)
}
```

#### Correct

```typescript
await syncCookieCloudToLoginCookies(false, true)
const data = await requestJson<CookieDiagnostics>('/api/cookie-source/check', {
  method: 'POST',
})
```

---

## Common Mistakes

- Do not add a global store for one page's local form state.
- Do not store API data in `window.DOUYU_KEEP_WEBUI_*` globals.
- Do not update UI state optimistically without a catch path that reverts on failure.
- Do not bypass existing resource invalidation when task config changes affect fans, gift, or yuba status.
- Do not put every new shared resource back into `resource-state.ts`; keep ownership focused and import concrete resource owners directly.
