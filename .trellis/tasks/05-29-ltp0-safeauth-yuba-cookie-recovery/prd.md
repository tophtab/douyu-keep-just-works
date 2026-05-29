# LTP0 safeAuth and Yuba Cookie Recovery

## Goal

Add a CookieCloud-based recovery path that can refresh Douyu main-site login cookies through `passport.douyu.com` `LTP0` + `safeAuth`, then retry failed Douyu tasks once. Also document related project lineage in the README. The design must be explicit about the boundary between the app's local cookie snapshot and the user's browser cookie jar.

## What I already know

* The previous CookieCloud recovery task has been completed, committed, pushed, and archived.
* CookieCloud contains `LTP0` under `passport.douyu.com` in the user's current browser snapshot.
* External reference found earlier: `starudream/sign-task` stores `Did` and `Ltp0`, sends `dy_did` + `LTP0`, and calls `https://passport.douyu.com/lapi/passport/iframe/safeAuth`.
* A local runtime experiment previously confirmed that `LTP0 + dy_did` can call `safeAuth` and return usable main-site login fields such as `acf_uid`, `acf_auth`, `acf_stk`, `acf_ltkid`, `acf_username`, `acf_biz`, `acf_ct`, and `dy_auth`.
* The same experiment did not show `safeAuth` directly returning `acf_yb_*` fishbar cookies.
* The app currently derives fishbar `dy-token` from main-site cookies: `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, `acf_ltkid`.
* The app currently treats fishbar's older cookie path as requiring `acf_yb_auth`, `acf_yb_uid`, and `acf_yb_t`.
* Server-side refresh in Douyu Keep updates only Douyu Keep's local config snapshot. It cannot automatically update the browser's cookie jar because the HTTP response is not processed by the browser.
* CookieCloud is pull-based from browser to app. If the app refreshes cookies locally, CookieCloud will not push them back into the browser.

## Current HAR Findings

See `research/yuba-har-cookie-flow.md`.

The updated HAR at `/mnt/d/Download/yuba.douyu.com.har` still does not expose structured request Cookie headers or Set-Cookie response headers. It does show fishbar frontend code paths for `acf_yb_*`, `X-CSRF-TOKEN`, `dy-token`, login checks, and `safeAuth`, but the captured request list does not show a successful fishbar cookie refresh response in this export.

## Assumptions

* `LTP0` should be read from CookieCloud when CookieCloud is enabled; no manual `LTP0` textbox is part of the MVP.
* The MVP should refresh the app's local main-site cookie snapshot only, not attempt to sync refreshed cookies back into the browser.
* Fishbar-specific `acf_yb_*` refresh remains unproven and should not be promised by this MVP.
* If Douyu rotates session credentials during server-side `safeAuth`, the browser may remain stale or become stale until it performs its own browser-side refresh/login flow. This is a product limitation, not something CookieCloud can solve by itself.

## Requirements

* When CookieCloud is enabled, extract `LTP0` from the `passport.douyu.com` cookie set and `dy_did` from the effective main-site cookie set.
* Add a pure HTTP `safeAuth` helper that uses `LTP0 + dy_did` to refresh main-site Douyu login cookies without launching or automating a browser.
* Merge refreshed main-site cookies into the local `manualCookies.main` snapshot when recovery succeeds.
* Replace the existing "credential failure -> force CookieCloud sync -> retry once" path with a validate-gated credential recovery pipeline:
  * first force-refresh CookieCloud and persist the effective browser snapshot when it changes;
  * then validate the refreshed local main-site snapshot with `getFansList()` before doing any passport refresh;
  * only when validation still reports missing/expired credentials, and when `LTP0` and `dy_did` are available, attempt `safeAuth` to refresh the app's local main-site cookie snapshot;
  * validate again after `safeAuth` succeeds or returns new auth fields;
  * finally retry the original failed operation once only when the recovery pipeline produced a locally usable snapshot.
* Keep the retry budget to one retry for the original operation. CookieCloud sync and `safeAuth` are recovery steps, not separate user-visible retries.
* Use the same staged recovery pipeline for scheduled runtime tasks and WebUI manual status reads, so manual refreshes and background jobs recover consistently.
* Keep `/api/cookie-source/check` local-only; it must not fetch CookieCloud or call `safeAuth`.
* Do not print raw cookies, `LTP0`, CookieCloud passwords, returned auth tokens, or HAR secrets in logs, tests, PRD, or WebUI responses.
* Update README to include this project in the requested sub-series/related-project section.

## Acceptance Criteria

* [ ] CookieCloud extraction can detect whether `passport.douyu.com` has `LTP0` without exposing the value.
* [ ] `safeAuth` helper is covered by tests using mocked responses and redacted fixture data.
* [ ] A successful refresh updates the local main cookie with returned main-site auth fields.
* [ ] Credential failure recovery force-syncs CookieCloud, validates the resulting local snapshot, attempts `safeAuth` only if the synced snapshot is still invalid, then retries the original failed operation only once.
* [ ] WebUI manual reads and scheduled runtime tasks share the same recovery semantics.
* [ ] Credential validation has two levels: required-key checks for cheap diagnostics, and `getFansList()` as the Douyu-backed check that proves the main-site cookie is currently accepted.
* [ ] If `LTP0`, `dy_did`, or returned auth fields are missing, the app logs a clear non-secret reason and falls back to existing behavior.
* [ ] Fishbar status/sign-in behavior benefits from refreshed main-site `dy-token` material when possible.
* [ ] The implementation does not claim to refresh fishbar `acf_yb_*` unless a verified HTTP flow is found.
* [ ] README is updated as requested.
* [ ] `npm run lint`, `npm run type-check`, contract tests, and relevant unit tests pass.

## Technical Approach

Recommended MVP: add a CookieCloud-only passport refresh path.

1. Extend cookie utilities to build a passport-domain cookie header and locate `LTP0` by name.
2. Add a Douyu passport refresh helper in `src/core/` that calls `safeAuth` with `dy_did`, carries `LTP0`, follows/handles the response shape, and returns a sanitized cookie merge result.
3. Add a credential validation helper that uses `getFansList()` and can classify:
   * missing required keys before any network request;
   * main-site cookie accepted by the fans-list endpoint;
   * main-site cookie rejected/expired by known Douyu auth failure messages or missing expected response shape.
4. Extend `DockerCookieSourceManager` with a single recovery method, likely `recoverCredentialSnapshot`, that owns forced CookieCloud pull, validation, optional `safeAuth`, post-refresh validation, and local persistence.
5. Wire runtime credential-retry flow to call the recovery method when CookieCloud is active, instead of directly calling `persistEffectiveCookies(true)`.
6. Keep manual-cookie users on the existing behavior for this MVP.

## Decision (ADR-lite)

**Context**: CookieCloud gives the app a browser cookie snapshot, but the app needs a way to recover when short-lived business cookies expire and the browser would normally refresh them through passport.

**Decision**: Use `LTP0` from CookieCloud as refresh material for a server-side, one-shot, pure HTTP `safeAuth` refresh only after a forced CookieCloud sync still fails local credential validation.

**Consequences**: This improves unattended recovery for the Docker runtime, but it deliberately does not update the browser's cookies. The browser and app can diverge until the browser itself refreshes/login-syncs and CookieCloud later exports a new snapshot.

## Out of Scope

* Browser automation or simulated browser login.
* Writing refreshed app cookies back into the browser or CookieCloud.
* Manual `LTP0` text field in WebUI for MVP.
* Guaranteed refresh of fishbar `acf_yb_*` cookies.
* Using `getBackpackStatus()` / backpack APIs as a fallback credential validation probe.
* Solving Gee / captcha / risk-control flows.

## Definition of Done

* Tests added or updated for cookie extraction, passport refresh, merge behavior, and recovery ordering.
* Lint, type-check, and test suite pass.
* README and any durable backend spec notes updated if the implementation confirms new conventions.
* Logs and API responses remain secret-safe.

## Technical Notes

* Existing cookie source manager: `src/docker/runtime-cookie-source.ts`.
* Existing runtime retry flow: `src/docker/runtime.ts`.
* Existing credential-like failure classifier: `src/docker/server-errors.ts`.
* Existing CookieCloud utilities and diagnostics: `src/core/cookie-cloud.ts`.
* Main-site validation signals:
  * structural: required key presence such as `acf_uid`, `dy_did`, `acf_auth`, `acf_stk`, and fishbar dy-token keys;
  * backed check: use `getFansList()` as the MVP validity probe; it proves main-site auth when the fans-badge table is present;
  * explicitly excluded: do not use `getBackpackStatus()` as a fallback validation probe in this task; it is heavier, depends on backpack business behavior, and can blur credential failure with backpack-specific failure;
  * failure classifier: messages containing missing cookie keys, "未登录", "登录态", "主站 Cookie 缺少", "Cookie 弹幕鉴权失败", or missing expected table shape should be treated as credential failures.
* Existing fishbar token construction: `src/core/yuba-common.ts`.
* Existing fishbar status/check-in flows: `src/core/yuba-status.ts`, `src/core/yuba-check-in.ts`.
* Existing backend guidance: `.trellis/spec/backend/index.md`, especially error handling, logging, quality, and persistence docs.
* Existing frontend guidance applies only if WebUI surface is changed; current MVP should avoid UI changes.
