# Auto Recover Yuba Cookie From Passport

## Goal

When CookieCloud is disabled, failed cookie-backed work should not stop at refreshing only the main Douyu cookie. If a saved passport cookie is available, the centralized credential recovery flow should also attempt to rebuild the Yuba cookie by reusing the existing passport SSO logic used after QR login.

## What I Already Know

* Current recovery is centralized in `src/docker/runtime-cookie-recovery.ts`.
* Runtime task runners already retry once after centralized credential recovery.
* Manual passport cookie is stored under `manualPassport.cookie`.
* `fetchDouyuYubaCookiesWithPassport` already implements the passport + main-cookie SSO flow for Yuba.
* Current safeAuth recovery persists the refreshed main cookie and keeps the existing Yuba cookie unchanged.

## Requirements

* Extend centralized credential recovery to attempt Yuba cookie recovery with saved passport material.
* Reuse the existing `fetchDouyuYubaCookiesWithPassport` helper rather than duplicating SSO request logic.
* Keep CookieCloud behavior compatible: CookieCloud sync still runs first when enabled, then passport recovery can fill gaps.
* Keep the recovery path centralized; task runners and task implementation files must not grow direct safeAuth, LTP0, or Yuba SSO branches.
* Preserve the existing Yuba cookie if Yuba SSO fails but the main-cookie recovery succeeds.
* Log whether Yuba SSO refreshed the Yuba cookie or was skipped/failed.

## Acceptance Criteria

* [x] With CookieCloud disabled and a manual passport cookie containing `LTP0` and `dy_did`, credential recovery can refresh the main cookie and then persist a refreshed Yuba cookie from passport SSO.
* [x] If the current main cookie is already valid but the task failure was Yuba-related, recovery can still attempt Yuba SSO using the saved passport cookie.
* [x] If Yuba SSO fails, main-cookie recovery still succeeds and existing Yuba cookie is retained.
* [x] Contract tests cover manual passport recovery with CookieCloud inactive.
* [x] Existing CookieCloud passport recovery tests still pass.
* [x] Lint/typecheck/tests pass.

## Out Of Scope

* Writing refreshed cookies back to CookieCloud or the browser.
* Changing QR login UX.
* Adding new external dependencies.
* Reworking task-specific error handling outside the centralized recovery hook.

## Technical Notes

* `src/docker/runtime-cookie-recovery.ts` currently calls `refreshDouyuMainCookiesWithSafeAuth` and persists `safeAuthResult.refreshedCookie` with `currentYubaCookie`.
* `src/docker/runtime-cookie-source.ts` already exposes `getCurrentYubaCookie`, `getManualPassportCookie`, and `persistManualCookieSnapshot`.
* `src/core/douyu-passport.ts` exports `fetchDouyuYubaCookiesWithPassport`, which is used by QR login Yuba completion.
* `src/docker/server-errors.ts` already treats Yuba login/dy-token messages as credential errors.
