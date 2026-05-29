# Remove WebUI Login CookieCloud Sync

## Goal

Remove the implicit CookieCloud synchronization that currently happens after WebUI authentication loads protected data, so opening or logging into the WebUI does not pull remote CookieCloud data unless the user explicitly asks for it or the backend scheduled/startup sync runs.

## What I Already Know

- The current WebUI authentication flow passes `syncCookieCloudToLoginCookies(false)` into protected data loading.
- `loadProtectedData` runs that callback after loading raw config, overview, and logs.
- Manual CookieCloud actions should remain: "保存并启用" and "同步并校验" still synchronize and validate.
- Backend startup sync and CookieCloud cron sync are out of scope for removal.

## Requirements

- WebUI login success / authenticated status restoration must not call `/api/cookie-source/persist`.
- Protected data loading should still load raw config, overview, logs, and active-tab data.
- The login page manual CookieCloud sync/check behavior must keep working.
- Persist and Check responsibilities should be separated: Persist may fetch CookieCloud and write the local snapshot; Check should diagnose already-local cookies and must not trigger CookieCloud remote synchronization.
- Runtime Douyu requests that fail with a cookie/login-credential error should, when CookieCloud is enabled, force a CookieCloud persist and retry the original operation once.
- Automatic failure recovery must not simulate a browser login, must not retry indefinitely, and must leave ordinary non-cookie Douyu business failures unchanged.
- Contract tests that assert the old implicit sync must be updated to assert the new behavior.

## Acceptance Criteria

- [ ] `App.vue` no longer imports or passes `syncCookieCloudToLoginCookies` to login protected-data loading.
- [ ] `resource-state.ts` protected-data loading has no CookieCloud sync callback.
- [ ] Existing manual CookieCloud sync code remains available in `cookie.ts`.
- [ ] CookieCloud Persist and Cookie Check behavior are explicit and do not overlap in a way that hides remote CookieCloud fetches inside Check.
- [ ] Task runs and WebUI Douyu-backed status loads retry once after CookieCloud sync when the first failure is clearly cookie/login-credential related.
- [ ] Relevant tests pass.

## Open Questions

- Resolved: keep one combined "同步并校验" button, but implement it as Persist followed by local-only Check.

## Feasible Approaches

### Approach A: Split Buttons, Split Semantics (Recommended)

- UI:
  - "保存手填 Cookie" saves manual cookies only.
  - "保存并启用" saves CookieCloud config only.
  - "同步 CookieCloud" fetches CookieCloud and writes the local snapshot.
  - "校验本地 Cookie" checks only the local saved snapshot.
- Backend:
  - Persist endpoint fetches CookieCloud and writes local cookies.
  - Check endpoint reads local saved cookies only; it never fetches CookieCloud.
- Trade-off: more explicit UI, but one extra button/action.

### Approach B: Keep One Combined Button, But Make Check Local-Only

- UI keeps "同步并校验".
- Implementation runs Persist first, then Check local saved cookies.
- Check itself never fetches CookieCloud.
- Trade-off: fewer buttons, but the label still combines two operations and is less transparent.
- Decision: selected by user.

### Approach C: Minimal Backend Fix Only

- Keep current UI labels.
- Change `/api/cookie-source/check` to local-only.
- Keep "保存并启用" and "同步并校验" triggering the same apparent flows.
- Trade-off: smallest UX change, but code remains harder to reason about.

## Out of Scope

- Changing backend startup CookieCloud sync.
- Changing CookieCloud scheduled cron sync.
- Adding a full browser-driven Douyu login flow.
- Persisting standalone long-lived Douyu login credentials such as `LTP0` until the refresh flow is designed explicitly.

## Technical Notes

- Relevant files: `src/docker/webui/App.vue`, `src/docker/webui/resource-state.ts`, `test/project-maintenance-contract.test.js`.
- Existing API endpoint `/api/cookie-source/persist` remains for manual UI actions.
- Relevant optimization files: `src/docker/runtime-cookie-source.ts`, `src/docker/server-types.ts`, `src/docker/webui/cookie.ts`.
- Current uncommitted optimization that returns diagnostics from Persist is considered the wrong direction unless the chosen approach explicitly keeps combined behavior.
- Selected approach rejects returning diagnostics from Persist; Check must stay local-only and separate.
- Later discovery: `starudream/sign-task` has a pure HTTP refresh flow using `dy_did` plus `LTP0` against Douyu passport `safeAuth`; see `research/douyu-cookie-refresh.md`.
