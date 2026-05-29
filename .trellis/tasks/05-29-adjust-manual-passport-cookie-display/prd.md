# Adjust Manual Passport Cookie Display

## Goal

Make the manual passport recovery input match the user's expectation that it behaves like the other cookie fields, and revisit whether `dy_did` should be derived from a passport-domain cookie header instead of only from the saved main-site cookie.

## What I already know

* The previous task added `manualPassport.ltp0` as optional safeAuth recovery material.
* The current WebUI uses `<input type="password">` for `passport.douyu.com LTP0`, clears the field after loading config, and only shows configured/unconfigured status.
* The user wants this not to use password-style hiding; it should be visible like other cookie fields.
* The referenced `starudream/sign-task` project exposes the Douyu recovery material as `did` and `ltp0`; for this app's cookie-oriented UI that maps to cookie fields `dy_did` and `LTP0`.
* CookieCloud cookie extraction already has `buildCookieHeaderForUrl(cookies, targetUrl)`, which domain-matches cookies for `passport.douyu.com`.
* If `dy_did` is stored as a parent-domain Douyu cookie, the passport-domain CookieCloud header should include it.
* Previous recovery still read `dy_did` from the effective main-site cookie and only read `LTP0` from the CookieCloud passport-domain header or manual `manualPassport.ltp0`.

## Assumptions

* Secrets still must not be printed in logs or public config API responses unless the user explicitly changes the public config masking policy.
* `/api/config/raw` remains the internal raw endpoint and may return raw saved config values.
* Recovery should remain centralized in `src/docker/runtime-cookie-recovery.ts`; no task-specific safeAuth branches.

## Decisions

* Manual UI should store a visible `passport.douyu.com Cookie` string, not a password-style standalone `LTP0`.
* The required fields for that cookie string are `LTP0` and `dy_did`.
* Do not add a separate `dy_did` config field; parse it from the passport cookie string or CookieCloud passport-domain header.

## Requirements (evolving)

* Replace password-style hiding for manual passport recovery input with a visible `passport.douyu.com Cookie` field.
* Keep CookieCloud recovery able to derive passport-domain recovery material through `buildCookieHeaderForUrl`.
* Prefer `dy_did` from the passport-domain cookie header when available; fall back to the current main-site cookie only for compatibility.
* Avoid recording `dy_did` as a separate standalone field.
* Keep recovery retry budget unchanged: original operation retries once only after recovery produces a validated local main cookie.

## Acceptance Criteria (evolving)

* [x] Manual passport recovery material is visible in the WebUI input, consistent with the other cookie fields.
* [x] Manual passport recovery parses `LTP0` and `dy_did` from one saved passport cookie string.
* [x] CookieCloud recovery can use `dy_did` from the passport-domain effective cookie header when present.
* [x] No separate manual `dy_did` config field is added.
* [x] Public logs and diagnostics do not print raw recovery material.
* [x] Relevant contract tests pass.

## Definition of Done

* Tests added or updated for UI/input contract and dy_did source behavior.
* `npm run lint`, `npm run type-check`, and relevant tests pass.
* Specs/notes updated if config shape or recovery contract changes.

## Out of Scope

* Browser automation or writing refreshed cookies back to the browser.
* Changing safeAuth retry count.
* Refreshing fishbar `acf_yb_*` directly.

## Technical Notes

* Current input: `src/docker/webui/components/LoginConfigPage.vue`.
* Current WebUI state: `src/docker/webui/cookie.ts`.
* Current recovery pipeline: `src/docker/runtime-cookie-recovery.ts`.
* Current CookieCloud passport helper: `src/core/cookie-cloud.ts`.
* Implementation updates the durable field to `manualPassport.cookie`, with compatibility normalization for legacy `manualPassport.ltp0`.
* External reference: <https://pkg.go.dev/github.com/starudream/sign-task> shows Douyu account config fields `did` and `ltp0`.
