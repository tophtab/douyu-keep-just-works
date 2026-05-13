# State Management

> How state is managed in this project.

---

## Overview

Docker WebUI state is currently split between:

- Vue-local state in `src/docker/webui/`
- Transitional shared state bridge helpers under `src/docker/webui/legacy-state.ts`
- Persisted configuration through Docker HTTP APIs

There is no dedicated server-state library such as Vue Query, and Pinia is not part of the current Docker WebUI stack.

## State Categories

- Local UI state: form fields, loading flags, dialogs, validation messages, cron previews.
- Shared page state during the transition: existing `DOUYU_KEEP_WEBUI_*` modules under `src/docker/webui/`.
- Persisted state: Docker config read/written through `/api/config`, `/api/cookie-source/*`, and related Express routes.

## When To Add Global State

Add a global store only when:

- multiple Vue components need the same mutable state,
- route/page changes should preserve background progress,
- or duplicated fetch/update logic appears in several components.

Until then, prefer component state plus small helper modules.

## Server And Persistence State

- Fetch Docker runtime data through the existing Express JSON APIs.
- Do not call Douyu directly from Vue components when the Docker backend already owns that boundary.
- Preserve backend cache/coalescing semantics; the browser should not add cooldowns that suppress needed local API refreshes.

## Common Mistakes

- Do not introduce Pinia before there is shared Vue-owned state.
- Do not reintroduce `src/docker/webui/app-state.js`; transitional shared state now lives behind the `legacy-state.ts` compatibility bridge until remaining legacy modules are removed.
- Do not silently convert failed API requests into valid empty UI state.

## Scenario: Vue-Owned Transitional Legacy State Bridge

### 1. Scope / Trigger

- Trigger: Maintaining the TypeScript-owned Docker WebUI shared state bridge after the former `src/docker/webui/*.js` helpers have moved into `src/docker/webui/`.
- Scope: Raw config fallback, cookie-source helpers, request coalescing metadata, managed fan derivation, fans-status merge helpers, active refresh loading, protected-state clearing, and the compatibility bridges consumed by `legacy-app.ts`.

### 2. Signatures

```typescript
export function installLegacyStateBridge(): void
export function installLegacyManagedDataBridge(): void
export function installLegacyProtectedStateBridge(): void
```

```typescript
window.DOUYU_KEEP_WEBUI_STATE.create({
  defaultRawConfig,
  initialTab,
})
```

### 3. Contracts

- `main.ts` must install the three `legacy-state.ts` bridges before calling `startLegacyApp()`.
- `src/docker/webui/legacy-app.ts` may continue to call `window.DOUYU_KEEP_WEBUI_STATE`, `window.DOUYU_KEEP_WEBUI_MANAGED_DATA`, and `window.DOUYU_KEEP_WEBUI_PROTECTED_STATE` during the transition.
- `legacy-state.ts` owns `resourceRequests.{fansSync,fansList,fansStatus,yubaStatus}` with `pending`, `fetchedAt`, and `requestSeq`; Vue-owned resource loaders must keep using `trackResourceRequest()` for request coalescing.
- Clearing protected or cookie-backed state must invalidate fans/Yuba request metadata and reset managed, fan status, gift status, Yuba status, loading flags, and error text.
- The former JS owner files `app-state.js`, `app-managed-data.js`, and `app-protected-state.js` must stay out of the Vite boot path.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| Duplicate fans/Yuba resource load starts while `resource.pending` exists | Return the in-flight promise |
| A tracked request resolves or rejects after a newer request increments `requestSeq` | Leave the newer `pending` untouched |
| User logs out or receives unauthorized response | Clear protected state and publish refresh-button state without stale fan/Yuba data |
| No raw config has loaded | `getRawConfig()` returns a deep clone of the default config |
| CookieCloud diagnostics include `updateTime` | Format it through the shared Shanghai-local `formatDate()` helper |

### 5. Good/Base/Bad Cases

- Good: `legacy-state.ts` installs compatibility bridges and `legacy-app.ts` consumes them while the transitional app bridge remains.
- Base: Migrated Vue resource modules still receive state helpers through legacy deps until the remaining compatibility bridge surface is removed.
- Bad: Recreate `src/docker/webui/app-state.js` or split request-coalescing metadata across multiple independent stores.


### 6. Wrong vs Correct

#### Wrong

```typescript
await import('./app-state.js')
```

#### Correct

```typescript
installLegacyStateBridge()
installLegacyManagedDataBridge()
installLegacyProtectedStateBridge()
```

## Scenario: Vue-Owned Transitional Navigation

### 1. Scope / Trigger

- Trigger: Maintaining Vue-owned navigation after the former `src/docker/webui/*.js` behavior slice has moved into `src/docker/webui/`.
- Scope: Navigation tabs, active page visibility, page title/subtitle, browser history, and legacy lazy-load notification.

### 2. Signatures

```typescript
export function usePageNavigation(pageRoutes: Partial<Record<WebUiPageTab, string>>): {
  activePageMeta: ComputedRef<WebUiPageMeta>
  activeTab: Ref<WebUiPageTab>
  handleTabKeydown: (event: KeyboardEvent) => void
  selectTab: (tab: WebUiPageTab) => void
  tabs: WebUiPageMeta[]
}
```

```typescript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:navigation', {
  detail: { tab, skipLazyLoad },
}))
```

### 3. Contracts

- Vue owns the visible navigation DOM state: active tab class, `aria-selected`, `tabindex`, page `hidden`, page `aria-hidden`, and page title/subtitle.
- Vue syncs browser history from `DOCKER_WEBUI_PAGE_ROUTES` bootstrap data and listens to `popstate`.
- Legacy modules may listen for `douyu-keep-webui:navigation` to update `state.activeTab`, run page renderers, and trigger existing lazy loads.
- Legacy modules must not directly mutate the same tab/page/title DOM once Vue owns that surface.
- Legacy-generated `data-action="tab"` buttons should be bridged back into Vue navigation instead of handled by the legacy action dispatcher.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| Unknown tab key | Fall back to `overview` |
| Unknown path | Resolve to `overview` |
| History API throws | Keep UI state usable and skip path mutation |
| User is unauthenticated | Legacy listener records `state.activeTab` but does not load protected page data |
| Legacy page renders a `data-action="tab"` button | Vue handles the click and notifies legacy through the navigation event |

### 5. Good/Base/Bad Cases

- Good: Vue updates `activeTab`, changes page visibility, pushes the new route, then dispatches `douyu-keep-webui:navigation`.
- Base: Legacy receives the navigation event and refreshes only data/render surfaces that still belong to legacy modules.
- Bad: Legacy click handlers call `querySelectorAll('.tab-btn')`, toggle `.page.hidden`, or rewrite `#page-title` after Vue owns navigation.


### 6. Wrong vs Correct

#### Wrong

```javascript
document.querySelectorAll('.tab-btn').forEach(function (button) {
  button.classList.toggle('active', button.getAttribute('data-tab') === nextTab);
});
byId('page-title').textContent = PAGE_META[nextTab].title;
```

#### Correct

```vue
<button :class="{ active: activeTab === tab.key }" @click="selectTab(tab.key)">
  {{ tab.label }}
</button>
```

## Scenario: Vue-Owned Transitional Theme Mode

### 1. Scope / Trigger

- Trigger: Maintaining Vue-owned theme mode after the former `src/docker/webui/*.js` shell control has moved into `src/docker/webui/`.
- Scope: Theme mode buttons, selected button state, theme note copy, `body[data-theme]`, `theme-color` / `color-scheme` meta tags, system color-scheme changes, and theme-mode persistence.

### 2. Signatures

```typescript
export function useThemeMode(): {
  savingThemeMode: Ref<ThemeMode | null>
  selectThemeMode: (nextThemeMode: ThemeMode) => Promise<void>
  themeMode: Ref<ThemeMode>
  themeModes: Array<{ mode: ThemeMode, label: string, title: string }>
  themeNote: ComputedRef<string>
}
```

```javascript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:config', {
  detail: { themeMode: state.rawConfig?.ui?.themeMode || 'system' }
}));
```

```typescript
fetch('/api/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ui: { themeMode: nextThemeMode } }),
})
```

### 3. Contracts

- Vue owns the visible theme DOM state: `.theme-option.active`, `aria-pressed`, `aria-busy`, theme note text, `document.body[data-theme]`, and theme meta tags.
- Legacy raw-config loading notifies Vue with `douyu-keep-webui:config`; it must not mutate theme buttons, theme note text, body theme, or theme meta tags after Vue owns the surface.
- Vue persists only the `ui.themeMode` payload through `/api/config`; backend config merging remains authoritative.
- Vue dispatches `douyu-keep-webui:unauthorized` when a theme save returns `401`, and the legacy auth boundary handles the login-expired transition.
- Theme mode values are the shared `ThemeMode` union: `light`, `dark`, or `system`; invalid or missing config falls back to `system`.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| Missing `config.ui.themeMode` | Vue falls back to `system` |
| Unknown theme mode | Vue falls back to `system` |
| `matchMedia` missing or throws | System preference falls back to dark and the UI remains usable |
| `/api/config` save fails with non-401 | Vue restores the previous mode and shows the existing toast error style |
| `/api/config` save returns `401` | Vue restores the previous mode and dispatches `douyu-keep-webui:unauthorized` |
| Meta nodes are absent | Vue skips meta updates without throwing |

### 5. Good/Base/Bad Cases

- Good: Vue applies the selected mode optimistically, persists `{ ui: { themeMode } }`, updates body/meta state, and rolls back on save failure.
- Base: Legacy `loadRawConfig()` dispatches the loaded theme mode once config is available; Vue updates its local state from that event.
- Bad: Legacy code uses `querySelectorAll('.theme-option')`, rewrites `#theme-note`, or listens to `prefers-color-scheme` to mutate the same theme surface after migration.


### 6. Wrong vs Correct

#### Wrong

```javascript
document.querySelectorAll('.theme-option[data-theme-mode]').forEach(function (button) {
  button.classList.toggle('active', button.getAttribute('data-theme-mode') === mode);
  button.setAttribute('aria-pressed', button.getAttribute('data-theme-mode') === mode ? 'true' : 'false');
});
byId('theme-note').textContent = '当前固定为 深色 模式';
```

#### Correct

```vue
<button
  v-for="option in themeModes"
  :class="{ active: themeMode === option.mode }"
  :aria-pressed="themeMode === option.mode ? 'true' : 'false'"
  @click="selectThemeMode(option.mode)"
>
  ...
</button>
```

## Scenario: Vue-Owned Transitional Toast Region

### 1. Scope / Trigger

- Trigger: Maintaining Vue-owned toast and screen-reader live-region feedback after the former `src/docker/webui/*.js` helper has moved into `src/docker/webui/`.
- Scope: visible toast message, success/error color, `aria-hidden`, the `#toast-live` polite status region, repeated-message announcements, and the legacy compatibility event bridge.

### 2. Signatures

```typescript
import type { Ref } from 'vue'

export const TOAST_EVENT_NAME = 'douyu-keep-webui:toast'

export function showToast(message: string, ok: boolean): void

export function useToastRegion(): {
  toastLiveMessage: Ref<string>
  toastMessage: Ref<string>
  toastOk: Ref<boolean>
  toastVisible: Ref<boolean>
}
```

```javascript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:toast', {
  detail: { message: String(message), ok: Boolean(ok) }
}));
```

### 3. Contracts

- Vue owns the toast DOM state: `#toast` text, display, background, `aria-hidden`, and `#toast-live` text.
- Legacy modules may keep calling `DOUYU_KEEP_WEBUI_DOM.toast(message, ok)`, but the helper installed by `legacy-core.ts` must dispatch through `showToast(message, ok)` instead of mutating `#toast` or `#toast-live`.
- Vue must clear the live-region text before setting the new message asynchronously so repeated identical messages are announced.
- Toast visibility must still auto-hide after the existing 3200ms duration.
- Theme and future Vue-owned slices should call `showToast(message, ok)` instead of duplicating toast DOM mutation.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| Legacy helper receives a success message | Dispatches the toast event; Vue shows green visible toast and updates the live region |
| Legacy helper receives an error message | Dispatches the toast event; Vue shows red visible toast and updates the live region |
| Same message fires twice | Live region is cleared, then reset asynchronously so assistive tech can announce it again |
| A second toast fires before the first hides | Existing timers are cleared and the latest message owns the visible toast |
| Empty/null message reaches Vue | Vue ignores it instead of rendering noisy empty feedback |

### 5. Good/Base/Bad Cases

- Good: Vue listens for `douyu-keep-webui:toast`, stores the message in refs, renders `#toast-live` and `#toast` from state, and clears timers on unmount.

- Base: Legacy actions keep their existing `toast('...', true/false)` calls and the helper bridges them to the Vue event.
- Bad: a legacy DOM helper calls `byId('toast')`, edits `#toast-live`, stores `window.__toastTimer`, or a Vue composable duplicates those DOM mutations.


### 6. Wrong vs Correct

#### Wrong

```javascript
var node = byId('toast');
var liveNode = byId('toast-live');
liveNode.textContent = message;
node.style.display = 'block';
```

#### Correct

```vue
<div id="toast-live" role="status" aria-live="polite">{{ toastLiveMessage }}</div>
<div id="toast" :aria-hidden="toastVisible ? 'false' : 'true'">{{ toastMessage }}</div>
```

## Scenario: Vue-Owned Transitional Fan Allocation Task Page

### 1. Scope / Trigger

- Trigger: Maintaining a Vue-owned fan allocation task page after the former `src/docker/webui/*.js` page behavior has moved into `src/docker/webui/`.
- Scope: Task status card, enable switch, cron preview, allocation mode, fan allocation table inputs, save/disable actions, manual trigger action, and legacy fan-list refresh orchestration.

### 2. Signatures

```typescript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:keepalive-page', {
  detail: {
    rawConfig,
    managedConfig,
    overview,
    fans,
    managedLoading,
    fansListError,
    fansListLoaded,
  },
}))
```

```typescript
export function useKeepaliveTaskPage(): {
  keepaliveCron: Ref<string>
  keepaliveEnabled: Ref<boolean>
  keepaliveModel: Ref<1 | 2>
  saveKeepaliveConfig: (options?: { revertCheckboxOnError?: boolean }) => Promise<void>
  triggerKeepaliveTask: () => Promise<void>
}
```

```javascript
window.DOUYU_KEEP_WEBUI_KEEPALIVE_TASK_ACTIONS = {
  create(deps) {
    return { saveKeepaliveConfig, disableKeepaliveConfig }
  },
}
```

### 3. Contracts

- Vue owns the visible page DOM for the migrated task: task card, note, enable checkbox, cron input/preview, allocation mode selector, action buttons, empty states, and allocation table inputs.
- Legacy page renderers may dispatch one custom event with the current `rawConfig`, `managedConfig`, fan rows, loading flags, and overview snapshot; they must not mutate the migrated DOM ids after ownership moves.
- Vue save actions build the persisted task payload from reactive state and post only the corresponding config key through `/api/config`.
- Vue disable actions preserve the current cron/model/send values while setting `active: false`.
- Vue manual trigger actions call `/api/trigger/<task>` and then ask legacy loaders to refresh overview, logs, and fan status as appropriate.
- Existing fan-list loading is owned by `resources.ts`; the migrated page may still rely on `ensureFansListForActiveTab()` being called after state dispatch while legacy navigation orchestration remains.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| No Cookie or CookieCloud configured | Vue shows the existing Chinese "save Cookie first" note and no table |
| Fan list is loading with no cached fans | Vue shows the syncing note and loading empty state |
| Fan list request failed before any rows loaded | Vue shows the failure note and includes the error in the empty state |
| Fan list loaded with zero rows | Vue shows the existing "no usable fan badge" empty state |
| Save returns `401` | Request helper emits the unauthorized flow; page action does not show a duplicate error toast |
| Save fails after toggle-on | Vue reverts the checkbox when `revertCheckboxOnError` is set |

### 5. Good/Base/Bad Cases

- Good: `task-pages.ts` dispatches `douyu-keep-webui:keepalive-page`, then calls `ensureFansListForActiveTab()` for the transitional loader.
- Base: `task-actions.ts` delegates keepalive save/disable through `DOUYU_KEEP_WEBUI_KEEPALIVE_TASK_ACTIONS` while the aggregate compatibility bridge remains.
- Bad: Legacy code still calls `byId('keepalive-cron').value`, `byId('keepalive-enable').checked`, or rewrites `#keepalive-table-wrap` after the Vue page is mounted.


### 6. Wrong vs Correct

#### Wrong

```javascript
byId('keepalive-enable').checked = isTaskActive(config)
byId('keepalive-table-wrap').innerHTML = buildSendTable(fans, config, false, 'keepalive-value')
```

#### Correct

```vue
<input v-model="keepaliveEnabled" id="keepalive-enable" @change="handleKeepaliveToggle">
<tr v-for="row in keepaliveFanRows" :key="row.roomId">
  <input v-model.number="row.value" class="keepalive-value">
</tr>
```

## Scenario: Vue-Owned Transitional Request Helper

### 1. Scope / Trigger

- Trigger: Moving shared Docker WebUI JSON request behavior from `src/docker/webui/app-request.js` into Vue/TypeScript while legacy modules still call `window.DOUYU_KEEP_WEBUI_REQUEST.create(...)`.
- Scope: `fetch` JSON parsing, backend error extraction, `401` handling, optional toast feedback, and the legacy request bridge installed before transitional modules boot.

### 2. Signatures

```typescript
export interface WebUiRequestError extends Error {
  status?: number
  data?: unknown
}

export interface WebUiRequestInit extends RequestInit {
  errorToast?: string | ((message: string, error: WebUiRequestError) => string) | false
  onUnauthorized?: (() => void) | false
}

export async function requestJson<T = unknown>(
  url: string,
  options?: WebUiRequestInit,
): Promise<T>

export function installLegacyRequestBridge(): void
```

```javascript
window.DOUYU_KEEP_WEBUI_REQUEST.create({
  handleUnauthorized: function () { /* legacy auth bridge */ }
}).requestJson('/api/config/raw');
```

### 3. Contracts

- `requestJson()` reads `response.text()`, parses JSON when present, and returns `{}` for an empty successful response body.
- Non-OK responses throw a `WebUiRequestError` whose `message` comes from `data.error` when the backend returned one, otherwise `请求失败`; `status` is the HTTP status and `data` is the parsed response body.
- `401` responses dispatch `douyu-keep-webui:unauthorized` by default, unless `onUnauthorized: false` is passed or a custom `onUnauthorized` callback is provided.
- Auth-owned endpoints (`/api/auth/status`, `/api/auth/login`, `/api/auth/logout`) pass `onUnauthorized: false` so failed login/status/logout requests do not race the global session-expired handler.
- `errorToast` is opt-in; protected legacy callers keep their existing catch/toast behavior, while Vue-owned callers may request shared toast formatting.
- `installLegacyRequestBridge()` must run before importing legacy modules that call `window.DOUYU_KEEP_WEBUI_REQUEST.create(...)`.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| `200` with JSON body | Return parsed JSON as `T` |
| `204` or empty body | Return `{}` |
| Non-OK with `{ "error": "..." }` | Throw `WebUiRequestError` with backend message |
| Non-OK without `error` | Throw `WebUiRequestError` with `请求失败` |
| `401` from protected API | Dispatch `douyu-keep-webui:unauthorized` or call custom `onUnauthorized` |
| `401` from auth-owned API with `onUnauthorized: false` | Throw to the auth flow without dispatching the global event |
| `errorToast` set on non-401 failure | Show Vue-owned toast with the formatted error message |

### 5. Good/Base/Bad Cases

- Good: Vue-owned modules import `requestJson()` directly, set `errorToast` only when the shared helper should own failure feedback, and use `onUnauthorized: false` for auth endpoint control flow.
- Base: Legacy modules keep receiving a `requestJson` function from `window.DOUYU_KEEP_WEBUI_REQUEST.create(...)`, and their existing `isUnauthorizedError(error)` checks keep working through `error.status`.
- Bad: A legacy `app-request.js` import overwrites the Vue bridge after boot, or a login failure dispatches the global unauthorized event and replaces the login error with the session-expired copy.


### 6. Wrong vs Correct

#### Wrong

```typescript
await requestJson('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ password }),
})
```

#### Correct

```typescript
await requestJson('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ password }),
  onUnauthorized: false,
})
```

## Scenario: Vue-Owned Transitional System Resources

### 1. Scope / Trigger

- Trigger: Maintaining Docker WebUI read-only system resource loading after the former `src/docker/webui/*.js` resource behavior has moved into `src/docker/webui/`.
- Scope: `/api/config/raw`, `/api/overview`, `/api/logs`, loading/error state for these read-only resources, the Vue-owned logs page, the `douyu-keep-webui:config` theme notification, and the compatibility bridge used by remaining legacy action assembly.

### 2. Signatures

```typescript
export function installLegacySystemResourceBridge(): void
export function installLegacyFansResourceBridge(): void
export function installLegacyResourceActionsBridge(): void
export function useLogsPage(activeTab: Readonly<Ref<string>>, authenticated: Readonly<Ref<boolean>>): {
  clearLogs: () => Promise<void>
  clearingLogs: Ref<boolean>
  formattedLogs: ComputedRef<LogEntry[]>
  logsAutoRefresh: Ref<boolean>
  logsLoading: Ref<boolean>
  logsSummary: ComputedRef<string>
  logBoxRef: Ref<HTMLElement | null>
  refreshLogs: () => Promise<void>
}
```

```typescript
window.DOUYU_KEEP_WEBUI_SYSTEM_RESOURCE_ACTIONS.create({
  state,
  defaultRawConfig,
  renderAll,
  renderOverview,
  renderLogsPage,
}).loadOverview()
```

```typescript
window.DOUYU_KEEP_WEBUI_FANS_RESOURCE_ACTIONS.create({
  state,
  getRawConfig,
  getResourceRequest,
  hasCookieSourceConfigured,
  trackResourceRequest,
  renderAll,
  renderOverview,
  renderExpiringGiftPage,
}).loadFansStatus(false)
```

### 3. Contracts

- `src/docker/webui/resources.ts` owns read-only system resource requests and fans reconcile/list/status requests through the shared `requestJson()` helper.
- `src/docker/webui/resources.ts` owns resource action composition and active-surface refresh orchestration through `installLegacyResourceActionsBridge()`.
- `main.ts` must install `installLegacySystemResourceBridge()`, `installLegacyFansResourceBridge()`, `installLegacyYubaBridge()`, and `installLegacyResourceActionsBridge()` before `installLegacyActionBridge()` and `startLegacyApp()` run.
- `loadRawConfig()` writes `state.rawConfig`, falls back to a cloned `DEFAULT_RAW_CONFIG` when `/api/config/raw` returns `{ exists: false }`, dispatches `douyu-keep-webui:config`, then calls `renderAll()`.
- `loadOverview()` writes `state.overview` and calls `renderOverview()`.
- `loadLogs()` writes the shared Vue logs ref, syncs `state.logs` / `state.logsRefreshedAt` for transitional consumers, and lets Vue render the visible logs page.
- `useLogsPage()` owns the visible logs page DOM state: `#logs-summary`, `#full-log-box`, loading button text, clear button text, auto-refresh checkbox, empty state, and scroll-to-bottom behavior.
- Legacy page renderers must not mutate `#logs-summary` or `#full-log-box` after the logs page is Vue-owned.
- `data-action="refresh-logs"` and `data-action="clear-logs"` must be removed from `App.vue`; Vue click handlers own those buttons.
- Clearing logs uses `DELETE /api/logs`, shows the existing `日志已清空` success toast, reloads logs, and refreshes overview so recent-log summaries stay current.
- Unauthorized errors must flow through the shared request helper's `douyu-keep-webui:unauthorized` event and must not show duplicate resource toasts.
- Non-401 failures keep the existing Chinese toast prefixes: `加载配置失败：`, `加载概览失败：`, and `加载日志失败：`.
- Legacy modules may call the bridge while they still render forms/task pages, but they must not reintroduce `app-system-resource-actions.js`.
- Fans resource actions must preserve legacy request smoothing: reuse `resource.pending`, guard stale responses with `requestSeq`, and return `trackResourceRequest(resource, requestSeq, pending)`.
- Fans status loading remains progressive: request `/api/fans/status/base`, render overview/expiring surfaces, and only request `/api/fans/status/details` when the base response is not complete.
- Legacy modules may call the fans/resource bridges while they still orchestrate refresh/task pages, but they must not reintroduce `app-fans-resource-actions.js` or `app-resource-actions.js`.
- `refreshOverviewSurface()` must preserve the legacy flow: load raw config first, return early when unauthenticated, clear cookie-backed state when no cookie source is configured, otherwise reload overview plus the active tab's resource surface, and show `状态已刷新` only when requested.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| `/api/config/raw` returns `{ exists: false }` | Clone default raw config, dispatch theme config event, render all pages |
| `/api/config/raw` returns persisted config | Store it unchanged, dispatch theme mode from `config.ui.themeMode || system`, render all pages |
| `/api/overview` succeeds | Store overview payload and refresh overview-owned legacy render surfaces |
| `/api/logs` succeeds | Store logs array, update refreshed-at timestamp, refresh logs page |
| User opens the logs tab | Vue loads logs if authenticated |
| Auto-refresh is enabled while logs tab is active | Vue refreshes logs on the existing 5s cadence |
| User clears logs | `DELETE /api/logs`, success toast, logs reload, overview refresh |
| Any system resource returns `401` | Dispatch/keep the global unauthorized transition without a duplicate toast |
| Any system resource fails with non-401 | Preserve the existing user-facing toast prefix for that resource |
| Fans sync/list/status starts while an identical request is pending | Return the in-flight promise and do not start a duplicate fetch |
| Fans status base response has `complete: true` | Mark fans status loaded and skip `/api/fans/status/details` |
| Fans status base response is incomplete | Fetch details, merge them through the legacy managed-data helpers, and update overview/expiring surfaces |

### 5. Good/Base/Bad Cases

- Good: Vue/TS resource code owns fetch/error/loading mechanics while legacy page renderers only consume state and render DOM.
- Good: The logs page renders log lines with Vue interpolation instead of legacy `innerHTML`, preserving escaping by default.
- Base: `actions.ts` still consumes `DOUYU_KEEP_WEBUI_RESOURCE_ACTIONS`, but the bridge is installed by `resources.ts`.
- Bad: `main.ts` imports `src/docker/webui/app-system-resource-actions.js` after the bridge is installed, overwriting the Vue/TS owner.
- Bad: `main.ts` imports `src/docker/webui/app-fans-resource-actions.js` after the bridge is installed, overwriting the Vue/TS owner.
- Bad: `main.ts` imports `src/docker/webui/app-resource-actions.js` after the bridge is installed, overwriting the Vue/TS owner.
- Bad: A resource failure is converted to an empty config, empty overview, or empty log list without surfacing an error.
- Bad: `pages.ts` writes `byId('logs-summary').textContent` or `full-log-box.innerHTML` after Vue owns the logs page.


### 6. Wrong vs Correct

#### Wrong

```javascript
await import('./app-system-resource-actions.js')
```

#### Correct

```typescript
installLegacyCoreBridge()
installLegacySystemResourceBridge()
installLegacyFansResourceBridge()
```

## Scenario: Vue-Owned Transitional Cookie/Login Config Page

### 1. Scope / Trigger

- Trigger: Maintaining Vue-owned Docker WebUI manual Cookie and CookieCloud behavior after the former `src/docker/webui/*.js` behavior has moved into `src/docker/webui/`.
- Scope: Login status card, manual Cookie textareas, CookieCloud enable/config form, CookieCloud note text, CookieCloud cron preview, save/sync/check actions, and the legacy Cookie action bridge.

### 2. Signatures

```typescript
export function useCookieLoginPage(): {
  checkCookieSource: (showToast?: boolean) => Promise<CookieDiagnostics | undefined>
  cookieCheckText: ComputedRef<string>
  cookieCloud: {
    active: boolean
    endpoint: string
    uuid: string
    cron: string
    password: string
  }
  cronPreviewText: ComputedRef<string>
  handleCookieCloudToggle: () => void
  loadCookieCloudCronPreview: () => Promise<void>
  loginStatus: ComputedRef<{
    pills: Array<{ label: string, kind: string }>
    cells: Array<{ label: string, value: string }>
  }>
  mainCookie: Ref<string>
  saveAndEnableCookieCloud: () => Promise<void>
  saveCookie: () => Promise<void>
  yubaCookie: Ref<string>
}
```

```typescript
export function installLegacyCookieActionBridge(): void
```

```javascript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:login-page', {
  detail: { rawConfig, overview, fansCount, cookieCheck },
}))
```

### 3. Contracts

- `src/docker/webui/cookie.ts` owns visible Cookie/Login DOM state and actions through Vue refs and the shared `requestJson()` helper.
- `main.ts` must install `installLegacyCookieActionBridge()` before `installLegacyActionBridge()` and `startLegacyApp()` run, and must not import `app-cookie-actions.js`.
- `App.vue` must bind manual Cookie fields, CookieCloud fields, CookieCloud toggle, save buttons, check button, note text, and cron preview through Vue state/events.
- `actions.ts` may keep calling `window.DOUYU_KEEP_WEBUI_COOKIE_ACTIONS.create(...)` during migration; the installed bridge must provide `syncCookieCloudToLoginCookies`, `saveCookie`, `saveCookieCloud`, `checkCookieSource`, `saveCookieCloudToggle`, `saveAndEnableCookieCloud`, and `disableCookieCloud`.
- `pages.ts` must dispatch `douyu-keep-webui:login-page` details instead of mutating `#cookie-login-card`, `#main-cookie-input`, `#yuba-cookie-input`, `#cookie-cloud-enable`, or other CookieCloud fields.
- The transitional event bridge in `events.ts` must not handle `data-action="save-cookie"`, `data-action="save-cookie-cloud"`, `data-action="check-cookie-source"`, `#cookie-cloud-cron`, or `#cookie-cloud-enable` after Vue owns the page.
- Save/check requests preserve existing API contracts: manual Cookie writes `POST /api/config` with `manualCookies`, CookieCloud writes `POST /api/config` with `cookieCloud`, sync uses `POST /api/cookie-source/persist`, check uses `POST /api/cookie-source/check`, and cron preview uses `GET /api/cron-preview?value=...`.
- Unauthorized errors must flow through the shared request helper and avoid duplicate local toasts.
- Non-401 failures must keep existing Chinese toast prefixes for manual save, CookieCloud save, CookieCloud sync, and cookie-source check.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| Raw config loads | Vue populates manual Cookie fields, CookieCloud fields, note text, and cron preview |
| Overview loads | Vue updates login status card without legacy DOM mutation |
| User saves manual Cookie | `POST /api/config`, clear cookie-backed data through the bridge dependency, success toast, overview refresh |
| User enables CookieCloud | `POST /api/config`, clear cookie-backed data, optional cookie-source check, overview refresh |
| User disables CookieCloud | Persist inactive CookieCloud config quietly and refresh overview |
| User clicks sync/check | Persist CookieCloud snapshot when active, then `POST /api/cookie-source/check`, update note text, show success/failure toast |
| CookieCloud cron changes | Vue refreshes the preview through `/api/cron-preview` and ignores stale responses |
| Any action returns `401` | Global unauthorized handling runs without a duplicate Cookie page toast |
| Any action fails with non-401 | Preserve the existing action-specific error toast |

### 5. Good/Base/Bad Cases

- Good: Vue owns the form inputs and buttons while legacy startup code still calls the bridge for protected-data synchronization.
- Good: `pages.ts` sends `douyu-keep-webui:login-page` state details, leaving DOM updates to Vue interpolation and bindings.
- Base: `actions.ts` still composes Cookie actions via `window.DOUYU_KEEP_WEBUI_COOKIE_ACTIONS.create(...)` until the broader action bridge is removed.
- Bad: `events.ts` handles `data-action="save-cookie"` after Vue owns the save button.
- Bad: `pages.ts` writes `.value` or `.checked` on Cookie/Login form nodes after Vue owns them.
- Bad: Reintroducing `src/docker/webui/app-cookie-actions.js` overwrites the Vue bridge.


### 6. Wrong vs Correct

#### Wrong

```javascript
await import('./app-cookie-actions.js')
```

#### Correct

```typescript
installLegacyCookieActionBridge()
installLegacyActionBridge()
```

## Scenario: Vue-Owned Transitional Collect Task Page

### 1. Scope / Trigger

- Trigger: Moving the Docker WebUI collect-gift task page from legacy DOM mutation into Vue while the remaining task pages still use legacy task renderers and action modules.
- Scope: Collect task status card, enable switch, cron input, cron preview, save/disable actions, manual trigger action, and the collect action bridge used by transitional task action assembly.

### 2. Signatures

```typescript
export function useCollectTaskPage(): {
  collectCron: Ref<string>
  collectCronPreviewText: ComputedRef<string>
  collectEnabled: Ref<boolean>
  collectTaskCard: ComputedRef<{
    pills: Array<{ label: string, kind: string }>
    cells: Array<{ label: string, value: string }>
  }>
  handleCollectToggle: () => void
  loadCollectCronPreview: () => Promise<void>
  saveCollectConfig: (options?: { revertCheckboxOnError?: boolean }) => Promise<void>
  triggerCollectTask: () => Promise<void>
}
```

```typescript
export function installLegacyCollectTaskBridge(): void
```

```javascript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:collect-page', {
  detail: { rawConfig, overview },
}))
```

### 3. Contracts

- `src/docker/webui/collect.ts` owns visible collect page DOM state and actions through Vue refs and `requestJson()`.
- `main.ts` must install `installLegacyCollectTaskBridge()` before `installLegacySimpleTaskActionsBridge()` and `installLegacyTaskActionsBridge()`.
- `App.vue` must bind the collect enable switch, cron input, cron preview, save button, and manual trigger button through Vue state/events.
- `task-pages.ts` must dispatch `douyu-keep-webui:collect-page` details instead of mutating `#collect-task-card`, `#collect-enable`, `#collect-cron`, or `#collect-cron-preview`.
- The transitional event bridge in `events.ts` must not handle `data-action="save-collect"`, `#collect-cron`, or `#collect-enable` after Vue owns the collect page.
- `task-actions.ts` must delegate collect save/disable through `window.DOUYU_KEEP_WEBUI_COLLECT_TASK_ACTIONS.create(...)`.
- Save/disable requests preserve the existing API contract: `POST /api/config` with `collectGift: { active, cron }`.
- Manual trigger preserves the existing user-facing behavior: `POST /api/trigger/collectGift`, `执行完成` success toast, then refresh overview/logs/fan status through legacy refresh functions while those surfaces remain transitional.
- Unauthorized errors must flow through the shared request helper and avoid duplicate local toasts.
- Non-401 failures must keep existing Chinese toast prefixes for save, disable, and trigger failures.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| Raw config loads | Vue populates collect enabled state and cron field |
| Overview loads | Vue updates the collect task status card |
| User saves collect task | `POST /api/config` with `active: true`, success toast, overview refresh |
| User disables collect task | `POST /api/config` with `active: false`, success toast, overview refresh |
| User edits collect cron | Vue refreshes the preview through `/api/cron-preview` and ignores stale responses |
| User triggers collect manually | `POST /api/trigger/collectGift`, success toast, overview/log/fan-status refresh |
| Any action returns `401` | Global unauthorized handling runs without a duplicate collect page toast |
| Any action fails with non-401 | Preserve the existing action-specific error toast |

### 5. Good/Base/Bad Cases

- Good: Vue owns collect inputs/buttons while `task-actions.ts` delegates collect actions to the bridge for transitional callers.
- Good: `task-pages.ts` sends `douyu-keep-webui:collect-page` state details, leaving DOM updates to Vue bindings.
- Base: Other send-room task pages remain in legacy task renderers until their own slices migrate.
- Bad: `events.ts` handles `data-action="save-collect"` after Vue owns the collect save button.
- Bad: `task-pages.ts` writes `.value`, `.checked`, or `.innerHTML` on collect nodes after Vue owns them.
- Bad: Collect trigger remains only as `data-action="trigger"` / `data-trigger="collectGift"` after Vue owns the collect page.


### 6. Wrong vs Correct

#### Wrong

```javascript
byId('collect-cron').value = config.collectGift.cron
```

#### Correct

```javascript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:collect-page', {
  detail: { rawConfig: config, overview: state.overview },
}))
```

## Scenario: Vue-Owned Transitional Overview Page

### 1. Scope / Trigger

- Trigger: Moving the Docker WebUI overview page from legacy `innerHTML` rendering into Vue while legacy modules still own raw config, overview, fans-status loading, and protected-state reset orchestration.
- Scope: Overview status cards, gift summary metrics, fans status note, fans status table, "前往登录" empty-state action, refresh button busy state, and the legacy bridge events that feed those surfaces.

### 2. Signatures

```typescript
export function useOverviewPage(): {
  overviewFansEmptyText: ComputedRef<string>
  overviewFansNote: ComputedRef<string>
  overviewFansRows: ComputedRef<Array<{
    doubleKind: string
    doubleLabel: string
    index: number
    intimacy: string
    level: number | string
    name: string
    rank: number | string
    roomId: number
    today: number | string
  }>>
  overviewGiftMetrics: ComputedRef<Array<{ label: string, value: string }>>
  overviewStatusCells: ComputedRef<Array<{
    disabledText: string
    enabled: boolean
    enabledText: string
    label: string
  }>>
  refreshLoading: Ref<boolean>
  refreshOverview: () => void
  refreshOverviewTitle: ComputedRef<string>
  showOverviewFansTable: ComputedRef<boolean>
  showOverviewLoginAction: ComputedRef<boolean>
}
```

```javascript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:overview-page', {
  detail: {
    fansStatus,
    fansStatusDetailsLoaded,
    fansStatusDetailsLoading,
    fansStatusLoaded,
    fansStatusLoading,
    giftStatus,
    hasCookieSourceConfigured,
    managedLoading,
    overview,
  },
}))
```

```javascript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:refresh-state', {
  detail: { loading },
}))
```

```typescript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:refresh-overview-request'))
```

### 3. Contracts

- `src/docker/webui/overview.ts` owns visible overview page state and converts legacy state snapshots into Vue-computed view models.
- `App.vue` must render overview cards, gift metrics, note text, login empty-state action, and the fans status table through Vue bindings.
- `pages.ts` must dispatch `douyu-keep-webui:overview-page` details and must not mutate `#overview-basic-summary`, `#overview-gift-summary`, `#overview-fans-note`, or `#overview-fans-table-wrap`.
- `legacy-app.ts` may compute active refresh loading from transitional state, but it must publish that state through `douyu-keep-webui:refresh-state` instead of mutating the refresh button DOM.
- `events.ts` must listen for `douyu-keep-webui:refresh-overview-request` and call `refreshOverviewSurface(true)` through the legacy event bridge; `App.vue` must not use `data-action="refresh-overview"` after Vue owns the button.
- The overview page must preserve the existing lazy-load behavior: selecting overview with a configured cookie source still asks legacy resource actions to load fans status when needed.
- Empty/loading/error copy must stay stable during framework-only migration.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| Overview has not loaded | Vue shows `-` summary values, `正在加载粉丝牌状态…`, and `请稍候…` |
| No Cookie source is configured | Vue shows `未配置` gift metrics, the existing Cookie requirement note, and a Vue `@click` login navigation button |
| Fans status is loading for the first time | Vue shows `同步中` gift metrics and the existing loading copy |
| Fans status has not loaded yet | Vue shows `待刷新` gift metrics and the refresh hint |
| Gift details are still loading | Vue shows `检测中` when no previous gift status exists, and keeps the fans table visible when previous fans data exists |
| Gift status has an error | Vue shows `未知` gift metrics and includes the backpack error in the note |
| Fans status is empty | Vue shows the existing empty text without rendering an empty table |
| Fans status has rows | Vue renders the table with the existing classes, `data-label` mobile labels, scoped headers, and double-card status pills |
| Active refresh is loading | Vue disables the refresh button, sets `aria-busy="true"`, and uses the `正在刷新` title |
| Refresh is clicked | Vue dispatches `douyu-keep-webui:refresh-overview-request`; legacy resource actions perform the refresh and success toast |

### 5. Good/Base/Bad Cases

- Good: Vue owns the overview DOM and legacy code sends a single `overview-page` snapshot whenever overview or fans state changes.
- Good: Refresh button state flows from legacy active-surface loading calculation into Vue through a small event payload.
- Base: Keep refresh orchestration in the Vue-owned `resources.ts` bridge while remaining legacy action modules consume `DOUYU_KEEP_WEBUI_RESOURCE_ACTIONS`.
- Bad: Reintroducing `innerHTML` writes for overview cards or tables after Vue owns the page.
- Bad: Keeping a `data-action="refresh-overview"` button in `App.vue`; that lets the legacy click dispatcher own a Vue control.
- Bad: Rendering the fans table with different classes/headers during a framework-only migration, because responsive table CSS depends on those names.


### 6. Wrong vs Correct

#### Wrong

```javascript
byId('overview-fans-table-wrap').innerHTML = buildFansStatusTable(state.fansStatus)
```

#### Correct

```javascript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:overview-page', {
  detail: { overview: state.overview, fansStatus: state.fansStatus },
}))
```

## Scenario: Vue-Owned Transitional Yuba Task Page

### 1. Scope / Trigger

- Trigger: Moving the Docker WebUI Yuba check-in task page and Yuba status resource loader from legacy DOM mutation into Vue while keepalive, double-card, and expiring-gift still use legacy task renderers.
- Scope: Yuba task status card, enable switch, cron input, mode select, cron preview, save/disable actions, manual trigger action, `/api/yuba/status` loading, status table rendering, and the Yuba resource/task bridges used by transitional action assembly.

### 2. Signatures

```typescript
export function useYubaTaskPage(): {
  handleYubaToggle: () => void
  loadYubaCronPreview: () => Promise<void>
  saveYubaConfig: (options?: { revertCheckboxOnError?: boolean }) => Promise<void>
  showYubaTable: ComputedRef<boolean>
  triggerYubaTask: () => Promise<void>
  yubaCron: Ref<string>
  yubaCronPreviewText: ComputedRef<string>
  yubaEmptyText: ComputedRef<string>
  yubaEnabled: Ref<boolean>
  yubaMode: Ref<'followed'>
  yubaNote: ComputedRef<string>
  yubaTableRows: ComputedRef<Array<{
    error: string
    expText: string
    groupId: string
    groupLevel: string
    groupName: string
    index: number
    rank: string
    signed: boolean
  }>>
  yubaTaskCard: ComputedRef<{
    pills: Array<{ label: string, kind: string }>
    cells: Array<{ label: string, value: string }>
  }>
}
```

```typescript
export function installLegacyYubaBridge(): void
```

```javascript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:yuba-page', {
  detail: {
    rawConfig,
    overview,
    yubaStatus,
    yubaStatusError,
    yubaStatusLoaded,
    yubaStatusLoading,
  },
}))
```

### 3. Contracts

- `src/docker/webui/yuba.ts` owns visible Yuba page DOM state and actions through Vue refs, computed table rows, and `requestJson()`.
- `main.ts` must install `installLegacyYubaBridge()` before `installLegacyResourceActionsBridge()`, `installLegacySimpleTaskActionsBridge()`, and `installLegacyTaskActionsBridge()`.
- `App.vue` must bind the Yuba enable switch, cron input, mode select, cron preview, save button, trigger button, note, status card, and table through Vue state/events.
- `task-pages.ts` must dispatch `douyu-keep-webui:yuba-page` details and call `ensureYubaStatusForActiveTab()` instead of mutating `#yuba-task-card`, `#yuba-enable`, `#yuba-cron`, `#yuba-note`, or `#yuba-table-wrap`.
- The transitional event bridge in `events.ts` must not handle `data-action="save-yuba"`, `#yuba-cron`, or `#yuba-enable` after Vue owns the Yuba page.
- `task-actions.ts` must delegate Yuba save/disable through `window.DOUYU_KEEP_WEBUI_YUBA_TASK_ACTIONS.create(...)`.
- `resources.ts` must compose Yuba resource actions through `window.DOUYU_KEEP_WEBUI_YUBA_RESOURCE_ACTIONS.create(...)`; do not reintroduce `src/docker/webui/app-yuba-resource-actions.js` or `src/docker/webui/app-resource-actions.js`.
- Save/disable requests preserve the existing API contract: `POST /api/config` with `yubaCheckIn: { active, cron, mode: 'followed' }`.
- Manual trigger preserves the existing user-facing behavior: `POST /api/trigger/yubaCheckIn`, `执行完成` success toast, then refresh overview/logs/Yuba status through transitional refresh functions.
- Yuba status loading preserves the existing coalescing contract: reuse `resource.pending`, increment `requestSeq`, update legacy `state.yubaStatus*`, call `markResourceLoaded('yubaStatus')`, and return `trackResourceRequest(resource, requestSeq, pending)`.
- Unauthorized errors must flow through the shared request helper and avoid duplicate local toasts.
- Non-401 failures must keep existing Chinese toast prefixes for save, disable, trigger, and status-load failures.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| Raw config loads | Vue populates Yuba enabled state, cron field, and mode select |
| Overview loads | Vue updates the Yuba task status card |
| User saves Yuba task | `POST /api/config` with `active: true`, success toast, overview refresh |
| User disables Yuba task | `POST /api/config` with `active: false`, success toast, overview refresh |
| User edits Yuba cron | Vue refreshes the preview through `/api/cron-preview` and ignores stale responses |
| User triggers Yuba manually | `POST /api/trigger/yubaCheckIn`, success toast, overview/log/Yuba-status refresh |
| No Cookie source is configured | Yuba status state is cleared, the page shows the existing Cookie requirement copy, and optional refresh toast says to save Cookie or enable CookieCloud |
| `/api/yuba/status` is already pending | Return the in-flight promise without starting another client request |
| `/api/yuba/status` succeeds | Store `groups`, mark the resource loaded, update the Vue table, and optionally toast success |
| `/api/yuba/status` fails before any loaded data exists | Show the existing failure note/empty state and a failure toast |
| Any action returns `401` | Global unauthorized handling runs without a duplicate Yuba page toast |
| Any action fails with non-401 | Preserve the existing action-specific error toast |

### 5. Good/Base/Bad Cases

- Good: Vue owns Yuba inputs, buttons, note, and table while legacy resource orchestration still calls a bridge named `DOUYU_KEEP_WEBUI_YUBA_RESOURCE_ACTIONS`.
- Good: `task-pages.ts` sends `douyu-keep-webui:yuba-page` state details and leaves visible DOM updates to Vue bindings.
- Base: Yuba status tables are Vue-rendered with the same classes after the legacy table helper cleanup; do not reintroduce `app-table-render.js` for migrated table surfaces.
- Bad: `events.ts` handles `data-action="save-yuba"` after Vue owns the Yuba save button.
- Bad: `task-pages.ts` writes `.value`, `.checked`, `.textContent`, or `.innerHTML` on Yuba nodes after Vue owns them.
- Bad: Moving Yuba status loading to Vue but dropping `resource.pending` coalescing or `trackResourceRequest()` breaks the request-smoothing contract.


### 6. Wrong vs Correct

#### Wrong

```javascript
byId('yuba-table-wrap').innerHTML = buildYubaStatusTable(state.yubaStatus)
```

#### Correct

```javascript
document.dispatchEvent(new CustomEvent('douyu-keep-webui:yuba-page', {
  detail: { rawConfig: getRawConfig(), overview: state.overview, yubaStatus: state.yubaStatus },
}))
```

## Scenario: Vue-Owned Transitional Boot Bridge

### 1. Scope / Trigger

- Trigger: Removing the remaining production boot modules from `src/docker/webui/app*.js` after their behavior has moved behind TypeScript bridge installers.
- Scope: `main.ts` bridge installation order, the TypeScript action/page/task-page/event/app bridge modules, and deleted-file contracts for the former production boot modules.

### 2. Signatures

```typescript
installLegacyEventBridge()
installLegacyTaskPageBridge()
installLegacyPageBridge()
installLegacyActionBridge()
createApp(App).mount('#app')
startLegacyApp()
```

### 3. Contracts

- `src/docker/webui/main.ts` must import and install the TypeScript bridge installers directly; it must not dynamically import `./app.js`, `./app-actions.js`, `./app-events.js`, `./app-pages.js`, or `./app-task-pages.js`.
- Core, state, request, resource, cookie, task action, event, page, and task-page bridges must be installed before `startLegacyApp()` runs.
- `createApp(App).mount('#app')` must run before `startLegacyApp()` so Vue-owned shell/auth/page DOM is mounted before the transitional app startup dispatches state into it.
- `src/docker/webui/legacy-app.ts` owns transitional app startup and publishes `DOUYU_KEEP_WEBUI_LEGACY`.
- `src/docker/webui/actions.ts`, `src/docker/webui/pages.ts`, `src/docker/webui/task-pages.ts`, and `src/docker/webui/events.ts` own the former production boot bridge surfaces for actions, page state dispatch, task-page state dispatch, and event binding.
- The former production boot modules `src/docker/webui/app.js`, `src/docker/webui/app-actions.js`, `src/docker/webui/app-events.js`, `src/docker/webui/app-pages.js`, and `src/docker/webui/app-task-pages.js` must not exist.
