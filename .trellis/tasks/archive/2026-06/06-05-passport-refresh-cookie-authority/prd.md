# Passport refresh cookie authority MVP

## Goal

Build a project-owned Douyu login snapshot path that does not depend on the user's daily browser CookieCloud snapshot being complete. The MVP uses Passport QR login to capture local passport/main-site/Yuba snapshots, keeps CookieCloud/manual entry as compatibility paths, and defines safe overwrite and recovery rules for local runtime authority.

## What I already know

* User saw CookieCloud diagnostics: main site missing `acf_auth`, `acf_stk`; Yuba dy-token missing `acf_biz`, `acf_stk`, `acf_ct`, `acf_ltkid`; full Yuba cookie missing `acf_yb_auth`, `acf_yb_uid`, `acf_yb_t`; passport Cookie is configured.
* User suspects passport cookie could refresh both live/main and Yuba cookies, but is concerned about overwrite relationships between CookieCloud sync, local snapshots, and browser/cloud state.
* User primarily uses Douyu in the browser and is concerned that project-side passport safeAuth refresh may rotate/invalidate the browser's current main-site cookie. Browser continuity should be treated as a first-class constraint, not an acceptable casualty.
* User is considering using a second browser/platform/profile so the project has a separate passport Cookie/session from the daily-use browser. This could isolate project-side safeAuth rotation from the user's primary browser session if Douyu allows concurrent sessions.
* User provided an Edge-generated passport Cookie for comparison. Field-level comparison against the current CookieCloud passport snapshot showed it is not the same session: `LTP0`, `dy_did`, `acf_did`, and `game_did` all differ, while only `dy_teen_mode` matched among core compared fields.
* Cross-session safeAuth test with CookieCloud passport (A) and Edge passport (B) showed independent passport sessions can produce main-site cookies that remain valid at the same time. A1 stayed valid after generating B1; B1 stayed valid after generating A2; A2 stayed valid after generating B2. As a same-passport control, B1 became invalid after generating B2.
* User is considering project-native passport login without opening a browser. The desired outcome is a project-owned Douyu passport session that can obtain `LTP0`/main cookies directly, avoiding dependency on a browser profile while still isolating from the user's daily browser session.
* Playwright QR-login research confirmed a project-native passport login path exists: `scan/generateCode` returns a 300-second QR challenge, `japi/scan/auth` reports unscanned/scanned/success states, success sets passport `LTP0`, and the returned main-site login URL sets `acf_auth`, `acf_stk`, `acf_biz`, `acf_ct`, `acf_ltkid`, and related main cookies.
* User clarified the WebUI state model: if main-site or Yuba cookies were obtained through the QR flow, passport must already have succeeded. WebUI should model QR login as a derived chain, not three independent successes. Partial success states are therefore "passport only" or "passport + main-site"; "main-site/Yuba success but passport failure" should not be presented as a possible QR-login outcome.
* User clarified the WebUI placement: reuse the current manual-cookie action area. Put two left-aligned buttons in order: `扫码登录`, then `手填保存`; render the QR code below that action row; WebUI polls login status every 2 seconds.
* `src/core/cookie-cloud.ts` builds effective cookies by URL from CookieCloud snapshots. It validates main cookie, Yuba dy-token keys from main cookie, full Yuba cookie keys from Yuba cookie, and passport `LTP0` presence separately.
* `src/docker/runtime-cookie-source.ts` currently resolves CookieCloud into local `manualCookies.main`, `manualCookies.yuba`, and `manualPassport.cookie`. If CookieCloud lacks Yuba cookie, it falls back to the existing local Yuba cookie, then to main cookie.
* `src/docker/runtime-cookie-recovery.ts` already supports centralized main-site recovery: validate local main cookie, force CookieCloud sync, then use CookieCloud or manual passport material to call `safeAuth` and persist only the refreshed main cookie while preserving current Yuba cookie.
* `src/core/douyu-passport.ts` safeAuth deliberately keeps only main-site returned fields (`acf_uid`, `acf_auth`, `acf_stk`, `acf_ltkid`, `acf_username`, `acf_biz`, `acf_ct`, `dy_auth`) and ignores Yuba fields.
* `src/core/yuba-common.ts` creates dy-token from main cookie keys: `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, `acf_ltkid`. This means safeAuth can potentially fix dy-token readiness after it refreshes main cookie.
* There is no current code path that derives a full Yuba login cookie (`acf_yb_auth`, `acf_yb_uid`, `acf_yb_t`) from passport material.
* Empirical safeAuth test with the configured CookieCloud passport material found that Douyu returns the useful main-site Set-Cookie fields only after following safeAuth's 302 redirect to `www.douyu.com/api/passport/login`; the current helper's `maxRedirects: 0` misses those cookies.
* Empirical double-refresh test found that two consecutive safeAuth exchanges with the same LTP0 produce different main cookies. The first exchanged main cookie validated before the second exchange, but failed validation after the second exchange; the second exchanged cookie validated.
* Empirical Yuba test found that a safeAuth-refreshed main cookie can make dy-token Yuba group listing work, but visiting `yuba.douyu.com` did not issue `acf_yb_auth`, `acf_yb_uid`, or `acf_yb_t`.
* User recalls that after completing Douyu login, navigating or redirecting to the Yuba interface can show Yuba as already logged in. This suggests full Yuba cookies may require the real post-login Yuba SSO/page bridge rather than a plain request to `yuba.douyu.com`.
* Public Yuba page research found that an isolated no-login visit to `https://yuba.douyu.com/mygroups` sets only `acf_yb_t` and `dy_did`, not `acf_yb_auth` or `acf_yb_uid`. Triggering login opens the Douyu Passport QR iframe and uses `ref_url=https://yuba.douyu.com/mygroups`.
* Scan-confirmed Yuba SSO isolation showed full Yuba cookie authority is passport-rooted, not main-cookie-rooted. Removing passport `LTP0` while keeping main-site cookies failed to produce `acf_yb_auth`/`acf_yb_uid`; keeping passport `LTP0` while deleting main/Yuba auth cookies successfully triggered `safeAuth` then `https://yuba.douyu.com/ybapi/authlogin`, which set `acf_yb_auth`, `acf_yb_uid`, and `acf_yb_t`.
* WebUI guardrails in `test/project-maintenance-contract.test.js` require task runners and WebUI not to grow direct safeAuth/LTP0/passport refresh branches; recovery stays centralized in cookie source/recovery services.
* README says CookieCloud sync is browser-to-local only; runtime safeAuth refresh only updates project local config and does not write back browser or CookieCloud.

## Constraints and validated assumptions

* Passport safeAuth can refresh main-site cookie fields reliably enough to repair main tasks and Yuba dy-token fields when redirects are followed, but it is not a full Yuba cookie refresh mechanism.
* Full Yuba login is derivable by replaying the browser-observed Yuba login bridge with passport `LTP0`, then capturing `Set-Cookie` for `yuba.douyu.com`/`.douyu.com`.
* CookieCloud is currently treated as an import/source, not as a two-way writable cookie store.
* Local snapshots are the runtime authority after sync. Browser and CookieCloud can become stale relative to local snapshots if safeAuth runs after the last CookieCloud sync.
* A safe implementation should not overwrite a more complete local Yuba cookie with an incomplete CookieCloud-derived Yuba cookie unless the user explicitly asks for a reset.
* Because safeAuth appears to rotate the usable main-site login state, repeated automatic safeAuth calls should be deduplicated/throttled and the project should not generate new local main cookies unless it intends to replace the previous local main snapshot.
* Automatic project-side safeAuth should not run from startup/scheduled CookieCloud sync in MVP. The default should avoid background exchanges that may invalidate browser-held main-site credentials.
* Project-native QR login is cleaner than a dedicated browser workaround because Douyu currently exposes a QR-code challenge and token exchange flow that can be implemented without storing account password or bypassing CAPTCHA.

## Open Questions

* None blocking for MVP. The PRD is now converged around a project-owned QR login flow plus existing CookieCloud/manual compatibility paths.
* Non-blocking implementation choice: QR image rendering can use a small frontend dependency or an internal helper, but the backend contract must expose the raw QR URL/code so the UI is not tied to one renderer.

## MVP Scope (locked)

Build a project-owned Douyu login snapshot flow. The user scans a Douyu Passport QR code from the WebUI; the backend captures passport `LTP0`, derives the main-site login cookie, runs the passport-rooted Yuba SSO bridge, then persists the resulting local snapshots. CookieCloud and manual entry remain supported, but they are compatibility paths rather than the primary MVP login path.

The MVP must solve the current failure mode:

* CookieCloud/browser main cookie may miss `acf_auth`, `acf_stk`, `acf_biz`, `acf_ct`, or `acf_ltkid`.
* CookieCloud/browser Yuba cookie may miss `acf_yb_auth`, `acf_yb_uid`, or `acf_yb_t`.
* Passport material may exist and can be used to obtain a project-owned local snapshot without writing back to the browser or CookieCloud.

### In Scope

* Project-owned Passport QR login from WebUI:
  * Backend starts a QR session with `passport.douyu.com/scan/generateCode`.
  * Backend polls `passport.douyu.com/japi/scan/auth` until waiting/scanned/success/expired/cancelled/failure.
  * WebUI status polling should run every 2 seconds while the session is active.
  * WebUI action placement: in the current manual-cookie button row, show two left-aligned buttons in this order: `扫码登录`, then `手填保存`.
  * QR rendering placement: render the generated QR code directly below the action row, so the scan surface appears under the button the user just clicked.
  * WebUI displays one derived state chain: `等待扫码` -> `已扫码，等待确认` -> `passport 已确认，正在获取主站登录态` -> `主站已保存，正在获取鱼吧登录态` -> `登录快照已保存`.
  * Raw `scan_code`, login ticket/code, `LTP0`, and cookie values are never logged or returned in public/masked responses.
* Main-site snapshot acquisition:
  * On QR success, backend follows the returned `www.douyu.com/api/passport/login` URL and captures main-site `Set-Cookie`.
  * `manualPassport.cookie` and `manualCookies.main` are persisted as soon as passport + main-site login succeeds.
  * The safeAuth helper must follow redirects and capture the final main-site `Set-Cookie` fields when used by centralized recovery.
  * A single QR/login/check flow must not perform duplicate same-passport safeAuth refreshes.
* Full Yuba snapshot acquisition:
  * After passport/main success, backend runs the validated passport-rooted Yuba SSO bridge and captures `acf_yb_auth`, `acf_yb_uid`, and `acf_yb_t`.
  * Main-site cookies alone must not be treated as authority for full Yuba cookies.
  * If Yuba SSO fails after passport/main success, persist the successful prefix and show Yuba as retryable without requiring a fresh QR scan.
* Cookie authority and overwrite policy:
  * Runtime tasks read local snapshots only: `manualCookies.main`, `manualCookies.yuba`, and `manualPassport.cookie`.
  * QR login is an explicit user action and may replace all three project-owned local snapshots.
  * CookieCloud remains one-way browser/cloud-to-local import. It never receives write-back from this project.
  * Complete CookieCloud main cookies may update the local main snapshot; incomplete CookieCloud main cookies must not erase a locally complete main snapshot unless the user explicitly resets/saves over it.
  * Complete CookieCloud Yuba cookies may update the local Yuba snapshot; incomplete CookieCloud Yuba cookies must not erase a locally complete Yuba snapshot.
  * Passport safeAuth may replace only the local main snapshot and must preserve the current full Yuba snapshot.
* Centralized boundaries:
  * Task runners and WebUI must not call safeAuth, parse `LTP0`, or run passport refresh logic directly.
  * Passport QR, safeAuth, and Yuba SSO logic belong in shared core/docker services and are exposed to WebUI through backend routes.
* User-facing copy:
  * Login page explains that local snapshots are runtime authority.
  * UI/status text must not imply refreshed cookies were written to the browser or CookieCloud.
  * UI must not represent "main-site success" or "Yuba success" as possible when passport failed; they are derived states.
* Tests and docs:
  * Contract tests cover QR state transitions, cookie persistence, safeAuth redirect handling, Yuba partial success, CookieCloud incomplete-overwrite prevention, masking, and existing guardrails.
  * README/login help is updated for project-owned QR login, CookieCloud compatibility, and no browser/CookieCloud write-back.

### Non-MVP / Out of Scope

* Writing refreshed cookies back into the user's browser.
* Writing updated cookies back into CookieCloud cloud storage.
* Username/password/SMS login, CAPTCHA handling, or storing account passwords.
* A separate Yuba QR login flow. Yuba is derived from passport-rooted SSO.
* Automatic startup/scheduled safeAuth rotation as a configurable "dedicated-session recovery mode".
* A production browser-automation dependency for login capture unless implementation proves the HTTP-equivalent Yuba bridge cannot work; if that happens, return to PRD before expanding scope.
* Guaranteeing that a shared daily-browser passport session remains valid after project-side safeAuth. The MVP avoids this by making QR login create a project-owned session.

## MVP Requirements

* Keep main-site, full Yuba, and passport cookies as separate stored snapshots to avoid same-name field collisions.
* Implement the QR login session as a short-lived backend workflow with timeout, cancellation, and safe cleanup.
* Render QR login from the existing manual-cookie action row: left-aligned `扫码登录` first, `手填保存` second, QR code below the row.
* Poll active QR login status every 2 seconds from WebUI.
* Persist partial success in this order only: passport -> main-site -> Yuba.
* Provide a retry path for Yuba SSO when passport/main are already saved.
* Keep CookieCloud sync import-only and make overwrite behavior completeness-aware.
* Follow safeAuth redirects when centralized recovery uses passport material to refresh a main-site cookie.
* Preserve complete local Yuba cookies when safeAuth refreshes the local main cookie.
* Avoid repeated same-passport refresh in one flow.
* Keep public API responses masked and avoid logs containing raw cookies or login tickets.

## MVP Acceptance Criteria

* [ ] WebUI can start a Passport QR login and display the derived status chain from waiting through saved snapshot.
* [ ] Login page places two left-aligned buttons in order: `扫码登录`, then `手填保存`, and renders the QR code directly below that action row.
* [ ] Active WebUI QR login status polling uses a 2-second interval and stops on success, failure, expiry, cancellation, or page teardown.
* [ ] QR success persists `manualPassport.cookie` with `LTP0` and `manualCookies.main` with `acf_auth`, `acf_stk`, `acf_biz`, `acf_ct`, and `acf_ltkid`.
* [ ] Yuba SSO success persists `manualCookies.yuba` with `acf_yb_auth`, `acf_yb_uid`, and `acf_yb_t`.
* [ ] If Yuba SSO fails after passport/main success, passport/main remain saved and UI offers a retryable Yuba state.
* [ ] CookieCloud sync does not replace a complete local main or Yuba snapshot with an incomplete CookieCloud snapshot.
* [ ] Complete CookieCloud snapshots still import normally for users who prefer browser/CookieCloud.
* [ ] Passport safeAuth follows redirect responses and captures the final main-site `Set-Cookie` fields.
* [ ] Runtime recovery remains centralized and preserves existing guardrails: no direct safeAuth/LTP0/passport refresh logic in task runners or WebUI.
* [ ] Login UI/status text clearly says local snapshots are runtime authority and no browser/CookieCloud write-back occurs.
* [ ] Tests cover incomplete CookieCloud main/Yuba cookies plus valid passport material, QR partial success, masking, and Yuba retry.
* [x] Research verified that the Yuba post-login bridge can issue `acf_yb_auth`, `acf_yb_uid`, and `acf_yb_t` when passport `LTP0` is present.

## Technical Approach

### Backend flow

1. Add a Douyu Passport QR session service that generates QR challenges, tracks status, polls confirmation, captures passport cookies, and follows the returned main login URL.
2. Add or extend cookie merge helpers so main-site and Yuba `Set-Cookie` values are parsed into the existing local snapshot fields without leaking raw values.
3. Update safeAuth recovery to follow redirects and merge final main-site cookies.
4. Add a Yuba SSO bridge helper rooted in saved passport material. It should reproduce the validated `safeAuth` -> `https://yuba.douyu.com/ybapi/authlogin` chain with explicit cookie capture.
5. Extend Docker app context and server routes with login-session operations. Routes return status, readiness, expiry, and masked results only.
6. Update CookieCloud import resolution so incomplete source cookies do not overwrite complete local snapshots.

### Frontend flow

1. Add two left-aligned buttons to the existing manual-cookie action row: `扫码登录` first, `手填保存` second.
2. Render the QR panel directly below that action row after the user clicks `扫码登录`.
3. Poll active QR status from WebUI every 2 seconds and present QR login as one chained workflow rooted at passport.
4. Keep manual cookies and CookieCloud controls available as compatibility/fallback sections.
5. Show partial success as actionable state: passport/main saved, Yuba pending/retryable.
6. Reuse existing toast/resource conventions and avoid exposing raw secrets in DOM text.

### Implementation order

1. Backend core helpers and contract tests for QR polling, Set-Cookie merge, safeAuth redirect following, and Yuba bridge.
2. Runtime service/routes and persistence tests.
3. CookieCloud completeness-aware overwrite policy and diagnostics tests.
4. WebUI QR login state and copy.
5. README notes and final lint/type-check/build.

## Decision (ADR-lite)

**Context**: safeAuth can repair missing main-site fields only when redirects are followed, but same-passport refreshes rotate the previously generated main cookie. Different passport sessions can coexist. QR Passport login gives the project its own session without depending on a daily browser profile.

**Decision**: MVP will make project-owned Passport QR login the primary path. It will capture passport, main-site, and Yuba snapshots locally, keep CookieCloud/manual entry as compatibility paths, and keep all refresh/write authority local to this project.

**Consequences**: The default login path no longer depends on a complete CookieCloud browser snapshot. Browser continuity is protected by avoiding background safeAuth against the user's daily browser session. CookieCloud/browser may diverge from local runtime snapshots, and UI/docs must state that clearly.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Technical Notes

* Relevant files inspected:
  * `src/core/cookie-cloud.ts`
  * `src/core/douyu-passport.ts`
  * `src/core/yuba-common.ts`
  * `src/docker/runtime-cookie-source.ts`
  * `src/docker/runtime-cookie-recovery.ts`
  * `src/docker/runtime-cookie-cloud-sync.ts`
  * `src/docker/runtime-app-context.ts`
  * `src/docker/webui/cookie-source-actions.ts`
  * `src/docker/webui/cookie-source-copy.ts`
  * `src/docker/webui/components/LoginConfigPage.vue`
  * `test/douyu-passport-contract.test.js`
  * `test/project-maintenance-contract.test.js`
* Relevant specs:
  * `.trellis/spec/backend/index.md`
  * `.trellis/spec/backend/directory-structure.md`
  * `.trellis/spec/backend/database-guidelines.md`
  * `.trellis/spec/backend/error-handling.md`
  * `.trellis/spec/backend/logging-guidelines.md`
  * `.trellis/spec/backend/quality-guidelines.md`
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/type-safety.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/guides/index.md`
  * `.trellis/spec/guides/cross-layer-thinking-guide.md`
* Research notes:
  * `.trellis/tasks/06-05-passport-refresh-cookie-authority/research/douyu-qr-passport-login.md`
  * `.trellis/tasks/06-05-passport-refresh-cookie-authority/research/yuba-sso-bridge.md`
* Current manual "同步并校验" calls `/api/cookie-source/persist`, then `/api/cookie-source/check`. The check intentionally inspects only the local persisted snapshot.
* Current `persistEffectiveCookies(true)` force-fetches CookieCloud and writes local snapshots. It does not validate and then recover via safeAuth during the manual sync/check path.
* Current failure recovery may safeAuth-refresh the main cookie after CookieCloud sync fails validation, producing local snapshots newer than browser/CookieCloud.
* Experiment summary (2026-06-05):
  * CookieCloud main snapshot had `acf_uid`, `acf_username`, and `dy_did`, but lacked `acf_auth`, `acf_stk`, `acf_ltkid`, `acf_biz`, and `acf_ct`.
  * safeAuth with `maxRedirects: 0` returned a 302 and no Set-Cookie; following redirects returned `acf_auth`, `acf_biz`, `acf_ct`, `acf_ltkid`, `acf_stk`, `acf_uid`, `acf_username`, and `dy_auth`.
  * First safeAuth main cookie validated against `getFansList`; after a second safeAuth exchange, that first cookie failed and the second cookie validated.
  * Visiting `yuba.douyu.com` after safeAuth did not add full Yuba `acf_yb_*` cookies; dy-token Yuba group listing worked with the refreshed main cookie.
  * Edge passport Cookie vs current CookieCloud passport snapshot: complete header differed; `LTP0`, `dy_did`, `acf_did`, and `game_did` differed; Edge-only fields included `dy_auth` and `wan_auth37wan`; CookieCloud-only fields included `last_login_way` and `mantine-color-scheme-value`.
  * Cross-session rotation test: CookieCloud passport A and Edge passport B had different `LTP0`, `dy_did`, `acf_did`, and `game_did`. A-generated and B-generated main cookies remained valid across the other session's safeAuth refresh. A same-passport control confirmed that B2 invalidated B1.
  * QR passport login test: a fresh Playwright session generated a QR challenge through `POST https://passport.douyu.com/scan/generateCode` with `client_id=1&isMultiAccount=0`; polling `GET https://passport.douyu.com/japi/scan/auth?code=<code>` moved from `error:-2` to scanned to `error:0`; the successful poll response set `LTP0`, and the returned `www.douyu.com/api/passport/login` URL set main-site cookies including `acf_auth`, `acf_stk`, `acf_biz`, `acf_ct`, and `acf_ltkid`.
  * QR challenge generation also worked via a backend-style HTTP request without existing browser cookies. Detailed notes are in `.trellis/tasks/06-05-passport-refresh-cookie-authority/research/douyu-qr-passport-login.md`.
  * Yuba SSO page test: isolated no-login visit to `https://yuba.douyu.com/mygroups` set anonymous `acf_yb_t`, but not `acf_yb_auth`/`acf_yb_uid`; clicking the page login surface opened the Passport QR iframe with Yuba return URL. Follow-up isolation confirmed passport `LTP0` can trigger `safeAuth` and `https://yuba.douyu.com/ybapi/authlogin` to set full Yuba cookies, while main-site cookies without passport `LTP0` cannot. Detailed notes are in `.trellis/tasks/06-05-passport-refresh-cookie-authority/research/yuba-sso-bridge.md`.
