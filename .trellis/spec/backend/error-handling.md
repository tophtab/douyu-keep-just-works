# Error Handling

> How errors are handled in this project.

---

## Overview

This codebase uses direct `try/catch` handling and plain `Error` objects.
There is no custom error hierarchy yet.

The common pattern is:

1. Fail fast in helpers by throwing `Error`
2. Catch at runtime boundaries such as cron callbacks, Express handlers, IPC handlers, or UI actions
3. Convert the failure into a user-facing message, HTTP response, or log line

---

## Error Types

- Use built-in `Error` with a clear Chinese message string.
- In catch blocks, this codebase commonly treats the value as `any` and falls back to `error.message || error`.
- Some helpers return early after logging instead of rethrowing when the failure should not crash the whole job.

Examples:

- `src/core/api.ts`: `parseDyAndSidFromCookie()` throws when required cookie parts are missing.
- `src/core/api.ts`: `getDid()` throws `new Error('获取did失败')`.
- `src/docker/index.ts`: scheduled jobs catch errors and convert them into category-specific log messages.

---

## Error Handling Patterns

- Wrap external effects such as HTTP calls, cron parsing, window launch, and config IO in `try/catch`.
- Keep the job loop resilient. A single failed room should not abort the whole send flow; instead, log and continue.
- Catch near the transport boundary:
  - Express route returns `400` or `500`
  - IPC handler resolves or rejects the Promise
  - cron callback logs and keeps the scheduler alive

Examples:

- `src/docker/server.ts` validates request payloads and returns JSON errors with HTTP status codes.
- `src/main/ipc.ts` rejects IPC requests for invalid commands or scheduling failures.
- `src/core/job.ts` catches per-room send failures, carries the failed count forward, and continues.

---

## API Error Responses

Docker HTTP routes use a simple JSON shape:

- Validation errors: `res.status(400).json({ error: 'message' })`
- Runtime errors: `res.status(500).json({ error: e.message })`
- Successful mutations: `res.json({ ok: true })`

This is intentionally lightweight; keep new routes consistent with the existing shape.

---

## Common Mistakes

- Do not swallow errors silently; at least log them or return an error response.
- Do not throw raw strings; throw `Error` instances so `.message` exists.
- Do not let low-level parsing failures leak all the way to the user without context.
- Do not crash the whole scheduler because one room send failed.
- Do not treat Douyu HTTP `200` as business success until the response body error/code fields have been checked.

---

## Scenario: Douyu Business Errors and Partial Status Failures

### 1. Scope / Trigger

- Trigger: Any change to `src/core/api.ts`, `src/core/double-card.ts`, `src/core/job.ts`, or Docker status routes that call Douyu APIs.
- Goal: Preserve the difference between an upstream/business failure and a legitimate empty result.

### 2. Signatures

```ts
sendGift(args: sendArgs, job: SendGift, cookie: string): Promise<string>
getFansList(cookie: string): Promise<Fans[]>
AppContext.fetchFansStatus(): Promise<FansStatusResponse>
```

### 3. Contracts

- `sendGift()` must inspect Douyu response body fields such as `error`, `code`, or `status_code` before reporting success.
- `getFansList()` must throw an actionable `Error` when the response is not the expected fan-badge table, for example expired cookies or changed Douyu HTML.
- `/api/fans/status` may degrade per-room double-card lookup failures to `doubleActive: false` with a log entry.
- `/api/fans/status` must still fail the whole request if `getFansList()` fails, because the route cannot build the primary table.

### 4. Validation & Error Matrix

| Case | Expected result |
|------|-----------------|
| Gift send HTTP 200 with `error !== 0` | Throw `Error` with the Douyu code/message; job logs the room failure and transfers the count |
| Gift send malformed body | Throw actionable format error |
| Fan badge response missing table | Throw actionable cookie/format error; route returns JSON error |
| One double-card room status fails | Log room-level failure; `/api/fans/status` still returns `200` with remaining fan rows |
| Gift inventory lookup fails after fan list succeeds | `/api/fans/status` returns `200` with `gift.error` |

### 5. Good/Base/Bad Cases

- Good: `sendGift()` validates the body, then `sendGifts()` logs a failed room and continues.
- Base: `getFansList()` returns `[]` only when the fan-badge table exists and has no data rows.
- Bad: `sendGift()` returns `JSON.stringify(res.data)` for any HTTP 200 response and lets the caller log success.

### 6. Tests Required

- Run `npm run lint`.
- Run `npm run type-check`.
- Run `npm run build:docker` or `npm test`.
- For manual WebUI checks, verify config load, fan status refresh, and logs after a simulated room-level double-card failure.

### 7. Wrong vs Correct

#### Wrong

```ts
await sendGift(args, item, cookie)
log('赠送成功')
```

#### Correct

```ts
await sendGift(args, item, cookie) // helper throws on Douyu business errors
log('赠送成功')
```
