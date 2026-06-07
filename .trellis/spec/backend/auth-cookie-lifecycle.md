# Douyu Auth Cookie Lifecycle

> Contracts for Passport, main-site, and Yuba cookies in the Docker runtime.

---

## Scenario: Passport-Derived Login Snapshots

### 1. Scope / Trigger

- Trigger: changing Passport QR login, CookieCloud persistence, credential recovery, task cookie selection, or Yuba SSO behavior.
- Scope: `src/core/douyu-passport.ts`, `src/docker/runtime-cookie-source.ts`, `src/docker/runtime-cookie-recovery.ts`, and task paths that consume main/Yuba cookies.

### 2. Signatures

- Passport QR confirmation: `pollDouyuPassportQrAuth(code, currentPassportCookie?) -> { status, message, passportCookie?, loginUrl? }`.
- Main-site login exchange: `fetchDouyuMainCookiesFromLoginUrl({ loginUrl, mainCookie?, passportCookie? }) -> { refreshedCookie, returnedKeys }`.
- Main-site recovery exchange: `refreshDouyuMainCookiesWithSafeAuth({ mainCookie, dyDid, ltp0 }) -> { refreshedCookie, returnedKeys }`.
- Yuba SSO exchange: `fetchDouyuYubaCookiesWithPassport({ passportCookie, mainCookie, yubaCookie? }) -> { yubaCookie, returnedKeys }`.
- Persistent local snapshots:
  - `DockerConfig.manualPassport.cookie`
  - `DockerConfig.manualCookies.main`
  - `DockerConfig.manualCookies.yuba`

### 3. Contracts

- `passport.douyu.com` `LTP0` plus matching device material (`dy_did`, `acf_did`, `game_did`) is the upstream Web SSO credential for this project.
- `LTP0` is long-lived but not permanent. Live QR diagnostics observed `LTP0` returned with `Max-Age=15768000` seconds, about 182.5 days. Service-side validity is proven only when safeAuth or the QR login flow returns complete downstream fields.
- Main-site `www.douyu.com` business cookies are downstream snapshots minted from Passport. Required runtime fields include `acf_uid`, `dy_did`, `acf_auth`, `acf_stk`, `acf_ltkid`, `acf_biz`, and `acf_ct`.
- Live QR diagnostics observed main-site business cookies returned with `Max-Age=529200` seconds, about 6.125 days, and JWT `exp` around 7 days.
- Yuba `yuba.douyu.com` cookies are downstream snapshots minted through Passport plus a current main-site login. Required runtime fields include `acf_yb_auth`, `acf_yb_uid`, and `acf_yb_t`.
- Live Yuba diagnostics observed `acf_yb_t` returned with `Max-Age=86400` seconds, about 1 day, while Yuba auth/JWT cookies used the same about-6.125-day cookie max-age and about-7-day JWT horizon as main-site cookies.
- Main-site business cookies are effectively single-active for the observed Passport/device flow. Live diagnostics showed that issuing a second main-site cookie set from the same `LTP0` immediately invalidated the first set for fans/backpack validation (`error: 9`, `请登录`).
- Yuba cookies are reissued during Yuba SSO. Live diagnostics showed old Yuba cookies were not immediately invalidated by issuing a second Yuba set, but code must not treat them as durable because many Yuba requests also require a current main-site `dy-token`.
- CookieCloud/browser snapshots and backend Passport refresh must not both be treated as independent write authorities for `manualCookies.main`. If both refresh the main-site snapshot, they can invalidate each other's current main-site business cookies.
- When full recovery is required, prefer rebuilding a coherent set from Passport: refresh main-site cookies first, then run Yuba SSO with the new main-site cookie, then persist both snapshots after validation.
- Do not assume that safeAuth extends the lifetime of `LTP0`. Live diagnostics saw safeAuth return downstream business cookies, not a replacement `LTP0`.
- Logs, specs, tests, public/status API responses, and diagnostics may include cookie names, max-age values, validation status, and missing field names, but never raw cookie values. The authenticated `/api/config` editing endpoint is the explicit exception because it returns the complete saved config for WebUI editing.

### 4. Validation & Error Matrix

- `LTP0` missing from Passport snapshot -> Passport refresh cannot run; require QR login or another explicit Passport source.
- `LTP0` present but safeAuth returns no complete main-site fields -> treat Passport as not service-valid for recovery; require QR login.
- Main-site refresh returns complete fields but `getFansList()` or backpack validation fails -> do not persist the refreshed main snapshot as authoritative.
- Main-site refresh succeeds and validation passes -> the new main snapshot supersedes previous local/browser main snapshots.
- Yuba SSO returns no `acf_yb_auth`, `acf_yb_uid`, or `acf_yb_t` -> do not claim full Yuba recovery; keep failure explicit.
- Yuba SSO succeeds with the current main snapshot -> persist the new Yuba snapshot with the matching main snapshot.
- CookieCloud provides a stale main-site snapshot after backend Passport refresh -> do not silently make CookieCloud authoritative over the current Passport-derived main snapshot without validation.
- A task sees main-site `error: 9`, missing fans table, or equivalent login failure -> attempt Passport-derived main refresh when Passport material is available.
- A Yuba task sees login/token failure -> full recovery should rebuild both main and Yuba snapshots from Passport; main-only recovery can leave Yuba stale.

### 5. Good/Base/Bad Cases

- Good: a saved `LTP0` refreshes main-site `acf_*`, main validation passes, Yuba SSO refreshes `acf_yb_*`, Yuba validation passes, then both local snapshots are persisted together.
- Good: the system records that `LTP0` is long-lived and upstream, while still requiring safeAuth/SSO validation before using it as recovery material.
- Good: the runtime treats a newly minted main-site cookie set as replacing the previous main-site set and invalidates local caches.
- Base: main-site cookies expire after several days, but Passport safeAuth still returns complete fields; no user scan is required.
- Base: Yuba cookies are reissued while a previous Yuba set still validates; the persisted snapshot still moves to the latest coherent set.
- Bad: assuming a local browser/CookieCloud main-site cookie remains valid after the backend has minted a newer main-site cookie from the same Passport session.
- Bad: claiming `LTP0` is permanent or refreshed by safeAuth without observing a new `Set-Cookie: LTP0`.
- Bad: preserving a stale Yuba snapshot after main-site recovery and reporting full login recovery.
- Bad: mixing `dy_did` from one Passport/device snapshot with main or Yuba cookies minted from another snapshot.

### 6. Tests Required

- Core tests should assert QR login records `LTP0` as Passport material and main-site cookies as downstream material.
- Runtime tests should assert a Passport-derived main refresh invalidates local main/fans caches and replaces the current main snapshot.
- Recovery tests should cover full Passport recovery: main safeAuth validation followed by Yuba SSO validation and joint persistence.
- Tests should assert no raw cookie values appear in public routes, logs, or diagnostics.
- Contract tests should guard against task runners directly implementing Passport refresh; recovery remains centralized in cookie-source/recovery services.
- When possible, integration diagnostics should record only cookie names, max-age/expires metadata, JWT timing, and validation outcomes.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Treat browser/CookieCloud and backend Passport as equal writers.
const cookie = latestBrowserMainCookie || latestPassportMainCookie
```

#### Correct

```typescript
// Treat Passport as the upstream recovery source and validate the coherent set.
const main = await refreshMainFromPassport(passportCookie)
await validateMain(main)
const yuba = await refreshYubaFromPassport(passportCookie, main)
await validateYuba(yuba, main)
persistSnapshots({ main, yuba })
```

#### Wrong

```typescript
// Main was refreshed, so the old Yuba snapshot must be fully recovered too.
persistManualCookieSnapshot(newMainCookie, oldYubaCookie)
```

#### Correct

```typescript
// Full recovery needs a new Yuba SSO snapshot paired with the refreshed main.
const newYubaCookie = await fetchDouyuYubaCookiesWithPassport({
  passportCookie,
  mainCookie: newMainCookie,
})
```

---

## Notes From Live Diagnostics

- QR confirmation returned `LTP0` with about a 182.5-day browser cookie max-age.
- Main-site login returned downstream business cookies with about a 6.125-day browser max-age and about-7-day JWT expiration.
- Yuba SSO returned `acf_yb_t` with about a 1-day max-age and Yuba auth/JWT cookies with about a 6.125-day max-age.
- Issuing a second main-site cookie set from the same `LTP0` made the first main-site set fail fans/backpack validation.
- Issuing a second Yuba cookie set changed Yuba auth/token values; the first Yuba set still validated in the immediate observed test, but must not be treated as a long-lived authority.
