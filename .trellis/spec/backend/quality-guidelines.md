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
- Do not expose secrets in unauthenticated responses, summary/status APIs, logs, tests, or docs. Authenticated `/api/config` is the explicit complete-config editing endpoint and must stay protected by WebUI auth.
- Do not use untyped `any` when `unknown`, local interfaces, or shared types from `src/core/types.ts` are available.
- Do not rely on implicit `any`; the Docker TypeScript config enables `noImplicitAny`.

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

### Docker Image Build Cache Contracts

#### 1. Scope / Trigger

Apply this contract when editing `Dockerfile`, `.dockerignore`, `.github/workflows/docker.yml`, package metadata, TypeScript/Vite build config, or files that change Docker image build inputs.

#### 2. Signatures

- Local runtime build: `npm run build:docker`
- Image build: `docker build -f Dockerfile .`
- CI workflow: `.github/workflows/docker.yml`

#### 3. Contracts

- Docker context should be an allowlist aligned to Dockerfile inputs: `Dockerfile`, `.dockerignore`, `package.json`, `package-lock.json`, `tsconfig.docker.json`, `tsconfig.webui.json`, `vite.config.ts`, and `src/**`.
- Dependency install must happen in a package-file-only stage before `COPY src`; this keeps `npm ci` cached across source-only changes.
- Production dependency pruning must derive from the dependency stage, not from a post-source build stage; otherwise every source change re-runs the prune step.
- Runtime must copy production-pruned `node_modules` and compiled `build/docker` output from prior stages instead of running a second runtime `npm ci`.
- Branch and pull request workflow triggers should use path filters for image-affecting files; release tag and manual dispatch behavior must remain available.

#### 4. Validation & Error Matrix

- Source-only change invalidates `npm ci` or production prune -> stage boundary is wrong.
- Docs-only or local metadata change starts branch/PR Docker workflow -> path filters are too broad.
- Package or lockfile change does not start Docker workflow -> path filters are too narrow.
- Runtime image can load dev-only build tooling -> production prune/copy contract is broken.
- Runtime image cannot load a production dependency such as `express` -> runtime dependency copy is incomplete.

#### 5. Good/Base/Bad Cases

- Good: source change re-runs `COPY src` and `npm run build:docker` only, while dependency and production-prune stages stay cacheable.
- Base: package-lock change re-runs dependency install and production prune.
- Bad: `npm prune` is chained after `npm run build:docker` in the same stage, causing source changes to repeat dependency pruning.

#### 6. Tests Required

- Update `test/project-maintenance-contract.test.js` when changing Dockerfile stages, `.dockerignore` allowlist, or workflow path filters.
- Assert the Dockerfile has one `RUN npm ci`, keeps production prune before the source-copy build stage, and does not run `npm ci` in the runtime stage.
- Assert `.dockerignore` active rules match the Dockerfile input allowlist.
- Assert workflow path filters include image-affecting files.
- Run `npm run lint`, `npm run type-check`, `npm run test:contracts`, `npm run build:docker`, and a local `docker build` when Docker is available.

#### 7. Wrong vs Correct

Wrong:

```Dockerfile
COPY src ./src
RUN npm run build:docker \
  && npm prune --omit=dev
```

Correct:

```Dockerfile
FROM deps AS production-deps
RUN npm prune --omit=dev --omit=optional

FROM deps AS builder
COPY src ./src
RUN npm run build:docker
```

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

Do not copy equivalent task messages, task-list iteration, or `config && config.active !== false` checks into multiple modules. Reuse metadata helpers from `runtime.ts`, `server-config-routes.ts`, `runtime-scheduler.ts`, `runtime-task-runners.ts`, and future task route code where practical.

When a module needs to know whether any Docker task is enabled, use `hasActiveTaskConfig(config)` from `src/docker/task-metadata.ts` instead of hand-writing an `||` chain across `collectGift`, `keepalive`, `doubleCard`, `expiringGift`, and `yubaCheckIn`.

Scheduled and manual task dispatch should share the runtime runner entry point:

```typescript
await runRuntimeTask(type, taskConfig, deps)
```

Keep task-specific cookie/status-cache behavior in `runtime-task-runners.ts`; scheduler code should own cron lifecycle and locks, not duplicate task execution switches.

### Validate Before Persisting

Route handlers should validate config sections before calling `ctx.saveTaskConfig`. Follow `src/docker/server-config-routes.ts`, which returns `400` before persistence when validation fails.

### Narrow External Response Data

Treat remote API payloads as untrusted. When Axios response data flows into array helpers or object access, first narrow it with local interfaces, `unknown[]`, or `Record<string, unknown>` guards so `noImplicitAny` continues to protect the Docker backend.

```typescript
const rows = (data.data.list as unknown[])
  .filter((item): item is Record<string, unknown> => isRecord(item))
  .map(normalizeRow)
```

---

## Testing Requirements

- Update `test/project-maintenance-contract.test.js` when changing build architecture, WebUI file organization, Node version alignment, or legacy bridge deletion guarantees.
- Add or update focused Node contract tests under `test/*.test.js` for request smoothing, config persistence, scheduling contracts, and static architecture rules.
- For route auth, editable config, overview summaries, or secret-boundary behavior, prefer route-level Node tests through `createServer(ctx)` with a fake `AppContext` over source-text regex checks.
- When a Node contract test needs to execute TypeScript modules directly, use `test/helpers/typescript-module-loader.js` instead of duplicating TypeScript transpile/module-loading setup.
- Run `npm run type-check` for TypeScript shape changes across backend and WebUI.
- Run `npm run lint` before handoff.

---

## Code Review Checklist

- Does the change keep the Docker path working and documented in `CONTRIBUTING.md` if needed?
- Are config changes normalized and validated before save?
- Are secrets absent from logs, diagnostics, overview/status responses, and unauthenticated responses?
- Are task metadata and task behavior kept in the right modules?
- Does the change preserve Chinese user-facing messages unless behavior text is explicitly in scope?
- Are contract tests updated when architecture or lifecycle assumptions change?
