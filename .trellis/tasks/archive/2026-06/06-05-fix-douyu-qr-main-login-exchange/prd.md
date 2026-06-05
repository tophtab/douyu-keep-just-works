# Fix Douyu QR main login exchange

## Goal

Fix the project-owned Douyu Passport QR login flow so the main-site exchange returns the expected `acf_*` login cookies after a user confirms the QR login.

## What I already know

* The QR challenge and polling endpoints still work.
* A live diagnostic confirmed `passport.douyu.com/japi/scan/auth` returns a `www.douyu.com/api/passport/login` URL and `LTP0` after app confirmation.
* Requesting the returned URL as-is can return HTTP 200 with no main-site `Set-Cookie` headers.
* Adding `callback=appClient_json_callback` and `_=<timestamp>` to the main-site URL returned complete main-site cookies, including `acf_uid`, `acf_auth`, `acf_stk`, `acf_ltkid`, `acf_biz`, and `acf_ct`.
* The current shared merge helper reports `safeAuth 未返回可用主站登录字段` even when the failure happens in the QR main-site login exchange.

## Assumptions

* The QR main-site exchange should keep using the returned login URL, but normalize missing JSONP parameters before requesting it.
* Existing safeAuth recovery behavior should remain unchanged.
* No raw login URL, ticket, `LTP0`, or cookie values should be exposed in logs, tests, or public API responses.

## Requirements

* Normalize QR main-site login URLs by adding missing `callback=appClient_json_callback` and `_=<timestamp>` query parameters before the request.
* Preserve any query parameters already returned by Douyu.
* Keep the login URL validation restricted to `https://www.douyu.com/api/passport/login`.
* Split the QR main-site missing-cookie error message from the safeAuth missing-cookie error message.
* Add/update focused contract tests for the URL normalization and QR-specific missing-field error.

## Acceptance Criteria

* [x] `fetchDouyuMainCookiesFromLoginUrl` requests a login URL containing `callback=appClient_json_callback` and `_`.
* [x] The QR main-site exchange still merges returned main-site `Set-Cookie` fields into the local main cookie snapshot.
* [x] Missing main-site cookies during QR exchange report a QR-specific error, not a safeAuth error.
* [x] Existing safeAuth tests still prove safeAuth keeps its current error wording and merge behavior.
* [x] Focused tests pass.

## Definition of Done

* Tests added/updated.
* TypeScript still passes for changed code.
* Relevant Trellis spec/research context is curated.
* Runtime secret boundaries are preserved.

## Out of Scope

* Changing QR generation or polling endpoints.
* Changing Yuba SSO behavior.
* Changing safeAuth recovery beyond preserving existing behavior.
* Persisting or logging raw cookies for diagnostics.

## Technical Notes

* Main implementation target: `src/core/douyu-passport.ts`.
* Focused tests: `test/douyu-passport-contract.test.js`.
* Historical research: `.trellis/tasks/archive/2026-06/06-05-passport-refresh-cookie-authority/research/douyu-qr-passport-login.md`.
* Live diagnostic result from this session: adding JSONP parameters made `www.douyu.com/api/passport/login` return the expected main-site `Set-Cookie` names.
