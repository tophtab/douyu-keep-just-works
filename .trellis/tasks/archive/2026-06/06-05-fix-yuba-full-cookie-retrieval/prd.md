# Fix Yuba Full Cookie Retrieval

## Goal

Fix project-owned Passport QR login so the retryable Yuba step can obtain the full Yuba cookie snapshot (`acf_yb_auth`, `acf_yb_uid`, `acf_yb_t`) when passport and main-site snapshots are already valid.

## What I already know

* The local WebUI QR flow reached passport saved and main saved.
* `/api/cookie-source/check` now reports `mainCookieReady: true`, `yubaDyTokenReady: true`, `passportLtp0Present: true`, and no missing main keys.
* `/api/fans` works and returns 10 fans.
* `/api/yuba/status` works through the dy-token path and returns 24 Yuba groups.
* Full Yuba cookie readiness still fails: `yubaCookieReady: false`, missing `acf_yb_auth`, `acf_yb_uid`, and `acf_yb_t`.
* The "retry Yuba" action still fails.
* Archived Yuba SSO research says passport `safeAuth` redirects to `https://yuba.douyu.com/ybapi/authlogin?...code=...&loginType=safeAuth&uid=...`, and that authlogin response is where full Yuba cookies are set.
* Current code calls passport `safeAuth`, lets axios follow/consume redirects, then makes a second request to bare `https://yuba.douyu.com/ybapi/authlogin` without the one-time `code` query.

## Requirements

* Preserve the existing QR passport and main-site behavior.
* Change Yuba SSO to use the `safeAuth` bridge redirect URL, including its query parameters, when requesting `/ybapi/authlogin`.
* Keep the redirect validation restricted to `https://yuba.douyu.com/ybapi/authlogin`.
* Include browser-equivalent Yuba safeAuth parameters needed by the observed flow, including `did` when available from cookie material.
* Merge returned Yuba `Set-Cookie` headers from the bridge response and require `acf_yb_auth`, `acf_yb_uid`, and `acf_yb_t`.
* Preserve existing secret boundaries: no raw cookies, LTP0, login codes, or redirect URLs in public responses/logs/tests.

## Acceptance Criteria

* [x] `fetchDouyuYubaCookiesWithPassport` requests passport `safeAuth` without losing the redirect location.
* [x] The helper requests the redirected Yuba authlogin URL, not bare `/ybapi/authlogin`.
* [x] Invalid or missing Yuba bridge locations fail with a Yuba-specific error.
* [x] Mocked contract tests prove the returned full Yuba cookie fields are merged.
* [x] Focused tests and TypeScript pass.
* [x] Live QR login confirms full Yuba cookies are persisted.

## Out of Scope

* Changing dy-token Yuba status behavior, which already works.
* Adding browser automation.
* Writing refreshed cookies back to the user's browser or CookieCloud.
* Exposing raw diagnostic cookies in API responses.

## Technical Notes

* Main implementation target: `src/core/douyu-passport.ts`.
* Runtime persistence target should continue to be `src/docker/runtime-cookie-source.ts` without changing its public API.
* Focused tests: `test/douyu-passport-contract.test.js`.
* Relevant specs: `.trellis/spec/backend/index.md`, `.trellis/spec/backend/error-handling.md`, `.trellis/spec/backend/database-guidelines.md`, `.trellis/spec/backend/quality-guidelines.md`, `.trellis/spec/backend/logging-guidelines.md`.
* Relevant research: `.trellis/tasks/archive/2026-06/06-05-passport-refresh-cookie-authority/research/yuba-sso-bridge.md`.
* Live validation on 2026-06-05 confirmed QR retry reached `status: yuba_saved`; `/api/cookie-source/check` reported `mainCookieReady: true`, `yubaDyTokenReady: true`, `yubaCookieReady: true`, empty missing-key lists, and `passportLtp0Present: true`.
* Root causes found during live validation:
  * Yuba `safeAuth` must use `client_id=5`; `client_id=1` redirects to the main-site login bridge instead.
  * Passing the old local Yuba cookie snapshot into Yuba `safeAuth` can make Douyu return HTTP 400. The refresh bridge should use passport/main plus only the current run's Yuba seed cookie.
