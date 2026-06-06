# Current WebUI Feedback Inventory

Local inventory for the `WebUI error feedback surfaces` brainstorm task. No production code was changed.

## Relevant Conventions

* Maintained WebUI code lives under `src/docker/webui/`.
* Frontend state uses Vue refs/computed values and focused resource helpers; there is no global store.
* Backend route failures use JSON `{ error: string }`, consumed by `requestJson`.
* Runtime logs are in-memory `LogEntry` objects plus `console.log`, capped at 500 entries.
* Protected WebUI pages should not mount before authentication; 401 responses should be treated as session state rather than persisted field validation.

## Toast Surface

* `src/docker/webui/toast.ts` exposes `showToast(message, ok)` as a document event and `useToastRegion()` as a single global region.
* Toasts are normalized to strings, announced through a polite live region, and hidden after 3200ms.
* There is no queue or stacking; a later toast clears the previous timers and replaces the visible message.
* `src/docker/webui/App.vue` renders the global toast and changes color by `toastOk`.
* `src/docker/webui/request.ts` supports `errorToast`, defaults it to `false`, and suppresses 401 error toasts.
* Direct `showToast(` calls currently appear about 47 times in `src/docker/webui/`.
* `errorToast` is mostly unused; the only real caller found is theme save failure in `src/docker/webui/theme.ts`.

Current toast use cases:

* Positive command completion: login success, logout, task saves/disables, manual task triggers, status refresh, log clearing, cookie save/sync/check, QR login saved states.
* Negative command completion: save/disable/trigger failures, CookieCloud failures, QR login terminal/failure states, double-card local validation, missing credential prompts on explicit actions.
* Resource-load failures: logs load, fans sync/list/status, Yuba status. These sometimes also set inline error state, but fans status does not.
* 401/session failures are intentionally not toasts; they dispatch the unauthorized auth path.

## Inline / Page Error Surface

Persistent or page-local feedback exists in these places:

* Auth login errors: `src/docker/webui/auth.ts` sets `loginError`; `AuthShell.vue` renders it with `role="alert"`.
* Cron preview errors: `use-cron-preview.ts` stores `cronPreview.error`; `CronField.vue` renders `cron 校验失败：...`.
* CookieCloud diagnostics: `cookie-source-copy.ts` builds status text and `LoginConfigPage.vue` renders it in `#cookie-cloud-note`.
* Passport QR login: backend public status is stored in `passportQrLogin`; `LoginConfigPage.vue` renders status text, QR progress, retry, and cancel actions. QR failures can also toast.
* Fans-backed task pages: `resource-fans.ts` stores `fansListError`; `task-shared.ts` turns it into note/empty text for keepalive, double-card, and expiring-gift pages.
* Yuba status page: `resource-yuba.ts` stores `yubaStatusError`; `yuba.ts` turns it into note/empty text. Row-level `item.error` is rendered in `YubaStatusTable.vue`.
* Expiring gift page: `giftStatus.error` is rendered as `背包明细暂不可用：...`.
* Overview page: gift-detail errors are shown inline when `giftStatus.error` exists, but fans-status load failures do not have their own persistent error state. If loading fails before status is loaded, the page falls back to generic `待刷新` / `尚未加载粉丝牌状态` after the toast disappears.

Notable gap:

* `resource-fans.ts::loadFansStatus()` catches failures and shows `加载粉丝牌状态失败：...` as a toast, but it does not persist the error. This matches the prior WebUI smoke/optimization finding that overview invalid-cookie failures are mainly toast-only while task pages such as keepalive have useful inline errors.

## Running Log Surface

* `src/docker/logger.ts` stores `{ timestamp, category, message }` in memory, capped at 500 entries, and mirrors each entry to `console.log`.
* `.trellis/spec/backend/logging-guidelines.md` says there are no log levels; categories distinguish `系统` from task-specific logs.
* `src/docker/webui/resource-state.ts` loads and clears logs through `/api/logs`.
* `src/docker/webui/logs-resource.ts` refreshes logs every 5s only when authenticated and the logs tab is active.
* `src/docker/webui/components/LogsPage.vue` displays timestamp, category, and message; it does not distinguish severity visually.
* Runtime scheduler/task code logs task starts, manual triggers, busy skips, scheduled execution errors, task reload summaries, credential recovery decisions, and config/runtime lifecycle messages.

Current boundary:

* Runtime logs are an operational timeline and diagnostic record.
* Frontend request failures such as "load logs failed" or "save form failed" are not written into runtime logs unless the backend operation itself logs something.
* Manual task failures can appear both as a toast (`执行失败：...`) and in runtime logs, because the toast reports the immediate command result while logs preserve the execution timeline.

## Prior Discussion / Task Context

Relevant archived notes:

* `06-06-focused-webui-smoke-finding-fixes`: wrong-password feedback and pre-auth cron preview were fixed; overview fans-status inline error and running-log policy changes were explicitly deferred.
* `06-06-project-optimization-opportunities`: invalid-cookie overview failures were observed mainly via toast; the page body fell back to generic pending text, while keepalive had a better inline error. That task recommended adding a persistent inline error state to overview's fans-status area.
* `05-13-optimize-program-plan`: unauthorized responses should continue through auth without noisy duplicate toasts; frontend unauthorized/error helper consolidation was a known cleanup area.
