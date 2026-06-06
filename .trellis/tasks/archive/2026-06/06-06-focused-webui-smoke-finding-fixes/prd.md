# focused WebUI smoke-finding fixes

## Goal

Fix two focused WebUI smoke findings without broad WebUI redesign or error-surface changes.

## What I Already Know

* This is a new implementation task and must not reuse `.trellis/tasks/06-06-project-optimization-opportunities/`.
* The source roadmap's E section recorded that wrong-password feedback exists in the DOM (`登录失败：密码错误`) but is invisible because `#login-error` remains hidden.
* The source roadmap's E section also recorded that hidden unauthenticated configuration components can request protected `/api/cron-preview`; the resulting 401 can leave CookieCloud cron preview stuck on `cron 校验失败：请先登录` after successful login.
* The user has explicitly narrowed this task to only these two fixes.
* The previously discussed overview inline error / running-log error-surface work is deferred and out of scope.

## Requirements

* Fix WebUI management password failure feedback so wrong-password and related login errors are visible on the login shell.
* Prevent unauthenticated hidden WebUI configuration components from poisoning cron preview state with `/api/cron-preview` 401 results.
* After a successful WebUI login, CookieCloud cron preview must not remain stuck on `cron 校验失败：请先登录`.
* Keep scope small. Do not change overview fans-status error behavior, runtime log behavior, toast policy, or broader WebUI layout.

## Acceptance Criteria

* [x] Wrong password shows a visible login error in the login shell.
* [x] Unauthenticated hidden configuration components do not leave CookieCloud cron preview stuck on `cron 校验失败：请先登录` after successful login.
* [x] Existing cron input validation remains visible near cron fields after authentication.
* [x] No overview fans-status inline error or running-log behavior changes are included.
* [x] Lint, type-check, and contract tests pass.
* [x] Do a small WebUI smoke check for login failure and CookieCloud cron-preview recovery if feasible.

## Definition Of Done

* Relevant frontend specs read before coding.
* Changes are limited to the two focused smoke findings.
* Quality gate includes lint, type-check, contract tests, and focused smoke when feasible.

## Out Of Scope

* Overview fans-status inline errors.
* Running-log/error-surface policy changes.
* Removing or adding toasts.
* Disk-backed log persistence.
* Full Playwright smoke-test infrastructure.

## Technical Notes

* `src/docker/webui/auth.ts` sets `loginError`; `src/docker/webui/components/AuthShell.vue` displays it with `v-show`; `src/docker/webui/styles/shell.css` defines `.auth-error`.
* `src/docker/webui/composables/use-cron-preview.ts` owns `/api/cron-preview` calls and currently records request errors into preview state.
* `src/docker/webui/cookie-source-state.ts` calls `ensureCronPreview()` when raw config applies CookieCloud cron values.
