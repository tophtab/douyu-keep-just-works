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

## Scenario: CookieCloud Recovery Retry

### 1. Scope / Trigger
- Trigger: a Docker runtime task or WebUI status load fails with a message classified by `isCookieCredentialMessage`.
- Scope: runtime-only recovery for CookieCloud-backed local login snapshots.

### 2. Signatures
- `isCookieCredentialMessage(message: string): boolean` identifies login-cookie failures.
- `refreshCookieSourceAfterFailure(error: unknown, context: string): Promise<boolean>` delegates to `DockerCookieSourceManager.recoverCredentialSnapshot(...)` when CookieCloud is configured.
- `runWithCookieSourceRetry<T>(context: string, run: () => Promise<T>): Promise<T>` wraps WebUI-facing Douyu reads.
- `RuntimeTaskRunnerDeps.refreshCookieSourceAfterFailure(error, context)` lets scheduled and manual tasks share the same recovery path.
- `DockerCookieSourceManager.recoverCredentialSnapshot({ validateMainCookie, log }): Promise<{ recovered: boolean; refreshedBy: 'cookieCloud' | 'safeAuth' | null; reason: string }>` owns the CookieCloud sync, validation, optional passport refresh, and persistence.
- `src/docker/runtime-cookie-recovery.ts` contains the centralized recovery pipeline. Individual task runners must call the shared retry hook, not call `safeAuth` or `LTP0` handling directly.
- `refreshDouyuMainCookiesWithSafeAuth({ mainCookie, dyDid, ltp0 }): Promise<{ refreshedCookie: string; returnedKeys: string[] }>` performs the pure HTTP `passport.douyu.com` refresh and returns a merged local main-cookie header.

### 3. Contracts
- First failure is inspected by message only; there is no custom error class hierarchy.
- Recovery runs only when CookieCloud is fully configured and active.
- Recovery first persists the effective CookieCloud snapshot to local `manualCookies`, then validates the local main cookie using required-key checks and `getFansList()`.
- If the CookieCloud snapshot is still invalid, recovery may call passport `safeAuth` only when `dy_did` is present in the local main cookie and `LTP0` is present in the `passport.douyu.com` CookieCloud cookie set.
- `safeAuth` may update only the local main-cookie snapshot after its merged cookie passes the same validation gate; it must not write cookies back to the browser or CookieCloud.
- The original operation is retried exactly once.
- Recovery does not run a browser, simulate Douyu login pages, refresh fishbar `acf_yb_*`, or store standalone long-lived Douyu login tokens.
- Logs may include cookie field names and high-level reasons, but must not include raw cookies, `LTP0`, CookieCloud passwords, or returned auth token values.

### 4. Validation & Error Matrix
- CookieCloud inactive -> rethrow the original error.
- CookieCloud persist fails -> log the recovery failure and rethrow the original error.
- CookieCloud sync validates through `getFansList()` -> retry the original operation once.
- CookieCloud sync remains invalid and `dy_did` or passport `LTP0` is missing -> log the non-secret reason and rethrow the original error.
- `safeAuth` returns no usable main-site auth fields -> log the recovery failure and rethrow the original error.
- `safeAuth` returns fields but post-refresh `getFansList()` validation fails -> do not persist the refreshed cookie; log the non-secret reason and rethrow the original error.
- `safeAuth` returns fields and validation passes -> persist the merged local main cookie, keep the current yuba cookie, invalidate local caches, and retry the original operation once.
- Retry fails -> surface the retry error through the existing route or scheduler path.
- Missing config, not-configured task, or ordinary Douyu business failure -> no recovery retry.

### 5. Good/Base/Bad Cases
- Good: `getFansList` fails with "请检查主站 Cookie", CookieCloud sync updates `manualCookies`, validation passes, then the same read is retried once.
- Good: CookieCloud sync still fails validation, passport `LTP0` + `dy_did` refresh main-site `acf_*` fields, post-refresh `getFansList()` passes, then the same read is retried once.
- Base: a task fails for non-cookie business reasons; the scheduler logs the task error without CookieCloud traffic.
- Bad: `/api/cookie-source/check` fetches CookieCloud remotely or task execution loops on repeated login failure.
- Bad: persisting a `safeAuth` response before post-refresh validation passes.
- Bad: adding task-specific `LTP0` refresh branches inside collect/keepalive/double-card/expiring-gift/yuba task runners.
- Bad: claiming fishbar `acf_yb_*` recovery without a verified HTTP cookie-refresh flow.

### 6. Tests Required
- Contract tests must assert `refreshCookieSourceAfterFailure`, `runWithCookieSourceRetry`, and `RuntimeTaskRunnerDeps.refreshCookieSourceAfterFailure` exist.
- Contract tests must assert CookieCloud recovery uses `recoverCredentialSnapshot`, which calls `persistEffectiveCookies(true)`, validates with `getFansList()`, optionally calls `safeAuth`, and validates again before persisting the passport refresh.
- Unit-style tests must cover `LTP0` detection without exposing the value and `safeAuth` cookie merge behavior with mocked response headers.
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
