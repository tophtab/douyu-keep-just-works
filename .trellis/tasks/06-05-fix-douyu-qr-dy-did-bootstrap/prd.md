# Fix Douyu QR dy_did bootstrap

## Goal

Make locally deployed Passport QR login produce a complete project-owned main/passport snapshot, including `dy_did`, when no browser CookieCloud snapshot is involved.

## What I already know

* Local deployment after the QR main login URL fix reached `main_saved`.
* The saved main cookie contained the expected `acf_*` fields but lacked `dy_did`.
* The saved passport cookie contained `LTP0` only.
* `/api/cookie-source/check` therefore reported `mainCookieReady: false` with `missingMainKeys: ["dy_did"]`.
* Existing QR research says the real browser iframe has `dy_did` and `acf_did` before QR login, but the backend-only QR flow does not have that browser bootstrap.

## Requirements

* Backend-owned QR sessions must create local device cookie material before generating the QR challenge.
* The device material must include `dy_did`; include matching passport-side device fields when useful for parity with browser bootstrap.
* QR challenge generation and polling must carry the session device/passport cookie.
* Successful passport confirmation must merge Douyu's returned `LTP0` with the session device cookie.
* Public QR status must still report `passportSaved` only after `LTP0` exists; waiting sessions with only device material are not passport-saved.
* Main cookie persistence must include `dy_did` so local diagnostics consider the main snapshot complete.
* Raw device IDs and cookies must not appear in public API responses or logs.

## Acceptance Criteria

* [x] Starting a QR session does not mark `passportSaved` true before `LTP0`.
* [x] Runtime QR polling passes the bootstrap cookie into `pollDouyuPassportQrAuth`.
* [x] Successful QR main persistence saves `dy_did` in both `manualPassport.cookie` and `manualCookies.main`.
* [x] Contract tests cover the no-browser `dy_did` bootstrap path without exposing raw secrets.
* [x] Focused tests and Docker type-check pass.

## Out of Scope

* Changing the main login JSONP URL fix from the previous task.
* Changing Yuba SSO behavior beyond carrying the passport cookie that already exists.
* Writing back to browser or CookieCloud.

## Technical Notes

* Core target: `src/core/douyu-passport.ts`.
* Runtime target: `src/docker/runtime-cookie-source.ts`.
* Focused tests: `test/douyu-passport-contract.test.js`.
* Relevant research: `.trellis/tasks/archive/2026-06/06-05-passport-refresh-cookie-authority/research/douyu-qr-passport-login.md`.
