# State Management

> How state is managed in this project.

---

## Overview

Docker WebUI state is currently split between:

- Vue-local state in `src/docker/webui-src/`
- Transitional legacy browser state under `src/docker/webui/app-state.js`
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
- Do not duplicate the legacy `app-state.js` model into Vue without a migration plan.
- Do not silently convert failed API requests into valid empty UI state.

## Scenario: Vue-Owned Transitional Navigation

### 1. Scope / Trigger

- Trigger: Moving a Docker WebUI behavior slice from `src/docker/webui/*.js` into Vue while the legacy modules still own data fetching/actions.
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

### 6. Tests Required

- Contract tests should assert that Vue navigation code exists and listens for legacy `data-action="tab"` bridge clicks.
- Contract tests should assert that legacy `app.js` no longer mutates `.tab-btn`, `.page`, `#page-title`, or `#page-subtitle` for the migrated surface.
- Run `npm run lint`, `npm run type-check`, and `npm test` after navigation changes.

### 7. Wrong vs Correct

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

- Trigger: Moving a Docker WebUI shell-level control from `src/docker/webui/*.js` into Vue while legacy modules still own auth, raw config loading, and most data actions.
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

### 6. Tests Required

- Contract tests should assert that `App.vue` uses `useThemeMode()` and binds theme buttons through Vue events/state.
- Contract tests should assert that `theme.ts` persists `ui.themeMode`, updates `body[data-theme]`, updates theme meta tags, and listens for `prefers-color-scheme`.
- Contract tests should assert that legacy action/event/page modules no longer contain `saveTheme`, `data-theme-mode` action handling, or `#theme-note` mutation.
- Browser smoke testing should verify login, light/dark/system button selected state, `aria-pressed`, `body[data-theme]`, and persisted config.
- Run `npm run lint`, `npm run type-check`, and `npm test` after theme migration changes.

### 7. Wrong vs Correct

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

- Trigger: Moving Docker WebUI toast and screen-reader live-region feedback from `src/docker/webui/*.js` into Vue while legacy modules still call a shared `toast(message, ok)` helper.
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
- Legacy modules may keep calling `DOUYU_KEEP_WEBUI_DOM.toast(message, ok)`, but that helper must dispatch `douyu-keep-webui:toast` instead of mutating `#toast` or `#toast-live`.
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
- Bad: `app-dom.js` calls `byId('toast')`, edits `#toast-live`, stores `window.__toastTimer`, or a Vue composable duplicates those DOM mutations.

### 6. Tests Required

- Contract tests should assert that `App.vue` uses `useToastRegion()` and binds `#toast-live` to Vue state.
- Contract tests should assert that `toast.ts` exports `useToastRegion()` and the `douyu-keep-webui:toast` bridge.
- Contract tests should assert that `theme.ts` requests shared error-toast feedback through `requestJson()` and no longer queries `#toast`.
- Contract tests should assert that legacy `app-dom.js` dispatches the toast event and no longer touches `#toast`, `#toast-live`, or `window.__toastTimer`.
- Run `npm run lint`, `npm run type-check`, `npm run test:contracts`, and `npm run build:webui` after this migration.

### 7. Wrong vs Correct

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

### 6. Tests Required

- Contract tests should assert that `main.ts` installs `installLegacyRequestBridge()` and no longer imports `app-request.js`.
- Contract tests should assert that `request.ts` exports `requestJson()`, dispatches `douyu-keep-webui:unauthorized`, supports toast feedback, and installs `window.DOUYU_KEEP_WEBUI_REQUEST`.
- Contract tests should assert that auth-owned requests pass `onUnauthorized: false`.
- Run `npm run lint`, `npm run type-check`, `npm run test:contracts`, and `npm run build:webui` after request helper changes.

### 7. Wrong vs Correct

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

- Trigger: Moving Docker WebUI read-only system resource loading out of `src/docker/webui/*.js` while legacy page renderers still consume the loaded state.
- Scope: `/api/config/raw`, `/api/overview`, `/api/logs`, loading/error state for these read-only resources, the `douyu-keep-webui:config` theme notification, and the compatibility bridge used by `app-resource-actions.js`.

### 2. Signatures

```typescript
export function installLegacySystemResourceBridge(): void
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

### 3. Contracts

- `src/docker/webui-src/resources.ts` owns read-only system resource requests through the shared `requestJson()` helper.
- `main.ts` must install `installLegacySystemResourceBridge()` after `app-data.js` is imported and before `app-resource-actions.js` is imported.
- `loadRawConfig()` writes `state.rawConfig`, falls back to a cloned `DEFAULT_RAW_CONFIG` when `/api/config/raw` returns `{ exists: false }`, dispatches `douyu-keep-webui:config`, then calls `renderAll()`.
- `loadOverview()` writes `state.overview` and calls `renderOverview()`.
- `loadLogs()` writes `state.logs`, updates `state.logsRefreshedAt` with the current ISO timestamp, and calls `renderLogsPage()`.
- Unauthorized errors must flow through the shared request helper's `douyu-keep-webui:unauthorized` event and must not show duplicate resource toasts.
- Non-401 failures keep the existing Chinese toast prefixes: `加载配置失败：`, `加载概览失败：`, and `加载日志失败：`.
- Legacy modules may call the bridge while they still render forms/task pages, but they must not reintroduce `app-system-resource-actions.js`.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| `/api/config/raw` returns `{ exists: false }` | Clone default raw config, dispatch theme config event, render all pages |
| `/api/config/raw` returns persisted config | Store it unchanged, dispatch theme mode from `config.ui.themeMode || system`, render all pages |
| `/api/overview` succeeds | Store overview payload and refresh overview-owned legacy render surfaces |
| `/api/logs` succeeds | Store logs array, update refreshed-at timestamp, refresh logs page |
| Any system resource returns `401` | Dispatch/keep the global unauthorized transition without a duplicate toast |
| Any system resource fails with non-401 | Preserve the existing user-facing toast prefix for that resource |

### 5. Good/Base/Bad Cases

- Good: Vue/TS resource code owns fetch/error/loading mechanics while legacy page renderers only consume state and render DOM.
- Base: `app-resource-actions.js` still composes system, fans, and Yuba resource actions through `window.DOUYU_KEEP_WEBUI_SYSTEM_RESOURCE_ACTIONS.create(...)`.
- Bad: `main.ts` imports `src/docker/webui/app-system-resource-actions.js` after the bridge is installed, overwriting the Vue/TS owner.
- Bad: A resource failure is converted to an empty config, empty overview, or empty log list without surfacing an error.

### 6. Tests Required

- Contract tests should assert that `resources.ts` exports `installLegacySystemResourceBridge()`, owns `/api/config/raw`, `/api/overview`, `/api/logs`, and dispatches `douyu-keep-webui:config`.
- Contract tests should assert that `main.ts` installs the bridge and no longer imports `app-system-resource-actions.js`.
- Contract tests should assert that `src/docker/webui/app-system-resource-actions.js` does not exist.
- Run `npm run lint`, `npm run type-check`, `npm run test:contracts`, `npm run build:webui`, and `npm test` after this migration.

### 7. Wrong vs Correct

#### Wrong

```javascript
await import('../webui/app-system-resource-actions.js')
```

#### Correct

```typescript
await import('../webui/app-data.js')
installLegacySystemResourceBridge()
```
