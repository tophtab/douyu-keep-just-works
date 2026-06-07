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

## Scenario: Server-Injected Initial WebUI Theme

### 1. Scope / Trigger
- Trigger: changing WebUI theme initialization, `src/docker/webui/index.html` bootstrap fields, or Docker WebUI HTML serving in `src/docker/webui.ts` / `src/docker/server-webui-routes.ts`.
- Scope: first-paint theme only. Authenticated raw config remains the source of truth after `/api/config` loads.

### 2. Signatures
- Backend HTML helper: `getHtml(themeMode?: unknown): string`.
- Route registration: `registerWebUiRoutes(app, ctx)` passes `ctx.getConfig()?.ui?.themeMode` into `getHtml`.
- Bootstrap shape: `window.DOUYU_KEEP_WEBUI_BOOTSTRAP.initialThemeMode?: ThemeMode`.
- Frontend composable: `useThemeMode(initialThemeMode?: unknown)`.

### 3. Contracts
- Valid bootstrap values are the shared `ThemeMode` values from `src/core/types.ts`: `light`, `dark`, and `system`.
- Unknown, missing, or invalid values fall back to `system` at both the backend HTML boundary and the frontend composable boundary.
- Server-rendered HTML must replace `__INITIAL_THEME_MODE__`, `__INITIAL_THEME__`, and `__INITIAL_THEME_COLOR__`; placeholders must not leak to the browser.
- The initial resolved theme must be written to both `html[data-theme]` and `body[data-theme]`. Root viewport scrollbars and root-scoped CSS variables read from `html`, while app surfaces still read from `body` and inherited variables.
- `useThemeMode` must update both `document.documentElement.dataset.theme` and `document.body.dataset.theme` when the resolved theme changes.
- `system` has no browser media-query knowledge on the server, so the first paint may use the safe dark initial html/body theme; `useThemeMode` updates to the actual media-query result after Vue mounts.
- `watch(rawConfig, ...)` must ignore empty/null config so it does not immediately reset the bootstrap theme before authenticated config loads.

### 4. Validation & Error Matrix
- `config.ui.themeMode = 'light'` -> served HTML has `initialThemeMode: 'light'`, `html data-theme="light"`, `body data-theme="light"`, and the light theme color.
- `config.ui.themeMode = 'dark'` -> served HTML has `initialThemeMode: 'dark'`, `html data-theme="dark"`, `body data-theme="dark"`, and the dark theme color.
- Missing or invalid `config.ui.themeMode` -> served HTML has `initialThemeMode: 'system'` and a valid initial html/body/meta theme.
- Missing bootstrap object -> `App.vue` fallback keeps `initialThemeMode: 'system'`.

### 5. Good/Base/Bad Cases
- Good: `/` is requested before login, the route reads current config and serves HTML whose html/body/meta theme matches a valid configured mode.
- Base: authenticated config later loads and `rawConfig.ui.themeMode` updates the same `useThemeMode` state.
- Bad: `useThemeMode()` always starts at `system`, causing a first-paint flash for users who saved `light` or `dark`.
- Bad: theme state is written only to `body`, leaving root viewport scrollbars and other `html`-scoped styling on stale variables.
- Bad: null `rawConfig` applies `system` immediately and overwrites a valid bootstrap theme before the API response arrives.

### 6. Tests Required
- Contract tests should request WebUI HTML through `createServer(ctx)` and assert valid configured theme modes are injected.
- Contract tests should assert `html[data-theme]` and `body[data-theme]` are both injected.
- Contract tests should assert invalid theme values fall back safely and no initial-theme placeholders leak.
- Maintenance tests should assert `App.vue` passes `bootstrap.initialThemeMode` into `useThemeMode`.

### 7. Wrong vs Correct

#### Wrong

```typescript
res.type('html').send(getHtml())
const { themeMode } = useThemeMode()
function applyResolvedTheme(): void {
  document.body.setAttribute('data-theme', resolvedTheme.value)
}
```

#### Correct

```typescript
res.type('html').send(getHtml(ctx.getConfig()?.ui?.themeMode))
const { themeMode } = useThemeMode(bootstrap.initialThemeMode)
function applyResolvedTheme(): void {
  document.documentElement.setAttribute('data-theme', resolvedTheme.value)
  document.body.setAttribute('data-theme', resolvedTheme.value)
}
```

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

### Protected Shell Mounting

Protected WebUI pages must not mount before authentication succeeds. Use `v-if="authenticated"` for the authenticated shell, not `v-show`, because hidden Vue components still run setup/watch logic and can issue protected API requests such as `/api/cron-preview` before the session is ready.

When a protected helper can be called before authentication due to future composition changes, unauthorized responses should be ignored or treated as session state, not persisted as field validation errors.

## Scenario: WebUI Resource Error Feedback Surfaces

### 1. Scope / Trigger
- Trigger: changing Docker WebUI resource loaders, page-local resource error state, top-right refresh behavior, logs-page refresh behavior, or toast copy for resource requests.
- Scope: frontend-owned page/resource feedback only. Backend runtime logs remain an operational timeline and must not become a sink for frontend request-display failures.

### 2. Signatures
- Resource loaders that can leave a page missing, stale, or ambiguous accept `showSuccessToast = false`; cache-backed loaders may also accept `forceRefresh = false`.
- `loadLogs(showSuccessToast = false): Promise<boolean | undefined>` owns logs-page load feedback.
- Coalesced resource loaders such as `loadFansStatus(showSuccessToast?, forceRefresh?)`, `loadFansList(showSuccessToast?, forceRefresh?)`, and `loadYubaStatus(showSuccessToast?, forceRefresh?)` must resolve with these values even when their TypeScript return type is widened by shared pending-request storage:
  - `true`: current request succeeded and page resource state was updated.
  - `false`: current request hit a handled non-401 failure or explicit precondition failure.
  - `undefined`: stale request result or 401/session path; the auth/session owner handles it.

### 3. Contracts
- Page/resource load failures are authoritative in inline/page state when the current page data would otherwise be missing, stale, or ambiguous.
- Inline resource errors must clear on a new relevant request, a successful reload, protected-state reset, or credential/config invalidation that clears the resource.
- Automatic loads, tab-switch loads, and background refreshes pass `showSuccessToast = false` and must not toast resource failures.
- Explicit user actions may toast. When the same failure also has inline/page feedback, the toast is only a short pointer such as `刷新失败，请查看页面提示`, not a duplicate full error.
- 401 responses stay in the auth/session path: do not toast them and do not persist them as page resource errors.
- Runtime logs are for backend/runtime facts. Do not add runtime log entries for pure frontend page request failures such as logs-page load failure, cron preview validation, or page-local resource display state.

### 4. Validation & Error Matrix
- Non-401 resource load failure with no usable prior data -> set the resource error ref, keep empty/current resource data safe, and show inline copy that names the failed resource and retry path.
- Non-401 resource load failure with prior loaded data -> keep previous data visible, set the resource error ref, and show stale-data copy such as `本次刷新失败：<error>。当前显示上次结果。`
- Explicit manual refresh where any resource loader resolves `false` -> top-level toast `刷新失败，请查看页面提示` with `ok=false`.
- Automatic load where a resource loader resolves `false` -> update inline/page state only, no toast.
- Logs-page load failure -> set `logsError` and render logs-page summary text; do not append a runtime log entry.
- Clear-logs failure -> toast-only is acceptable because the existing log list remains visible and the page is not ambiguous.
- 401/session failure -> return `undefined` after unauthorized handling; do not set field/resource errors.

### 5. Good/Base/Bad Cases
- Good: overview fans-status failure sets `fansStatusError`, shows missing-data or stale-data copy in the overview fans area, and only short-toasts on explicit refresh.
- Good: logs manual refresh calls `loadLogs(true)`; auto-refresh calls `loadLogs()` and never interrupts the user with a toast.
- Base: task execution failure can still toast immediate command failure while backend runtime logs preserve the execution sequence.
- Bad: showing only a full failure toast such as `加载粉丝牌状态失败：<error>` for a page resource failure.
- Bad: appending frontend request failures to runtime logs to make them durable.
- Bad: retrying automatic tab-load failures forever while a durable page error is already visible; follow existing resource-error guards until the user refreshes or state is invalidated.

### 6. Tests Required
- Contract tests should assert durable resource error refs exist and are cleared on success/reset paths for page-owned resources.
- Contract tests should assert explicit failure toasts are short pointers and are gated by `showSuccessToast`.
- Contract tests should assert automatic loaders call resource helpers with `showSuccessToast = false`.
- Contract tests should assert logs-page load failures use `logsError` inline summary text and clear-log failures remain toast-only.
- Contract tests should assert top-level refresh derives failure toast state from loader results including `false`.

### 7. Wrong vs Correct

#### Wrong

```typescript
showToast(`加载日志失败：${getErrorMessage(error)}`, false)
```

#### Correct

```typescript
logsError.value = getErrorMessage(error)
if (showSuccessToast) {
  showToast('加载日志失败，请查看页面提示', false)
}
```

#### Wrong

```typescript
await loadFansStatus(true)
```

#### Correct

```typescript
await loadFansStatus(false)
```

---

## Scenario: Manual Force Refresh Of Cache-Backed Resources

### 1. Scope / Trigger
- Trigger: changing the top-right WebUI refresh action, resource loaders, or Docker read routes for fans/Yuba status.
- Scope: manual refresh may bypass Docker runtime status caches; automatic page load, tab-switch load, task-save refresh, and background reloads remain cache-friendly.

### 2. Signatures
- Frontend top-level refresh: `refreshOverviewSurface(activeTab: WebUiPageTab, showSuccessToast?: boolean, forceRefresh?: boolean): Promise<void>`.
- Resource loaders: `loadFansStatus(showSuccessToast?: boolean, forceRefresh?: boolean)`, `loadFansList(showSuccessToast?: boolean, forceRefresh?: boolean)`, and `loadYubaStatus(showSuccessToast?: boolean, forceRefresh?: boolean)`.
- Backend read endpoints accept `force=1` for cache-backed reads: `GET /api/fans?force=1`, `GET /api/fans/status/base?force=1`, `GET /api/fans/status/details?force=1`, `GET /api/fans/status?force=1`, and `GET /api/yuba/status?force=1`.

### 3. Contracts
- Only the top-right manual refresh path calls `refreshOverviewSurface(activeTab, true, true)`.
- Automatic `loadActiveTabData`, task-save `refreshTaskSurface`, cookie-source refreshes, and page-owned refreshes call the same loaders without `forceRefresh`.
- When `forceRefresh` is true, frontend resource helpers append `force=1`; they do not call Douyu directly or clear Docker caches locally.
- Backend routes translate `force=1` into `CacheRefreshOptions.forceRefresh` and the runtime cache invalidates only the relevant cache scope before fetching when no same-resource request is already pending.
- Logs reload does not send `force=1`; login and collect manual refresh reload raw config and overview only.
- A same-resource pending request is reused instead of starting overlapping duplicate reads.

### 4. Validation & Error Matrix
- Missing or falsey `force` query -> preserve normal cache TTL behavior.
- `force=1` on fans list -> bypass only the fans-list cache.
- `force=1` on fans status endpoints -> bypass the fans-status cache and the dependent fans-list cache used to build current rows; do not clear Yuba status.
- `force=1` on Yuba status -> bypass only the Yuba status cache.
- Unauthorized or credential errors -> preserve existing request unauthorized handling, error toasts, and backend JSON error status mapping.

### 5. Good/Base/Bad Cases
- Good: top-right refresh on Yuba calls `/api/yuba/status?force=1`, invalidates the Yuba status cache, and updates the current page.
- Good: top-right refresh on overview or expiring-gift calls fans status endpoints with `force=1` while still coalescing repeated clicks.
- Base: automatic tab switch to Yuba calls `/api/yuba/status` without `force=1` and can reuse the 10 minute Docker cache.
- Base: top-right refresh on logs reloads `/api/logs` only.
- Bad: adding `force=1` to `loadActiveTabData`, task-save refresh, or background logs refresh.
- Bad: clearing all Docker runtime caches for a resource-specific force refresh.

### 6. Tests Required
- Contract tests must assert route query forwarding from `force=1` to `CacheRefreshOptions.forceRefresh` for fans and Yuba read endpoints.
- Contract tests must assert `DockerRuntimeCache` force refresh bypasses fresh snapshots for fans list, fans status, and Yuba status while preserving pending-promise coalescing.
- Contract tests must assert only the top-right manual refresh path passes `forceRefresh: true`, and automatic/task-save paths remain non-force.

### 7. Wrong vs Correct

#### Wrong

```typescript
await loadActiveTabData(activeTab)
await loadYubaStatus(false, true)
```

#### Correct

```typescript
void refreshOverviewSurface(activeTab.value, true, true)
await refreshOverviewSurface(activeTab, false)
```

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
- Bad: reloading only `/api/config` while leaving an older `managed.config` in memory, because task pages may resolve managed config before the shared complete config.

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

## Scenario: Passport QR Login Polling

### 1. Scope / Trigger
- Trigger: changing the login page QR flow, `cookie-source-actions.ts`, `cookie.ts`, or `/api/cookie-source/passport-login/*` consumption.
- Scope: WebUI starts a backend-owned QR login session, polls every 2 seconds while active, applies saved config after backend persistence, and stops polling on terminal states.

### 2. Signatures
- Shared type: `PassportQrLoginPublicStatus` from `src/core/types.ts`.
- Frontend actions:
  - `startPassportQrLogin() -> Promise<PassportQrLoginPublicStatus | undefined | null>`
  - `pollPassportQrLogin() -> Promise<PassportQrLoginPublicStatus | undefined | null>`
  - `retryPassportQrLoginYuba() -> Promise<PassportQrLoginPublicStatus | undefined | null>`
  - `cancelPassportQrLogin() -> Promise<void>`
- Page state: `passportQrLogin: Ref<PassportQrLoginPublicStatus | null>` and `passportQrLoginBusy: Ref<boolean>`.

### 3. Contracts
- WebUI never receives or stores raw `scan_code`, login ticket, `LTP0`, or cookie strings from QR APIs.
- The login page places `扫码登录` before `手填保存` in the existing manual-cookie action row.
- QR image rendering uses `status.qrImageDataUrl` from the backend and appears directly below that action row.
- Polling interval is 2 seconds while `passportQrLogin.finished === false`; timers must be cleared on terminal status and component unmount.
- The backend-owned passport poll result `scanned` is a real public state; the UI should show a separate scan progress node before the passport-confirmed/main/Yuba nodes.
- QR progress should distinguish at least `扫码`, `确认`, `主站`, and `鱼吧`: scan is complete when status is `scanned` or later, confirmation is complete when `passportSaved` is true, and main/Yuba use `mainSaved`/`yubaSaved`.
- When a status reports `mainSaved` or `yubaSaved`, reload raw config and apply it to login form state before refreshing cookie-backed resources.
- `yuba_failed` shows a retry action only when `canRetryYuba` is true.
- Do not add legacy QR polling fallback endpoints or main-site `getCsrfCookie` enrichment to the QR status UI path unless a separate task explicitly scopes those login-chain changes.

### 4. Validation & Error Matrix
- Unauthorized response -> existing request unauthorized handling owns logout/session state; do not keep polling.
- Start failure -> show a failure toast and leave existing manual fields unchanged.
- Poll returns `expired`, `cancelled`, `failed`, `yuba_saved`, or `yuba_failed` -> stop polling.
- `mainSaved` with `yuba_failed` -> refresh config, keep status visible, show retry action.
- Retry failure -> keep `canRetryYuba` state visible and do not clear saved passport/main form values.

### 5. Good/Base/Bad Cases
- Good: click `扫码登录`, QR appears below the row, polling shows waiting/scanned/passport/main/Yuba derived states, and the progress row shows `扫码` before `确认`, `主站`, and `鱼吧`, then stops.
- Good: Yuba fails after main saved; raw config refresh shows saved passport/main, and the UI offers `重试鱼吧`.
- Base: user clicks `取消`; backend cancels and frontend clears the polling timer.
- Bad: a component calls `safeAuth`, parses `LTP0`, or derives cookies directly.
- Bad: polling continues after a terminal state or after the component unmounts.

### 6. Tests Required
- Contract tests should assert login page action order and QR placement.
- Contract tests should assert login page QR progress includes separate scan and confirmation nodes.
- Contract tests should assert WebUI imports QR actions from `cookie-source-actions.ts` and state from `cookie-source-state.ts`, not route logic in the component.
- Contract tests should assert backend QR polling maps scanned and cancelled API states without exposing scan code, login ticket, or cookie material.
- Type checks should cover `PassportQrLoginPublicStatus` across backend and WebUI.
- Runtime tests should assert public statuses contain no raw secrets; frontend tests should not use raw cookie fixtures in visible text.

### 7. Wrong vs Correct

#### Wrong

```typescript
const code = new URL(status.loginUrl).searchParams.get('code')
```

#### Correct

```typescript
passportQrPollingTimer = window.setInterval(() => {
  void pollPassportQrLogin()
}, 2000)
```

---

## Common Mistakes

- Do not add a global store for one page's local form state.
- Do not store API data in `window.DOUYU_KEEP_WEBUI_*` globals.
- Do not update UI state optimistically without a catch path that reverts on failure.
- Do not bypass existing resource invalidation when task config changes affect fans, gift, or yuba status.
- Do not put every new shared resource back into `resource-state.ts`; keep ownership focused and import concrete resource owners directly.
