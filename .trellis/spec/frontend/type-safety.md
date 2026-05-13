# Type Safety

> Type safety patterns in this project.

---

## Overview

Frontend code is TypeScript plus Vue SFC templates checked by `vue-tsc`. Shared API and config contracts live in `src/core/types.ts`; frontend-only component and bridge shapes live near their consumers.

---

## Type Organization

- Shared backend/frontend domain types: `src/core/types.ts`.
- WebUI navigation/page types: `src/docker/webui/navigation.ts`.
- Request error type: `src/docker/webui/request.ts`.
- Task UI helper types: `src/docker/webui/task-shared.ts`.
- Component-local prop types: inline in the component's `<script setup>`.

Use type-only imports for types:

```typescript
import type { ThemeMode } from '../../core/types'
import type { Ref } from 'vue'
```

---

## Validation

There is no runtime schema library. Validate unknown data with local type guards and cautious property reads.

Examples:

- `request.ts` checks whether an error response contains a string `error`.
- `theme.ts` uses `isThemeMode(value): value is ThemeMode`.
- `resources.ts` normalizes log entries from `unknown` API data.
- `task-shared.ts` uses `isHttpUnauthorized` and `isWebUiTaskType` helpers.

---

## Common Patterns

Prefer `unknown` at boundaries, then narrow:

```typescript
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isWebUiTaskType(value: string | null): value is WebUiTaskType {
  return Boolean(value && (WEBUI_TASK_TYPES as string[]).includes(value))
}
```

Use `Record<string, unknown>` only for truly dynamic response summaries, such as overview response data.

---

## Forbidden Patterns

- Do not use `any` for API responses, config payloads, or component props.
- Do not cast server responses directly to rich types without checking the fields the UI needs.
- Do not duplicate shared config interfaces in WebUI modules when `src/core/types.ts` already owns the shape.
- Do not weaken `vue-tsc` errors with broad assertions; fix the model or add a narrow guard.
