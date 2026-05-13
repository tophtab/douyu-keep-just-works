# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

Backend changes must preserve the Docker WebUI runtime first. Use Node.js 24, TypeScript, Express 5, `cron`, and the existing config JSON model. Keep behavior focused and covered by contract tests when it affects build, routes, scheduling, config, or migration boundaries.

---

## Forbidden Patterns

- Do not add Electron, Yarn desktop release, or renderer packaging work unless the task explicitly restores desktop support.
- Do not reintroduce deleted legacy WebUI source modules such as old `app-*.js` files.
- Do not bypass Vite for Docker WebUI assets; `npm run build:docker` must run `npm run build:webui`.
- Do not duplicate task-wide facts such as labels, schedule summaries, active checks, or "not configured" messages across route, scheduler, and runner modules.
- Do not expose secrets in `/api/config`, logs, tests, or docs.
- Do not use untyped `any` when `unknown`, local interfaces, or shared types from `src/core/types.ts` are available.

---

## Required Patterns

### Docker-First Runtime

Keep Docker deployment working first. The expected quality gate is:

```bash
npm run lint
npm run type-check
npm run build:docker
npm test
```

`npm test` currently runs Node contract tests and then a Docker build.

### Docker Task Metadata Ownership

Task-wide labels, "not configured" messages, active-state checks, and schedule summaries belong in `src/docker/task-metadata.ts` before they are repeated in scheduler, route, or runner code. Keep behavior-specific execution in the owning runtime modules, but centralize task inventory facts.

Use this pattern when adding or changing a Docker task:

```typescript
export const TASK_NOT_CONFIGURED_MESSAGES: Record<TaskType, string> = {
  keepalive: '保活任务未配置',
  // ...
}

export function isTaskActive(config: { active?: boolean } | null | undefined): boolean {
  return Boolean(config && config.active !== false)
}
```

Do not copy equivalent task messages or `config && config.active !== false` checks into multiple modules. Reuse metadata helpers from `runtime-scheduler.ts`, `runtime-task-runners.ts`, and future task route code where practical.

### Validate Before Persisting

Route handlers should validate config sections before calling `ctx.saveTaskConfig`. Follow `src/docker/server-config-routes.ts`, which returns `400` before persistence when validation fails.

---

## Testing Requirements

- Update `test/project-maintenance-contract.test.js` when changing build architecture, WebUI file organization, Node version alignment, or legacy bridge deletion guarantees.
- Add or update focused Node contract tests under `test/*.test.js` for request smoothing, config persistence, scheduling contracts, and static architecture rules.
- Run `npm run type-check` for TypeScript shape changes across backend and WebUI.
- Run `npm run lint` before handoff.

---

## Code Review Checklist

- Does the change keep the Docker path working and documented in `CONTRIBUTING.md` if needed?
- Are config changes normalized and validated before save?
- Are secrets masked in responses and absent from logs?
- Are task metadata and task behavior kept in the right modules?
- Does the change preserve Chinese user-facing messages unless behavior text is explicitly in scope?
- Are contract tests updated when architecture or lifecycle assumptions change?
