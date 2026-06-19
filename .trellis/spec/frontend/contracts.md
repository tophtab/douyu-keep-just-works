# Frontend Contracts

> High-risk Docker WebUI contracts. Read only the section whose trigger matches
> the change.

---

## Contract Map

| Trigger | Section |
|---|---|
| Theme bootstrap, `index.html`, or server-served WebUI HTML | [Server-Injected Initial WebUI Theme](#server-injected-initial-webui-theme) |
| Resource loaders, inline resource errors, logs refresh, or resource toasts | [WebUI Resource Error Feedback](#webui-resource-error-feedback) |
| Top-right manual refresh or fans/Yuba cache-backed routes | [Manual Force Refresh Of Cache-Backed Resources](#manual-force-refresh-of-cache-backed-resources) |
| `/api/config` saves or task page save/disable flows | [Applying Config Save Responses](#applying-config-save-responses) |
| CookieCloud "sync and check" or cookie diagnostics | [CookieCloud Sync-And-Local-Check](#cookiecloud-sync-and-local-check) |
| Login page Passport QR flow or QR status consumption | [Passport QR Login Polling](#passport-qr-login-polling) |

---

## Server-Injected Initial WebUI Theme

Trigger: changing WebUI theme initialization, `src/docker/webui/index.html`
bootstrap fields, `src/docker/webui.ts`, or `src/docker/server-webui-routes.ts`.

Contracts:

- Backend `getHtml(themeMode?: unknown)` and frontend
  `useThemeMode(initialThemeMode?: unknown)` both accept only shared `ThemeMode`
  values: `light`, `dark`, and `system`; invalid or missing values fall back to
  `system`.
- Server-rendered HTML must replace `__INITIAL_THEME_MODE__`,
  `__INITIAL_THEME__`, and `__INITIAL_THEME_COLOR__`; placeholders must not
  leak to the browser.
- Initial and runtime resolved themes are written to both `html[data-theme]` and
  `body[data-theme]`. Root viewport scrollbars and root-scoped CSS variables
  read from `html`.
- `system` has no server-side media-query knowledge; first paint may use the
  safe dark theme, then `useThemeMode` updates after mount.
- `watch(rawConfig, ...)` ignores empty/null config so it does not reset the
  bootstrap theme before authenticated config loads.

Tests: request WebUI HTML through `createServer(ctx)`, assert valid configured
theme injection, html/body data-theme output, invalid fallback, no leaked
placeholders, and `App.vue` passing `bootstrap.initialThemeMode`.

## WebUI Resource Error Feedback

Trigger: changing Docker WebUI resource loaders, page-local resource error
state, top-right refresh behavior, logs-page refresh behavior, or toast copy for
resource requests.

Contracts:

- Resource loaders that can leave a page missing, stale, or ambiguous accept
  `showSuccessToast = false`; cache-backed loaders may also accept
  `forceRefresh = false`.
- Loaders resolve `true` for current success, `false` for handled non-401
  failure or explicit precondition failure, and `undefined` for stale or
  401/session paths.
- Page/resource load failures are authoritative in inline/page state when data
  would otherwise be missing, stale, or ambiguous.
- Inline errors clear on a new relevant request, successful reload,
  protected-state reset, or credential/config invalidation.
- Automatic loads, tab-switch loads, and background refreshes pass
  `showSuccessToast = false` and do not toast resource failures.
- Explicit user actions may toast. If inline feedback also exists, the toast is
  a short pointer such as `刷新失败，请查看页面提示`, not a duplicate full error.
- 401 responses stay in the auth/session path: do not toast them or persist them
  as page resource errors.
- Runtime logs are backend/runtime facts, not a sink for frontend request-display
  failures.

Tests: assert durable resource error refs and clear paths, short explicit
failure toasts gated by `showSuccessToast`, automatic loaders using
`showSuccessToast = false`, `logsError` for logs-page load failure, and top-level
refresh deriving failure toast state from `false` loader results.

## Manual Force Refresh Of Cache-Backed Resources

Trigger: changing the top-right WebUI refresh action, resource loaders, or
Docker read routes for fans/Yuba status.

Contracts:

- Only the top-right manual refresh path calls
  `refreshOverviewSurface(activeTab, true, true)`.
- Automatic `loadActiveTabData`, task-save `refreshTaskSurface`, cookie-source
  refreshes, and page-owned refreshes call loaders without `forceRefresh`.
- Frontend resource helpers append `force=1` only when `forceRefresh` is true.
  They do not call Douyu directly or clear Docker caches locally.
- Backend read routes translate `force=1` into
  `CacheRefreshOptions.forceRefresh` for fans list, fans status endpoints, and
  Yuba status. Cache invalidation is scoped to the relevant resource.
- Logs reload does not send `force=1`; login and collect manual refresh reload
  raw config and overview only.
- Same-resource pending requests are reused instead of duplicated.

Tests: assert route query forwarding to `CacheRefreshOptions.forceRefresh`,
runtime cache bypass/pending coalescing for fans and Yuba, and only top-right
manual refresh passing `forceRefresh: true`.

## Applying Config Save Responses

Trigger: changing `/api/config` save handling or task page save/disable flows.

Contracts:

- `POST /api/config -> { ok: true, data?: { config?: DockerConfig, fans?: Fans[] } }`.
- `data.config` is the authoritative persisted config after backend defaults,
  normalization, and reconciliation; apply it to `resource-config.rawConfig`
  before reloading derived surfaces.
- For fans-backed task tabs (`keepalive`, `double-card`, `expiring-gift`),
  `data.fans` is authoritative, including an empty array.
- Non-fans-backed saves may update existing managed config but must not clear an
  existing fans list just because the response carries `fans: []`.
- `managed.config` must not outlive or override newer `rawConfig`.
- Unauthorized save responses are owned by existing session handling; failed
  saves keep existing toast/revert behavior.

Tests: assert `saveTaskConfig` passes `SaveTaskConfigResult`,
`refreshTaskSurface` applies managed fans responses only for fans-backed tabs,
and managed fans helpers attach new fans to `getRawConfig()`.

## CookieCloud Sync-And-Local-Check

Trigger: changing WebUI CookieCloud "同步并校验",
`/api/cookie-source/persist`, or CookieCloud diagnostics.

Contracts:

- When CookieCloud is active, `/api/cookie-source/persist` force-refreshes
  CookieCloud once and persists the effective local login snapshot.
- Persist keeps existing local cookies as fallback when the fresh CookieCloud
  snapshot misses one side; the result may be a hybrid effective snapshot.
- Persist writes `passport.douyu.com` material into `manualPassport.cookie` only
  when the fresh snapshot contains `LTP0`, and preserves existing manual
  passport material when remote material lacks `LTP0`.
- `/api/cookie-source/check` inspects only saved local login cookies. It must
  not fetch CookieCloud or force-refresh remote data.
- The WebUI action runs persist first, then the local-only check endpoint.
- When CookieCloud is inactive, the same check endpoint diagnoses saved manual
  cookies.
- Diagnostics are structural: required keys, cookie count, domains, and
  CookieCloud update time. The WebUI summary should show source, update time,
  readiness, missing keys, and passport recovery-material state; do not expose
  raw cookie values or raw `cookieCount` as user-facing status.

Tests: assert `/api/cookie-source/check` calls local inspection without
force-refresh, `inspectCookieSource` does not call `loadCookieCloudSnapshot`,
CookieCloud persist keeps local fallbacks and writes complete passport material,
diagnostics do not expose raw passport material, frontend sync runs before
check, and the summary omits raw "Cookie 数" status.

## Passport QR Login Polling

Trigger: changing the login page QR flow, `cookie-source-actions.ts`,
`cookie.ts`, or `/api/cookie-source/passport-login/*` consumption.

Contracts:

- WebUI never receives or stores raw `scan_code`, login ticket, `LTP0`, or
  cookie strings from QR APIs.
- The login page places `扫码登录` before `手填保存` in the manual-cookie action
  row. QR image rendering uses `status.qrImageDataUrl` and appears directly
  below that row.
- Poll every 2 seconds while `passportQrLogin.finished === false`; clear timers
  on terminal status and component unmount.
- `scanned` is a real public state. QR progress distinguishes at least `扫码`,
  `确认`, `主站`, and `鱼吧`; scan completes at `scanned` or later,
  confirmation uses `passportSaved`, and main/Yuba use `mainSaved` /
  `yubaSaved`.
- When a status reports `mainSaved` or `yubaSaved`, reload raw config and apply
  it to login form state before refreshing cookie-backed resources.
- `yuba_failed` shows retry only when `canRetryYuba` is true.
- Do not add legacy QR polling fallback endpoints or main-site `getCsrfCookie`
  enrichment unless a separate login-chain task scopes them.
- Unauthorized responses are owned by existing session handling and stop
  polling. Start failure leaves manual fields unchanged.

Tests: assert login page action order and QR placement, separate scan and
confirmation progress nodes, QR imports from `cookie-source-actions.ts` and
`cookie-source-state.ts`, backend QR polling maps scanned/cancelled without
secret leakage, `PassportQrLoginPublicStatus` type coverage, and no raw cookie
fixtures in visible frontend text.
