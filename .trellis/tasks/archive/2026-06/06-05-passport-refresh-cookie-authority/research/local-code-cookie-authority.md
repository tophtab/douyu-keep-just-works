# Local code research: cookie authority and passport recovery

## Current flow

CookieCloud is an import source. `DockerCookieSourceManager.persistEffectiveCookies(true)` fetches a CookieCloud snapshot, builds cookie headers for `www.douyu.com`, `yuba.douyu.com`, and `passport.douyu.com`, then persists those values into local config as `manualCookies.main`, `manualCookies.yuba`, and `manualPassport.cookie`.

Runtime tasks and status APIs read only the local cookie snapshot through `resolveCookieForUrl()`. The README already states that safeAuth refresh only updates local project config and does not write back to browser or CookieCloud.

## Passport recovery behavior

`DockerRuntimeCookieRecoveryService` catches credential-looking errors and calls `recoverCredentialSnapshot()`.

`recoverCredentialSnapshot()` currently:

1. validates current local main cookie;
2. if CookieCloud is enabled, force-syncs CookieCloud into the local snapshot;
3. validates the synced main cookie;
4. resolves passport material from CookieCloud first, then manual passport;
5. calls `refreshDouyuMainCookiesWithSafeAuth()`;
6. validates the refreshed main cookie;
7. persists the refreshed main cookie and preserves the current Yuba cookie.

This means failure recovery can already produce a local main cookie that is newer than the browser and CookieCloud cloud snapshot.

## Key separation

Yuba dy-token readiness depends on main-cookie fields:

* `acf_uid`
* `acf_biz`
* `acf_stk`
* `acf_ct`
* `acf_ltkid`

Full Yuba cookie readiness depends on Yuba-specific fields:

* `acf_yb_auth`
* `acf_yb_uid`
* `acf_yb_t`

safeAuth currently merges only main-site returned fields and explicitly ignores Yuba fields. It can plausibly repair Yuba dy-token readiness by repairing the main cookie, but it cannot currently be treated as a full Yuba cookie refresher.

## Existing guardrails

`test/project-maintenance-contract.test.js` enforces:

* CookieCloud sync persists first, then checks local snapshot only.
* WebUI and task runners should not grow direct safeAuth, LTP0, or passport-refresh branches.
* Manual passport material is stored in one masked `manualPassport.cookie` field.

## Risks

* If manual "同步并校验" force-fetches CookieCloud and simply persists it, an incomplete browser/CookieCloud snapshot can overwrite a more useful local main cookie unless fallback/merge rules preserve local completeness.
* If safeAuth is added to manual sync/check, local main cookie can become valid while CookieCloud diagnostics still says source is CookieCloud, which may confuse users unless status text says "local snapshot was repaired from passport".
* Treating passport as able to repair full Yuba cookies would be misleading without a verified Yuba refresh endpoint.
* safeAuth appears to rotate the generated main-site login cookie: an empirical double-refresh test found that the first generated main cookie became invalid after a second safeAuth exchange with the same LTP0. Repeated automatic safeAuth calls can therefore invalidate an already-working local snapshot.

## Empirical findings

* The configured CookieCloud snapshot had passport `LTP0` and `dy_did`, while the main-site CookieCloud header lacked `acf_auth`, `acf_stk`, `acf_ltkid`, `acf_biz`, and `acf_ct`.
* The current helper shape (`maxRedirects: 0`) sees only safeAuth's 302 response and no Set-Cookie. Following the 302 to `www.douyu.com/api/passport/login` returns the useful main-site Set-Cookie fields.
* Two consecutive redirect-following safeAuth exchanges produced different main cookies. The first validated before the second exchange; after the second exchange, the first failed validation and the second passed.
* Visiting `yuba.douyu.com` with a safeAuth-refreshed main cookie did not produce `acf_yb_auth`, `acf_yb_uid`, or `acf_yb_t`. The dy-token Yuba group list did work with the refreshed main cookie.
* Cross-session test with the current CookieCloud passport session (A) and a separate Edge passport session (B) showed that A-generated and B-generated main cookies remained valid across the other session's safeAuth exchange. A same-passport control still invalidated the older cookie within that passport session.

## Feasible approaches

### Approach A: local snapshot authority with passport-derived main repair (recommended)

CookieCloud remains browser-to-local import. After import, the local snapshot is runtime authority. If main cookie is incomplete and passport material is present, run the centralized safeAuth repair and persist the repaired main cookie locally. Preserve a complete local Yuba cookie when CookieCloud lacks full Yuba fields. Report clearly that browser/CookieCloud were not updated.

This approach requires following safeAuth redirects and avoiding unnecessary repeated safeAuth exchanges in one flow.
For browser-primary users, this approach is safest when paired with a dedicated browser/profile CookieCloud source so project-side refreshes rotate only the project session.

Pros:

* Matches current README and code architecture.
* Fixes main tasks and Yuba dy-token missing fields.
* Avoids claiming write-back to CookieCloud.
* Keeps full Yuba cookie handling honest.

Cons:

* Local snapshot may intentionally diverge from browser/CookieCloud.
* Users need UI/status wording that explains the divergence.

### Approach B: CookieCloud strict source

CookieCloud sync always reflects the browser/cloud snapshot. Passport repair only happens during runtime failure recovery, not during manual sync/check.

Pros:

* Source labeling is simple.
* Local snapshot mirrors CookieCloud more closely after sync.

Cons:

* The exact user scenario remains painful: valid passport exists, but manual sync/check still reports missing main/dy-token fields.
* A later runtime failure may repair the local snapshot anyway, so divergence still happens, just later and less visibly.

### Approach C: two-way CookieCloud/browser write-back

After passport repair, write derived cookies back to CookieCloud or browser.

Pros:

* Would reduce divergence if implemented correctly.

Cons:

* Out of current project scope and not supported by current CookieCloud code.
* Higher credential/security risk.
* Browser write-back requires a separate authenticated/browser integration.

## Recommended MVP

Adopt Approach A. Add explicit metadata/status for "CookieCloud imported, passport repaired local main cookie", keep full Yuba cookie as "not recoverable from passport" unless a verified endpoint is added later, and preserve complete local Yuba cookies instead of replacing them with incomplete CookieCloud snapshots.
