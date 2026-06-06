# WebUI error feedback surfaces

## Goal

Define a unified WebUI error feedback strategy across page/inline errors, running-log errors, and temporary toast feedback so users can understand failures after transient notifications disappear, without turning runtime logs into a catch-all UI error sink or adding a broad notification framework.

## User Request

* Create a Trellis brainstorm task named `WebUI error feedback surfaces`.
* Do not implement yet.
* Inventory current toast, inline error, and running log error usage.
* Analyze "page errors", "running log errors", and "temporary toast feedback" as candidate categories rather than assuming they are the final taxonomy.
* Produce a PRD draft and recommended minimum implementation scope for confirmation before development.

## What I Already Know

* Maintained WebUI code lives under `src/docker/webui/`.
* The WebUI is Vue/Vite. State is Vue refs/computed values in focused page/resource modules; there is no global store.
* Backend route failures use JSON `{ error: string }`; frontend `requestJson()` converts those into `Error` objects with optional `status`.
* 401/session failures are intentionally not surfaced as noisy toasts. They dispatch auth state and return users to the login shell.
* Runtime logs are an in-memory operational timeline capped at 500 entries and mirrored to `console.log`.
* Prior discussion explicitly deferred overview fans-status inline errors and running-log policy changes during the focused WebUI smoke fixes.

## Research References

* [`research/current-feedback-inventory.md`](research/current-feedback-inventory.md) - code-backed inventory of current toast, inline/page error, and running-log surfaces.

## Current Inventory Summary

### Toasts

* `showToast(message, ok)` is event-based and rendered once at the app root.
* Toasts are single-slot, non-queued, and disappear after 3200ms.
* Direct `showToast(` calls appear about 47 times in `src/docker/webui/`.
* `requestJson()` supports `errorToast`, but it defaults to `false`; only theme save failure currently uses this option.
* Toasts currently cover both success and failure for command-style actions: login/logout, save/disable/trigger, top refresh, log clear, cookie save/sync/check, QR login outcomes, and local double-card validation.
* Some resource-load failures are toast-only or toast-plus-inline depending on the resource.

### Inline / Page Errors

* Auth errors are persistent page errors through `loginError` and `AuthShell.vue` `role="alert"`.
* Cron validation errors are persistent field-level text through `useCronPreview()`.
* CookieCloud diagnostics and QR login status are rendered inside the login page.
* Fans list failures are persisted as `fansListError` and shown in task-page note/empty text.
* Yuba status failures are persisted as `yubaStatusError` and shown in Yuba page note/empty text.
* Yuba row failures and expiring backpack failures are rendered near the affected rows/section.
* Overview fans-status failures are not persisted. `loadFansStatus()` shows `加载粉丝牌状态失败：...` as a toast, then the overview body falls back to generic `待刷新` / `尚未加载粉丝牌状态` text.

### Running Logs

* Runtime logs are `{ timestamp, category, message }` entries with no explicit severity.
* The logs page displays the timeline and auto-refreshes every 5s only when authenticated and active.
* Scheduler/task code logs task starts, manual triggers, busy skips, execution failures, credential recovery decisions, and task reload summaries.
* WebUI request failures are generally not written into runtime logs unless the backend operation itself logs something.
* Manual task failures can appear both as toast and logs: the toast reports immediate command failure, while the log preserves diagnostic sequence.

## Candidate Category Analysis

### Candidate A: Page / Inline Errors

Best fit:

* Failures that make the current page, field, or data section incomplete, stale, or misleading.
* Validation errors tied to a specific input.
* Retryable resource-load failures where the user needs context after a toast disappears.
* Auth/session messages that block app usage.

Strengths:

* Persistent and contextual.
* Can include retry guidance near the affected data.
* Works well for screen-reader semantics already present in the app.

Weaknesses:

* Requires explicit state ownership and careful clearing.
* Can become stale if not reset on new requests, successful refreshes, auth changes, or cookie changes.
* Can clutter dense task pages if every transient command failure becomes inline text.

### Candidate B: Running Log Errors

Best fit:

* Backend/runtime facts: scheduled task execution, manual task execution, credential recovery, scheduler reconciliation, CookieCloud/runtime lifecycle.
* Failures that may need chronological diagnosis across multiple steps.
* Background failures that occur when the user is not on the relevant page.

Strengths:

* Persistent until the 500-entry buffer rotates.
* Preserves sequence and category.
* Useful for support/debugging complex auth, CookieCloud, Yuba, and task execution flows.

Weaknesses:

* Not visible unless the user opens the Logs page.
* No severity/filtering today.
* Detached from the current UI surface, so it is a poor primary signal for form validation or current-page data load failures.

### Candidate C: Temporary Toast Feedback

Best fit:

* Immediate acknowledgement of explicit user commands.
* Short success/failure confirmations where the page state already updates or remains obvious.
* Supplemental attention signal for a failure that also has a durable page/log home.

Strengths:

* Fast and global.
* Existing code already uses it widely.
* Good for command completion, especially when the affected area is off-screen.

Weaknesses:

* Ephemeral after 3200ms.
* Single-slot replacement can hide earlier failures.
* Not enough as the only surface for blocking resource-load failures.
* Can become noisy or duplicative when paired with inline errors for background refreshes.

## Proposed Strategy To Validate

This is a proposal, not an approved decision. Use the three candidate categories as surfaces, not as a single rigid taxonomy. Route failures by ownership and persistence:

1. **Session/auth failures**: auth shell owns them. 401 stays out of toast and out of page resource error state.
2. **Current page/resource cannot render correctly**: page/inline state is authoritative. Toast can supplement explicit user-triggered refreshes, but the page must remain understandable after the toast disappears.
3. **Runtime/task execution facts**: running logs are authoritative. Toast can report immediate manual trigger success/failure, but logs carry the durable diagnostic sequence.
4. **Command acknowledgement**: toast is authoritative when the command result is short-lived and does not leave the page in a degraded state.
5. **Missing credential/precondition states**: prefer page guidance when the page is already showing the relevant setup path; use toast only when the user explicitly clicks an action that cannot proceed.

Policy shorthand:

* If the user needs the message after 3.2 seconds to understand the current page, it cannot be toast-only.
* If the message explains what the backend/runtime did over time, it belongs in running logs.
* If the message only acknowledges a user command, toast is usually enough.
* If the same failure has two surfaces, they should have distinct jobs: toast = attention now; inline/log = durable explanation.

## MVP Scope Options (User Decision Pending)

Decision: user selected **Option C: Broader Feedback Consistency Pass**.

Boundary decision: do **not** add runtime log severity, filtering, highlighting, persistence, schema changes, or other running-log presentation changes in this task. Running logs keep their current shape and role.

### Option A: Narrow Overview Inline Error Fix (recommended)

Fix the known overview gap without broad redesign:

1. Add persistent fans-status error state in `resource-fans.ts` for `loadFansStatus()` failures.
2. Clear that state on successful fans-status loads, new relevant requests, cookie-backed data clearing, and resource invalidation.
3. Render the fans-status error in the overview fans area:
   * no prior data: show `加载粉丝牌状态失败：<error>。请点击顶部“刷新”重试。`
   * stale prior data exists: show `本次刷新失败：<error>。当前显示上次结果。`
4. Keep current running-log behavior unchanged.
5. Keep current toast infrastructure unchanged. Do not add a toast queue, severity model, or global notification store in this MVP.
6. Add focused tests for the new persistent overview error behavior and for clearing the error on success/retry.
7. After implementation, record the resulting feedback-surface convention in the frontend state/spec docs if the code change establishes a reusable rule.

Why this option:

* It addresses the documented user-visible gap from prior WebUI smoke/optimization discussion.
* It aligns overview with existing task-page behavior for fans list and Yuba errors.
* It avoids touching backend error contracts, runtime logs, or all 47 toast call sites.
* It creates a concrete pattern future resource errors can follow.

Trade-off:

* It improves the highest-confidence gap, but leaves broader toast/inline/log consistency cleanup for later.

### Option B: Strategy-Only Task, No Code Yet

Finalize the feedback-surface policy in PRD/spec notes only, then stop.

Why choose this:

* Useful if the product direction is not settled and you want a sharper taxonomy before any UI change.
* Avoids even small behavior changes.

Trade-off:

* The known overview toast-only error gap remains unfixed.

### Option C: Broader Feedback Consistency Pass

Implement Option A plus a wider audit of duplicate or missing durable surfaces, potentially including logs page load errors, toast-plus-inline duplication rules, and `requestJson(errorToast)` usage.

Why choose this:

* Produces a more complete cleanup in one task.
* Can reduce future drift if the strategy needs to become a reusable convention immediately.

Trade-off:

* Larger blast radius across many call sites and more test/smoke coverage needed.

Initial interpretation, pending one more boundary decision:

* Include the overview fans-status persistent inline error gap.
* Include durable logs-page request/load/clear feedback if the current toast-only behavior leaves the Logs page ambiguous.
* Include a pass over current toast-plus-inline duplication to define and apply a small rule where obvious.
* Include focused `requestJson(errorToast)` cleanup only where it reduces duplicated local catch/toast code without obscuring page-owned state.
* Do not add toast queueing, runtime log severity/filtering, backend log schema changes, or a global notification store unless explicitly confirmed separately.

Final Option C boundary:

* Frontend-only feedback consistency pass.
* Keep running-log data model and Logs page presentation unchanged, except page-local inline feedback for the Logs page's own load/clear request failures if needed.
* Do not change backend log categories, log retention, task log messages, or public API error shape.

## Trigger Source Rules

Decision: user approved adding trigger-source rules to prevent Option C from becoming noisy or duplicative.

The feedback surface depends on both **what failed** and **how the failure was triggered**:

1. **Explicit user action**
   * Toast is allowed as immediate feedback.
   * If the action leaves current page data missing, stale, or ambiguous, inline/page feedback is still required.
   * In toast-plus-inline cases, toast should be a short pointer such as `刷新失败，请查看页面提示`, not a full duplicate of the inline error.
2. **Automatic load / tab switch / background refresh**
   * Do not toast.
   * Update inline/page state only, so users are not interrupted by errors from work they did not explicitly trigger.
3. **Page resource error**
   * Inline/page feedback is authoritative.
   * Toast can only supplement explicit user-triggered failures.
4. **Running log**
   * Logs only record backend/runtime facts.
   * Frontend page request failures do not create runtime log entries.
   * Logs page's own load failure is page-local inline feedback, not a new runtime log entry.

Logs page boundary:

* `加载日志失败` should get inline/page feedback because the Logs page may be empty or stale.
* `清空日志失败` may remain toast-only because existing logs remain visible and the page is not ambiguous.

## Feedback Surface Content Rules

### Toast Content

Toast is for immediate, temporary feedback from explicit user actions.

Use toast for:

* Success acknowledgements: saved, enabled/disabled, refreshed, cleared, login/logout completed, QR snapshot saved, manual task completed.
* Immediate command failures: save failed, trigger failed, sync/check failed, clear failed, QR action failed.
* Local action/precondition failures caused by a click: missing credential for a clicked sync/status action, invalid double-card weight, unsupported action mode.
* Supplemental attention when a user-triggered refresh also updates a durable inline error.

Do not use toast as the only place for:

* A resource-load failure that leaves the current page empty, stale, or ambiguous.
* Login/session failures. 401 stays owned by the auth/session path.
* Multi-step runtime explanations or diagnostic timelines.
* Long operational detail that belongs in running logs.

Toast copy should be short and action-oriented, usually `动作结果` or `动作失败：<error>`.

### Inline / Page Content

Inline/page feedback is for durable, contextual state on the current page.

Use inline/page feedback for:

* Login/auth blocking messages on the login shell.
* Field-level validation or preview failures, such as cron preview errors.
* Page resource failures that affect visible data: overview fans status, fans list, Yuba status, backpack detail, and logs page load state.
* Stale-data explanation when a refresh fails but old data is still shown.
* Retry guidance near the affected table, note, field, or panel.

Inline copy should name the affected surface and whether data is missing or stale:

* No usable data: `加载<资源>失败：<error>。请点击顶部“刷新”重试。`
* Stale data still visible: `本次刷新失败：<error>。当前显示上次结果。`
* Field validation: `<字段>校验失败：<error>`
* Page setup/precondition: explain the missing setup and point to the relevant action, not just repeat the backend error.

Inline state must clear on a successful reload, a new relevant request, auth/session reset, or credential/config change that invalidates the old resource.

### Running Log Content

Running logs are for backend/runtime operational history, not for generic frontend request feedback.

Keep logs for:

* Startup/config/runtime lifecycle events.
* Scheduler reconciliation and task start/stop/reload summaries.
* Scheduled and manual task execution sequence.
* Task execution failures and busy-skip events.
* Credential recovery decisions and non-secret recovery outcomes.
* CookieCloud/runtime sync events already produced by backend runtime code.

Do not add logs for:

* Pure frontend display state changes.
* Field validation failures such as cron preview.
* Toast-only command acknowledgements.
* Page-local request failures unless the backend/runtime operation already naturally logs that operational event.

Log copy must remain non-secret and high-level. It must not include raw cookies, passwords, login URLs, QR secrets, JWTs, `LTP0` values, or large response bodies.

## Open Questions

* Final implementation confirmation: proceed with Option C using the content rules and trigger-source rules above?

## Non-MVP Follow-Ups

* Decide whether logs page load failures should get a persistent logs-page inline error in addition to toast.
* Consider a small helper or policy option for resource loaders to distinguish background-load failures from explicit user-triggered refresh failures.
* Audit duplicate toast-plus-inline cases after the overview gap is fixed.
* Consider runtime log severity/filtering only if users need to scan errors in the Logs page more efficiently.
* Consider broader `requestJson(errorToast)` usage only if a consistent action-level policy emerges.

## Out of Scope

* Implementing anything before user confirmation.
* Replacing the toast system.
* Adding a toast queue or stacking behavior.
* Adding runtime log levels, filters, persistence, or backend log schema changes.
* Changing public API error response shape.
* Converting all current `showToast()` call sites in one pass.
* Changing auth 401 behavior.

## Requirements

* Preserve existing auth behavior: 401 responses return users to the auth surface without duplicate toasts.
* Preserve runtime log meaning as operational timeline, not generic frontend error storage.
* Preserve existing command success/failure toasts unless the user approves a broader cleanup.
* Add durable page feedback when a resource failure leaves the current page ambiguous.
* Keep implementation small and testable.

## Acceptance Criteria

* [x] Current toast, inline/page error, and running-log usage is inventoried with code-backed notes.
* [x] Candidate categories are analyzed without treating them as a pre-decided final taxonomy.
* [x] PRD proposes a unified feedback strategy with trade-offs.
* [x] PRD defines MVP scope options instead of treating the recommended scope as final.
* [x] No production code is changed before user confirmation.
* [x] User selects Option A, B, or C before any implementation starts.
* [x] User confirms Option C excludes runtime log severity/filtering/presentation changes.
* [x] User confirms the toast/inline/log content rules before any implementation starts.
* [x] User confirms trigger-source rules before any implementation starts.
* [x] User gives final approval to enter implementation.

## Implementation Notes For Later

* Relevant frontend specs for implementation: `.trellis/spec/frontend/index.md`, `state-management.md`, `component-guidelines.md`, `quality-guidelines.md`, and `type-safety.md`.
* Relevant backend specs if log behavior changes later: `.trellis/spec/backend/logging-guidelines.md` and `.trellis/spec/backend/error-handling.md`.
* Existing archived context: `06-06-focused-webui-smoke-finding-fixes` and `06-06-project-optimization-opportunities`.
* Phase 2 must load `trellis-before-dev` before code changes.
