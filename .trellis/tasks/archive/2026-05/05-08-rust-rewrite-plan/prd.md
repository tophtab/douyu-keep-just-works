# brainstorm: Rust rewrite plan

## Goal

Plan a Rust rewrite of the Docker/WebUI runtime for `douyu-keep-just-works`, preserving current behavior while targeting lower idle memory, smaller Docker images, and a strongly typed implementation that is practical for AI-assisted maintenance.

## What I already know

* Current Docker runtime is Node/TypeScript, built from `src/docker/**/*.ts` plus shared `src/core/**/*.ts`.
* Current local Node runtime was measured at about 30.55 MiB idle RSS after startup with default config.
* The current Docker runtime is already browserless: it uses HTTP APIs, WebSocket, user-provided/CookieCloud cookies, and browser-like headers, not Chromium.
* The existing `v2.4.0` tag is available as a rollback point.
* The user changed direction from Go to Rust and wants the Go-specific design withdrawn.
* The first implementation target should be the Docker/WebUI runtime, not historical desktop/Electron artifacts under `dist/`.
* Rust-specific research recommends Tokio, axum, serde, reqwest with Rustls, tokio-tungstenite, croner/chrono-tz, tracing, and a small app-owned scheduler/log buffer.
* `cargo` is not installed in this workspace right now, so crate versions/features must be re-verified during scaffolding.

## Assumptions (temporary)

* The Rust rewrite should preserve the existing Docker deployment shape: one container, `/app/config` bind mount, same default port, and WebUI-first operation.
* Existing `config/config.json` format should remain compatible or have an automatic migration path.
* The rewrite should avoid reintroducing Chromium/Playwright unless a future Douyu endpoint makes real browser execution unavoidable.
* Rust is preferred even if implementation effort is higher than Go, because lower runtime overhead and stronger compile-time checks are now prioritized.

## Open Questions

* Should the first Rust release ship as an experimental Docker tag before replacing `latest`?

## Requirements (evolving)

* Reimplement the Docker runtime in Rust.
* Preserve existing WebUI behavior, HTTP API surface, cron task semantics, and config persistence.
* Preserve Douyu HTTP/WebSocket request behavior as closely as practical, including headers, cookies, referers, origins, request timing, and conservative retry behavior.
* Preserve six-field cron semantics with seconds and `Asia/Shanghai`.
* Keep rollback simple through the existing `v2.4.0` tag and/or Docker tag.
* Keep runtime dependencies minimal and avoid framework-heavy architecture.
* Provide measurable before/after numbers for idle memory and image size.
* Preserve TLS/HTTPS functionality in minimal images by intentionally packaging CA roots or using compiled root trust.
* Keep the Rust implementation agent-friendly: small modules, explicit traits/boundaries, fixture-first porting, and no one-pass rewrite.

## Acceptance Criteria (evolving)

* [ ] Rust binary starts the WebUI on the same default port.
* [ ] Existing config file can be loaded without manual edits.
* [ ] Existing task types are supported: collect gift, keepalive, double card, expiring gift, yuba check-in, CookieCloud sync.
* [ ] HTTP API responses remain compatible with the current WebUI.
* [ ] Docker image can be built for linux/amd64 and linux/arm64.
* [ ] Idle memory and image size are measured and documented.
* [ ] Rollback instructions to `v2.4.0` are documented.
* [ ] Rust tests cover config compatibility, route contracts, scheduler behavior, request construction, and deterministic parsers.
* [ ] `cargo fmt --check`, `cargo clippy`, `cargo test`, and release build pass once Rust tooling is available.
* [ ] First Rust image is published/tested as a preview or edge Rust tag before replacing `latest`.

## Definition of Done (team quality bar)

* Tests added/updated for config parsing, scheduler behavior, request payload construction, and response parsing where practical.
* Rust formatting, linting, and test suite pass.
* Docker image builds locally.
* Docs/notes updated if deployment behavior changes.
* Rollout/rollback considered because this is a full runtime rewrite.

## Out of Scope (explicit)

* Reintroducing browser automation as the default runtime.
* Rewriting unrelated Trellis/project tooling.
* Changing the product scope or adding new Douyu features during the initial rewrite.
* Desktop/Electron distribution work.
* Preserving the withdrawn Go implementation plan.

## Technical Notes

* Task directory: `.trellis/tasks/05-08-rust-rewrite-plan/`
* Rollback tag: `v2.4.0`
* Current behavior reference copied from prior research: `research/current-runtime-behavior.md`
* Current runtime entrypoint: `src/docker/index.ts`
* Current HTTP server: `src/docker/server.ts`
* Current WebUI HTML/template: `src/docker/html.ts`
* Current task logic: `src/core/job.ts`, `src/core/api.ts`, `src/core/collect-gift.ts`, `src/core/yuba.ts`
* Current Docker files: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.github/workflows/docker.yml`

## Research References

* `research/current-runtime-behavior.md` - Current Node Docker/WebUI runtime behavior and compatibility contract.
* `research/rust-runtime-stack.md` - Recommended Rust stack, Docker/runtime constraints, TLS/timezone notes, and maintainability guidance.
* `research/rust-migration-strategy.md` - Phased migration, acceptance tests, CI, rollback, and agent-safe implementation slices.

## Decision

Use Rust for the rewrite. The implementation should prioritize compatibility, measured resource improvement, and maintainable AI-assisted development over fastest migration speed.
