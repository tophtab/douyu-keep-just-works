# TypeScript structure refactor and Node upgrade

## Goal

Upgrade the project to a supported Node runtime and reduce TypeScript runtime coupling without changing user-facing behavior. The work should make the Docker WebUI and scheduled task runtime easier to maintain while keeping the current "it just works" deployment model.

## What I already know

- The repository is a single TypeScript/Node project for a Docker WebUI and scheduled Douyu automation tasks.
- Runtime dependencies are currently `axios`, `cron`, `cron-parser`, `express`, and `ws`.
- Docker currently uses `node:18-slim` for both builder and runtime images.
- `tsconfig.docker.json` compiles `src/core/**/*.ts` and `src/docker/**/*.ts` to CommonJS in `build/docker`.
- The largest current files are:
  - `src/docker/html.ts` at roughly 4300 lines.
  - `src/docker/index.ts` at roughly 1200 lines.
  - `src/docker/server.ts` at roughly 700 lines.
- Current frontend guidance says the supported UI is the Docker WebUI served from `src/docker/html.ts`; do not reintroduce Vue, Vite, Pinia, Vuetify, or Electron renderer IPC unless desktop support is explicitly restored.
- Node 24 LTS is the recommended production runtime target in May 2026; Node 26 is current but not the conservative production target.

## Assumptions

- This task should preserve existing behavior and API shapes unless a change is explicitly required by the Node upgrade.
- This task should not rewrite the project in Go.
- This task should not introduce a new frontend framework.
- This task should prefer small, reviewable module boundaries over broad rewrites.

## Requirements

- Upgrade the Docker runtime and builder baseline from Node 18 to Node 24 LTS.
- Align Node typings and lockfile metadata with the selected Node runtime.
- Preserve the existing Docker deployment command and container port.
- Refactor TypeScript structure to reduce coupling in the Docker runtime.
- Keep behavior-compatible config loading, task scheduling, logging, authentication, status cache behavior, and manual trigger routes.
- Keep the existing WebUI visual and interaction behavior unless a necessary mechanical extraction affects file layout only.
- Preserve `npm run type-check`, `npm run build:docker`, and `npm test` behavior.

## Proposed MVP Scope

- Node upgrade:
  - Update Docker base images to Node 24.
  - Update `@types/node` to the Node 24 type line.
  - Keep CommonJS output for now.
- Backend structure refactor:
  - Split Docker runtime orchestration out of `src/docker/index.ts` into focused modules.
  - Candidate modules:
    - config persistence/loading
    - cookie source resolution/cache
    - status caches
    - task scheduler/job lifecycle
    - task trigger wrappers
  - Keep `src/core/*` behavior unchanged except for import adjustments if necessary.
- UI structure:
  - Do not redesign the WebUI.
  - Do not introduce Vite or a framework.
  - Extract `src/docker/html.ts` into static WebUI resource files served by the Docker runtime.
  - Preserve the existing rendered markup, styles, scripts, page routes, and browser behavior.
  - Keep the extraction mechanical: no visual redesign and no frontend framework.

## Out of Scope

- Go rewrite.
- Rust/Python/Bun/Deno migration.
- New database or persistent storage layer.
- UI redesign.
- New frontend framework or separate frontend build pipeline.
- Express 5 migration unless required by the Node upgrade.
- ESM migration unless required by the Node upgrade.

## Acceptance Criteria

- [x] Dockerfile uses Node 24 LTS images.
- [x] Package metadata and lockfile reflect the Node typing upgrade.
- [x] TypeScript compiles successfully.
- [x] Existing npm scripts still work.
- [x] Docker runtime entrypoint still starts the WebUI on port 51417.
- [x] Scheduled jobs can still be registered, stopped, restarted, and manually triggered.
- [x] Config save/load remains backward-compatible with existing `config/config.json`.
- [x] WebUI auth/session behavior remains unchanged.
- [x] WebUI static resource extraction preserves existing page routes.
- [x] Refactored modules have clear ownership and avoid cyclic imports.

## Definition of Done

- Tests or build checks are run: `npm run type-check`, `npm run build:docker`, and `npm test` where practical.
- Docker image build is attempted if local environment supports it.
- No unrelated user changes are reverted.
- Any behavior-affecting decision is documented in this PRD.

## Research References

- [`research/node-upgrade.md`](research/node-upgrade.md) - Node 24 LTS is the recommended production target; Node 26 should not be the default runtime target yet.

## Technical Notes

- Relevant specs:
  - `.trellis/spec/backend/directory-structure.md`
  - `.trellis/spec/backend/error-handling.md`
  - `.trellis/spec/backend/logging-guidelines.md`
  - `.trellis/spec/backend/quality-guidelines.md`
  - `.trellis/spec/guides/code-reuse-thinking-guide.md`
  - `.trellis/spec/guides/cross-layer-thinking-guide.md`
  - `.trellis/spec/guides/docker-webui-auth-contract.md`
  - `.trellis/spec/guides/docker-medal-sync-contract.md`
- Existing dirty worktree contains Trellis metadata/script changes and another task directory that are not part of this task.

## Decisions

- Use scheme B: Node 24 upgrade, backend Docker runtime structure split, and `src/docker/html.ts` extraction in the first implementation pass.

## Implementation Summary

- Upgraded the local/runtime Node baseline from Node 18 to Node 24.
- Replaced the monolithic Docker entrypoint with a thin `src/docker/index.ts` that delegates to `src/docker/runtime.ts`.
- Extracted config persistence and partial config update helpers into `src/docker/config-store.ts`.
- Replaced `src/docker/html.ts` with static `src/docker/webui/index.html` plus `src/docker/webui.ts` for version and route injection.
- Updated the Docker build script to copy WebUI static resources into the compiled Docker output.

## Verification

- `npm run type-check`
- `npm run build:docker`
- `npm run lint`
- `npm test`
- `docker build -t douyu-keep-just-works:node24-refactor .`
- Container smoke test on `WEB_PORT=51418`, checking `/` for title, version label, and route map injection.
