# brainstorm: Go rewrite plan

## Goal

Plan a Go rewrite of the Docker/WebUI runtime for `douyu-keep-just-works`, preserving user-facing behavior while reducing idle memory, Docker image size, and runtime dependency footprint.

## What I already know

* Current Docker runtime is Node/TypeScript, built from `src/docker/**/*.ts` plus shared `src/core/**/*.ts`.
* Current local runtime image `tophtab/douyu-keep-just-works:local` was measured at roughly 303 MB by `docker images`, with an inspected image size around 73 MB excluding shared Docker accounting effects.
* Current idle container RSS was measured at about 30.55 MiB after startup with default config.
* The user prefers Go for the rewrite after comparing Node, Go, Rust, C#, and Python trade-offs.
* The existing `v2.4.0` tag is available as a rollback point.
* Research confirms the current runtime is already browserless. The Go port should preserve header/cookie behavior but should not attempt full browser TLS/header fingerprint emulation unless Douyu later forces a browser path.
* Research recommends Go standard library first, with `github.com/robfig/cron/v3` for six-field cron and `github.com/coder/websocket` for Douyu danmu WebSocket.

## Assumptions (temporary)

* The Go rewrite should preserve the existing Docker deployment shape: one container, `/app/config` bind mount, same default port, and WebUI-first operation.
* Existing `config/config.json` format should remain compatible or have an automatic migration path.
* The rewrite should avoid reintroducing Chromium/Playwright unless a future Douyu endpoint makes real browser execution unavoidable.
* The first implementation target is the Docker/WebUI runtime, not historical desktop/Electron artifacts under `dist/`.

## Open Questions

* Should the first Go release replace the Node Docker image directly, or ship as an experimental tag first?

## Requirements (evolving)

* Reimplement the Docker runtime in Go.
* Preserve existing WebUI behavior, HTTP API surface, cron task semantics, and config persistence.
* Preserve Douyu HTTP/WebSocket request behavior as closely as practical, including headers, cookies, referers, origins, request timing, and conservative retry behavior.
* Keep rollback simple through the existing `v2.4.0` tag and/or Docker tag.
* Keep runtime dependencies minimal.
* Provide measurable before/after numbers for idle memory and image size.
* Preserve six-field cron semantics with seconds and `Asia/Shanghai`.
* Include CA roots and timezone support in the final Docker image.

## Acceptance Criteria (evolving)

* [ ] Go binary starts the WebUI on the same default port.
* [ ] Existing config file can be loaded without manual edits.
* [ ] Existing task types are supported: collect gift, keepalive, double card, expiring gift, yuba check-in, CookieCloud sync.
* [ ] HTTP API responses remain compatible with the current WebUI.
* [ ] Docker image can be built for linux/amd64 and linux/arm64.
* [ ] Idle memory and image size are measured and documented.
* [ ] Rollback instructions to `v2.4.0` are documented.
* [ ] `go test ./...` and Docker build pass for the Go runtime.
* [ ] Route-level contract tests cover auth, config masking/raw config, task status, logs, cron preview, and manual trigger error shapes.
* [ ] Config compatibility tests cover legacy `cookie`, `manualCookies`, CookieCloud, default tasks, legacy `percentage`, allocation modes, and invalid cron.

## Definition of Done (team quality bar)

* Tests added/updated for config parsing, scheduler behavior, request payload construction, and response parsing where practical.
* Go formatting, vet/static checks, and test suite pass.
* Docker image builds locally.
* Docs/notes updated if deployment behavior changes.
* Rollout/rollback considered because this is a full runtime rewrite.

## Out of Scope (explicit)

* Reintroducing browser automation as the default runtime.
* Rewriting unrelated Trellis/project tooling.
* Changing the product scope or adding new Douyu features during the initial rewrite.
* Desktop/Electron distribution work.

## Technical Notes

* Task directory: `.trellis/tasks/05-08-go-rewrite-plan/`
* Rollback tag: `v2.4.0`
* Current runtime entrypoint: `src/docker/index.ts`
* Current HTTP server: `src/docker/server.ts`
* Current WebUI HTML/template: `src/docker/html.ts`
* Current task logic: `src/core/job.ts`, `src/core/api.ts`, `src/core/collect-gift.ts`, `src/core/yuba.ts`
* Current Docker files: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.github/workflows/docker.yml`

## Research References

* `research/current-runtime-behavior.md` - Current Node Docker/WebUI runtime behavior and compatibility contract.
* `research/go-runtime-stack.md` - Recommended Go runtime stack and Docker packaging approach.
* `research/go-migration-strategy.md` - Phased migration strategy, acceptance tests, rollback, CI, and risk controls.

## Decision

Use Go for the rewrite. The implementation should prioritize compatibility and measured resource improvement over rewriting the product scope. The target is a stable Go Docker runtime with lower idle RSS and a much smaller image, not a feature expansion.
