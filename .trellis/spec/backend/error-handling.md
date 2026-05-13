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
- `401` for WebUI auth failures.
- `500` for unexpected runtime failures.

The standard body is:

```json
{ "error": "message" }
```

Keep messages stable when frontend code or tests rely on them.

---

## Common Mistakes

- Do not `catch (e)` and assume `e.message`; catch as `unknown` and normalize.
- Do not throw raw Douyu response objects.
- Do not let scheduled task errors escape out of cron callbacks.
- Do not return stack traces or raw config secrets in API responses.
