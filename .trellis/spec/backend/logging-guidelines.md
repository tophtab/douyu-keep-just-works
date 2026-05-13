# Logging Guidelines

> How logging is done in this project.

---

## Overview

Runtime logs are in-memory entries plus console output. The public WebUI log API reads from `src/docker/logger.ts`. There is no external logging library.

```typescript
export interface LogEntry {
  timestamp: string
  category: string
  message: string
}
```

Timestamps are formatted for `Asia/Shanghai`, matching runtime scheduling.

---

## Log Levels

There are no explicit log levels. Use categories instead:

- `系统` for runtime lifecycle, config, CookieCloud sync, and scheduler reconciliation.
- task categories from `TASK_LOG_CATEGORIES` for task-specific execution messages.

Use `console.log` only through `addLog`/`createLogger` so logs are available in the WebUI.

---

## Structured Logging

Each log entry has:

- `timestamp`
- `category`
- `message`

The logger keeps a bounded in-memory list with `MAX_LOGS = 500`:

```typescript
export function addLog(category: string, message: string): void {
  const entry: LogEntry = { timestamp: createTimestamp(), category, message }
  logs.push(entry)
  if (logs.length > MAX_LOGS) {
    logs.shift()
  }
  console.log(`[${entry.timestamp}] [${category}] ${message}`)
}
```

---

## What to Log

Log operational state changes that help a Docker user understand what happened:

- startup and config load result
- missing login credentials
- CookieCloud sync start/failure/update status
- task start, manual trigger, busy-skip, and execution failure
- targeted task reload summaries after config, cookie, or medal-list changes

Keep user-facing runtime messages in Chinese, matching the current WebUI and logs.

---

## What NOT to Log

- Raw Douyu cookies.
- CookieCloud password values.
- Full config JSON.
- WebUI password values.
- Large Douyu API response bodies unless a task explicitly introduces sanitized diagnostics.
