# Directory Structure

> How backend code is organized in this project.

---

## Overview

Backend code is split by deployment and responsibility, not by framework layer folders. The Docker runtime is the maintained runtime. Do not add Electron, Yarn desktop packaging, or renderer release work unless desktop support is explicitly restored.

---

## Directory Layout

```text
src/
  core/                 Shared Douyu APIs, task logic, config types, defaults.
  docker/               Docker runtime, Express routes, scheduler, config IO.
  docker/webui.ts       Static WebUI asset/template serving helpers.
  docker/webui/         Vite/Vue WebUI source, documented by frontend specs.
test/                   Node contract tests for repo maintenance and behavior.
```

Current examples:

- `src/core/api.ts` owns low-level Douyu HTTP helpers, cookie parsing, and response normalization.
- `src/core/config-normalization.ts` owns Docker config defaults, normalization, and fan-backed task reconciliation.
- `src/core/job.ts` coordinates task execution using shared APIs.
- `src/core/gift-task.ts` owns pure gift-task helpers used by task execution, such as participating-room allocation filtering and runtime gift send-job preparation.
- `src/docker/runtime.ts` wires config loading, runtime services, scheduler dependencies, and Express app startup.
- `src/docker/runtime-app-context.ts` builds the WebUI `AppContext` from runtime services.
- `src/docker/runtime-cookie-source.ts` is the cookie-source facade; focused cookie-source responsibilities live in sibling modules such as `runtime-cookie-cloud-cache.ts`, `runtime-effective-cookies.ts`, `runtime-cookie-snapshot-store.ts`, and `runtime-passport-qr-login.ts`.
- `src/docker/runtime-cookie-recovery.ts` owns credential-recovery retry orchestration and the lower-level CookieCloud/passport recovery pipeline.
- `src/docker/runtime-fans-sync.ts` owns fan-medal synchronization, config reconcile, and latest cookie snapshot merging.
- `src/docker/runtime-cookie-cloud-sync.ts` owns CookieCloud scheduled sync lifecycle.
- `src/docker/runtime-config-service.ts` owns config application side effects: normalization, cache invalidation, CookieCloud sync reconciliation, scheduler reconciliation, and user-facing runtime logs.
- `src/docker/server.ts` creates the Express app and registers route modules.
- `src/docker/runtime-scheduler.ts` owns cron job lifecycle and task locking.
- `src/docker/runtime-task-runners.ts` adapts runtime dependencies into `src/core/job.ts`.

---

## Module Organization

Keep shared business behavior in `src/core/`. Runtime-specific behavior belongs in `src/docker/`.

Use small files named for the thing they own:

```typescript
// src/docker/server.ts
registerConfigRoutes(app, ctx)
registerFansRoutes(app, ctx)
registerCookieSourceRoutes(app, ctx)
registerTaskRoutes(app, ctx)
```

Route modules should register routes through a `register*Routes(app, ctx)` function, as in `src/docker/server-config-routes.ts`, `src/docker/server-fans-routes.ts`, and `src/docker/server-task-routes.ts`.

Runtime orchestration should stay in `src/docker/runtime.ts` as the composition root. Stable runtime responsibilities should live in focused sibling services when they can be described independently:

- WebUI `AppContext` construction belongs in `runtime-app-context.ts`;
- credential-recovery retry orchestration and low-level CookieCloud/passport recovery belong in `runtime-cookie-recovery.ts`;
- cookie-source facade methods stay in `runtime-cookie-source.ts`, while CookieCloud fetch caching, effective cookie resolution, local snapshot persistence, and Passport QR login sessions belong in focused sibling modules;
- fan-medal synchronization, config reconcile, and local cookie snapshot merging belong in `runtime-fans-sync.ts`;
- scheduled CookieCloud sync lifecycle belongs in `runtime-cookie-cloud-sync.ts`;
- config application and cache/scheduler side effects belong in `runtime-config-service.ts`;
- task scheduling and task execution details stay in `runtime-scheduler.ts` and `runtime-task-runners.ts`.

`runtime.ts` may know which services exist, how they are constructed, startup order, server listening, and shutdown handling. It should not own rules such as when to retry credential recovery, how to reconcile fan-backed config, how to merge CookieCloud/manual cookie snapshots, or the concrete WebUI route context method bodies.

---

## Naming Conventions

- Use kebab-case filenames for backend modules: `server-route-utils.ts`, `runtime-task-runners.ts`, `config-store.ts`.
- Use `Docker*` prefixes for runtime classes and types that are specific to the container runtime, such as `DockerTaskScheduler` and `DockerRuntimeCache`.
- Use `register*Routes` for Express route installers.
- Use `validate*Config` for synchronous validation helpers.
- Use `create*` for factory functions such as `createServer`, `createLogger`, and `createDefaultDockerConfig`.

---

## Examples

Good patterns to copy:

- `src/docker/server.ts` keeps server assembly declarative.
- `src/docker/config-store.ts` isolates disk read/write and config merging.
- `src/docker/task-metadata.ts` centralizes task labels, task types, and task-wide metadata.
- `src/core/types.ts` is the shared contract for config and API response shapes.

Avoid adding new cross-cutting constants inside route or scheduler files when they describe all tasks. Put those in `task-metadata.ts` first.
