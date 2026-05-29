# Error Handling

> How errors are handled in this project.

---

## Overview

The backend uses ordinary `Error` objects and small normalization helpers. User-facing failures are returned as JSON `{ error: string }`. Runtime task failures are logged with a task category and do not crash the scheduler.

---

## Error Types

There is no custom error class hierarchy. Use `unknown` in catch blocks and normalize with a helper:

```typescript
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
```

Douyu business API helpers throw `Error` with action-specific Chinese messages when remote responses contain error codes or unexpected shapes, as in `src/core/api.ts`.

---

## Error Handling Patterns

Express route modules either handle errors locally with `try/catch` or use shared route helpers:

```typescript
export async function sendJsonResult<T>(
  res: express.Response,
  run: () => Promise<T>,
  resolveErrorStatus: ErrorStatusResolver,
): Promise<void> {
  try {
    res.json(await run())
  } catch (error: unknown) {
    sendJsonError(res, error, resolveErrorStatus)
  }
}
```

Use `sendJsonOk` when a mutation route should return the standard success envelope and delegate unexpected failures to the same JSON error path:

```typescript
await sendJsonOk(
  res,
  () => ctx.saveTaskConfig(payload),
  () => 500,
)
```

Validate expected bad input before calling the helper so validation errors keep their explicit `400` response:

```typescript
const validationError = validateConfigPayload(payload)
if (validationError) {
  return res.status(400).json({ error: validationError })
}

await sendJsonOk(res, () => ctx.saveTaskConfig(payload), () => 500)
```

Scheduler tasks catch failures, log them, and update next-run status:

```typescript
await this.runTaskWithLock(type, async () => {
  logger('开始执行任务...')
  this.statuses[type].lastRun = createStatusTimestamp()
  await runTask()
}, {
  onBusy: 'skip',
  busyMessage: '任务仍在执行中，跳过本次触发',
}).catch((error: unknown) => {
  logger(`任务执行出错: ${errorMessage(error)}`)
})
```

---

## API Error Responses

Use status-specific JSON errors:

- `400` for validation and malformed config.
- `400` for missing or invalid Douyu login credentials, including local CookieCloud snapshot gaps and cookie fields that Douyu APIs require.
- `401` for WebUI auth failures.
- `500` for unexpected runtime failures.

The standard body is:

```json
{ "error": "message" }
```

Keep messages stable when frontend code or tests rely on them.

---

## Scenario: Credential Recovery Retry

### 1. Scope / Trigger
- Trigger: a Docker runtime task or WebUI status load fails with a message classified by `isCookieCredentialMessage`.
- Scope: runtime-only recovery for CookieCloud-backed local login snapshots or manual-cookie mode with saved `manualPassport.cookie`.

### 2. Signatures
- `isCookieCredentialMessage(message: string): boolean` identifies login-cookie failures.
- `refreshCookieSourceAfterFailure(error: unknown, context: string): Promise<boolean>` delegates to `DockerCookieSourceManager.recoverCredentialSnapshot(...)` when CookieCloud or manual passport recovery material is configured.
- `runWithCookieSourceRetry<T>(context: string, run: () => Promise<T>): Promise<T>` wraps WebUI-facing Douyu reads.
- `RuntimeTaskRunnerDeps.refreshCookieSourceAfterFailure(error, context)` lets scheduled and manual tasks share the same recovery path.
- `DockerCookieSourceManager.hasPassportRecoveryMaterial(config?): boolean` is true when CookieCloud is ready or manual `passport.douyu.com` cookie material is saved.
- `DockerCookieSourceManager.recoverCredentialSnapshot({ validateMainCookie, log }): Promise<{ recovered: boolean; refreshedBy: 'cookieCloud' | 'safeAuth' | null; reason: string }>` owns current-cookie validation, optional CookieCloud sync, optional passport refresh, and persistence.
- `src/docker/runtime-cookie-recovery.ts` contains the centralized recovery pipeline. Individual task runners must call the shared retry hook, not call `safeAuth` or `LTP0` handling directly.
- `CredentialSnapshotRecoveryDeps.getCurrentMainCookie()` supplies the current local main-site cookie for manual-mode recovery.
- `CredentialSnapshotRecoveryDeps.getManualPassportCookie()` supplies the saved manual `passport.douyu.com` cookie string.
- `refreshDouyuMainCookiesWithSafeAuth({ mainCookie, dyDid, ltp0 }): Promise<{ refreshedCookie: string; returnedKeys: string[] }>` performs the pure HTTP `passport.douyu.com` refresh and returns a merged local main-cookie header.

### 3. Contracts
- First failure is inspected by message only; there is no custom error class hierarchy.
- Recovery runs only when CookieCloud is fully configured and active or manual `manualPassport.cookie` is saved.
- Recovery first validates the current local main cookie using required-key checks and `getFansList()`.
- When CookieCloud is active and the current local main cookie is still invalid, recovery force-persists the effective CookieCloud snapshot to local `manualCookies`, then validates that synced main cookie.
- If the synced/current main cookie is still invalid, recovery may call passport `safeAuth` only when `LTP0` is available from the `passport.douyu.com` CookieCloud cookie header or manual `manualPassport.cookie`, and `dy_did` is available from that passport cookie header or the local main cookie.
- CookieCloud passport-domain cookie material is preferred when CookieCloud has `LTP0`; manual passport cookie material is a fallback for CookieCloud gaps and the primary source in manual-cookie mode.
- `safeAuth` may update only the local main-cookie snapshot after its merged cookie passes the same validation gate; it must not write cookies back to the browser or CookieCloud.
- The original operation is retried exactly once.
- Recovery does not run a browser, simulate Douyu login pages, refresh fishbar `acf_yb_*`, or store standalone long-lived Douyu login tokens.
- Logs may include cookie field names and high-level reasons, but must not include raw cookies, `LTP0`, CookieCloud passwords, or returned auth token values.

### 4. Validation & Error Matrix
- CookieCloud inactive and manual passport cookie missing -> rethrow the original error.
- Current local main cookie validates through `getFansList()` -> retry the original operation once without CookieCloud or `safeAuth`.
- CookieCloud persist fails -> log the recovery failure and rethrow the original error.
- CookieCloud sync validates through `getFansList()` -> retry the original operation once.
- CookieCloud sync or manual local cookie remains invalid and `dy_did` or passport `LTP0` is missing -> log the non-secret reason and rethrow the original error.
- Manual passport cookie has `LTP0` but neither it nor the local main cookie has `dy_did` -> do not call `safeAuth`; log/return a non-secret missing-`dy_did` reason.
- `safeAuth` returns no usable main-site auth fields -> log the recovery failure and rethrow the original error.
- `safeAuth` returns fields but post-refresh `getFansList()` validation fails -> do not persist the refreshed cookie; log the non-secret reason and rethrow the original error.
- `safeAuth` returns fields and validation passes -> persist the merged local main cookie, keep the current yuba cookie, invalidate local caches, and retry the original operation once.
- Retry fails -> surface the retry error through the existing route or scheduler path.
- Missing config, not-configured task, or ordinary Douyu business failure -> no recovery retry.

### 5. Good/Base/Bad Cases
- Good: `getFansList` fails with "请检查主站 Cookie", CookieCloud sync updates `manualCookies`, validation passes, then the same read is retried once.
- Good: CookieCloud sync still fails validation, passport `LTP0` + `dy_did` refresh main-site `acf_*` fields, post-refresh `getFansList()` passes, then the same read is retried once.
- Good: manual-cookie mode has `manualPassport.cookie = "dy_did=...; LTP0=..."`, `safeAuth` refreshes main-site `acf_*` fields, post-refresh validation passes, then the same read is retried once.
- Base: a task fails for non-cookie business reasons; the scheduler logs the task error without CookieCloud traffic.
- Bad: `/api/cookie-source/check` fetches CookieCloud remotely or task execution loops on repeated login failure.
- Bad: persisting a `safeAuth` response before post-refresh validation passes.
- Bad: adding task-specific `LTP0` refresh branches inside collect/keepalive/double-card/expiring-gift/yuba task runners.
- Bad: claiming fishbar `acf_yb_*` recovery without a verified HTTP cookie-refresh flow.

### 6. Tests Required
- Contract tests must assert `refreshCookieSourceAfterFailure`, `runWithCookieSourceRetry`, and `RuntimeTaskRunnerDeps.refreshCookieSourceAfterFailure` exist.
- Contract tests must assert credential recovery uses `recoverCredentialSnapshot`, which validates the current local cookie, calls `persistEffectiveCookies(true)` for CookieCloud mode, validates with `getFansList()`, optionally calls `safeAuth`, and validates again before persisting the passport refresh.
- Unit-style tests must cover `LTP0` detection without exposing the value and `safeAuth` cookie merge behavior with mocked response headers.
- Unit-style tests must cover manual passport cookie normalization, public config masking, manual-mode recovery, and missing-`dy_did` behavior.
- Contract tests must assert task runner modules do not directly reference `safeAuth`, `LTP0`, `ltp0`, `getCookieCloudPassportLtp0`, or `refreshDouyuMainCookiesWithSafeAuth`.
- Contract tests must assert fan reconcile preserves the side-effecting config write and merges the latest local cookie snapshot before `reconcileDockerConfig`.

### 7. Wrong vs Correct

#### Wrong

```typescript
await runTask()
await runTask()
```

#### Correct

```typescript
try {
  await runTask()
} catch (error: unknown) {
  const refreshed = await deps.refreshCookieSourceAfterFailure(error, getTaskLabel(type))
  if (!refreshed) {
    throw error
  }
  await runTask()
}
```

---

## Common Mistakes

- Do not `catch (e)` and assume `e.message`; catch as `unknown` and normalize.
- Do not throw raw Douyu response objects.
- Do not let scheduled task errors escape out of cron callbacks.
- Do not return stack traces or raw config secrets in API responses.
- Do not hide remote CookieCloud fetches inside local-only diagnostics such as `/api/cookie-source/check`.
- Do not add direct `LTP0` / passport refresh without a separate config, secret-masking, validation, and test plan.
