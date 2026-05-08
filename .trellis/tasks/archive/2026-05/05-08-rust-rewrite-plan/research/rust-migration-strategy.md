# Research: rust migration strategy

- Query: How should the current Node/TypeScript Docker WebUI be rewritten in Rust while preserving API/config compatibility and keeping rollback safe?
- Scope: mixed
- Date: 2026-05-08

## Findings

### Files found

- `package.json` - current Docker-only Node scripts, version metadata, and runtime dependencies.
- `Dockerfile` - current two-stage Node 18 image, `/app/config`, `WEB_PORT=51417`, and `node dist/docker/index.js` entrypoint.
- `docker-compose.yml` - current deployment shape: same service name, port `51417`, `./config:/app/config`, `TZ=Asia/Shanghai`, and `WEB_PASSWORD=password`.
- `.github/workflows/docker.yml` - current CI/publish contract: validate first, publish `edge` on default branch, publish `x.y.z` plus `latest` on release tags, and use native arm64 release runners.
- `src/core/types.ts` - persisted config and API response schema that the Rust structs must deserialize/serialize compatibly.
- `src/core/medal-sync.ts` - default values, legacy config normalization, and medal-driven reconciliation rules.
- `src/core/api.ts` - Douyu main-site HTTP request construction, response validation, fan HTML parsing, backpack parsing, and gift send behavior.
- `src/core/collect-gift.ts` - Douyu danmu WebSocket packet encoding/decoding and collect-gift state machine.
- `src/core/job.ts` - task orchestration, allocation, throttling, per-room failure transfer, and log text semantics.
- `src/core/cookie-cloud.ts` - CookieCloud legacy decrypt, domain/path cookie selection, and readiness diagnostics.
- `src/core/yuba.ts` - Yuba HTTP status/sign/supplement flows and dy-token fallback behavior.
- `src/docker/index.ts` - runtime state, config IO, cookie resolution, scheduler lifecycle, task locks, manual triggers, and graceful shutdown.
- `src/docker/server.ts` - WebUI/API routes, in-memory session auth, validation, masked/raw config responses, and JSON error status codes.
- `src/docker/html.ts` - single-file WebUI and page route map served by the backend.
- `src/docker/cron.ts` - six-field cron validation and preview with Shanghai timezone semantics.
- `src/docker/logger.ts` - in-memory capped logs and stdout mirror.
- `.trellis/tasks/05-08-rust-rewrite-plan/research/current-runtime-behavior.md` - detailed current behavior compatibility baseline.

### Code patterns

- Current Docker build/test commands are all Docker-runtime TypeScript commands: `lint`, `type-check`, `test`, `build`, and `build:docker` (`package.json:13`).
- Runtime image currently exposes the same public defaults that should remain stable during migration: `TZ=Asia/Shanghai`, `WEB_PORT=51417`, `/app/config`, and entrypoint (`Dockerfile:15`, `Dockerfile:17`, `Dockerfile:24`, `Dockerfile:28`).
- Compose users currently depend on `tophtab/douyu-keep-just-works:${DOCKER_TAG:-latest}`, port `51417:51417`, `./config:/app/config`, and `WEB_PASSWORD=password` (`docker-compose.yml:3`).
- Docker publishing already has the desired rollback-friendly tag discipline: default branch publishes `edge`, release tags publish exact `x.y.z` plus `latest`, PR builds do not push, regular builds are `linux/amd64`, and release builds include native `linux/arm64` (`.github/workflows/docker.yml:7`, `.github/workflows/docker.yml:71`, `.github/workflows/docker.yml:75`, `.github/workflows/docker.yml:121`, `.github/workflows/docker.yml:137`).
- The persisted config schema is centered on `DockerConfig`, with legacy `cookie`, optional `manualCookies`, `cookieCloud`, `ui`, and task configs (`src/core/types.ts:185`).
- Normalization is behavior, not just shape: default crons, default gift ID, theme default, legacy cookie promotion, `percentage` to `weight`, active flags, and optional tasks all need Rust parity (`src/core/medal-sync.ts:4`, `src/core/medal-sync.ts:19`, `src/core/medal-sync.ts:125`, `src/core/medal-sync.ts:303`).
- WebUI route map is part of the browser contract and should remain identical unless the WebUI is intentionally changed (`src/docker/html.ts:3`).
- Auth/session compatibility includes `dykw_session`, in-memory sessions, auth status/login/logout routes, and `401 { error: '请先登录' }` for protected APIs (`src/docker/server.ts:54`, `src/docker/server.ts:371`, `src/docker/server.ts:375`, `src/docker/server.ts:388`, `src/docker/server.ts:393`).
- Config routes have two different secrecy contracts: `/api/config` masks secrets, while authenticated `/api/config/raw` returns raw persisted config to the in-page script (`src/docker/server.ts:417`, `src/docker/server.ts:433`).
- Route validation is explicit and returns Chinese error strings for invalid cron, send allocations, CookieCloud config, Yuba mode, expiring thresholds, and unknown trigger types (`src/docker/server.ts:247`, `src/docker/server.ts:334`, `src/docker/server.ts:474`, `src/docker/server.ts:657`).
- Scheduler state is an in-memory map over exactly `collectGift`, `keepalive`, `doubleCard`, `expiringGift`, and `yubaCheckIn`; each status includes `running`, `lastRun`, and `nextRun` (`src/docker/index.ts:30`, `src/docker/index.ts:57`).
- Runtime concurrency semantics are user-visible: scheduled overlaps are skipped with logs, while manual overlaps return `任务正在执行中，请稍后再试` (`src/docker/index.ts:395`, `src/docker/index.ts:420`, `src/docker/index.ts:876`).
- Cookie resolution keeps manual cookies as fallback, prefers CookieCloud when enabled, maintains a short snapshot cache, and persists effective cookies back into `manualCookies` when requested (`src/docker/index.ts:109`, `src/docker/index.ts:164`, `src/docker/index.ts:198`, `src/docker/index.ts:340`).
- Douyu HTTP behavior depends on browser-like headers and manual cookie header construction, not an automatic cookie jar (`src/core/api.ts:9`, `src/core/api.ts:246`, `src/core/cookie-cloud.ts:242`).
- Unofficial Douyu boundaries are numerous and fragile: fan badge HTML scraping, backpack v5/v1 probing, gift sending, double-card status, danmu WebSocket collect flow, Yuba web/mobile APIs, and CookieCloud legacy decrypt (`src/core/api.ts:189`, `src/core/api.ts:246`, `src/core/api.ts:279`, `src/core/collect-gift.ts:118`, `src/core/double-card.ts:10`, `src/core/yuba.ts:139`, `src/core/yuba.ts:435`).
- Logging compatibility includes a 500-entry cap, Shanghai-local timestamps, fixed category labels, and stdout lines formatted as `[timestamp] [category] message` (`src/docker/logger.ts:1`, `src/docker/logger.ts:7`, `src/docker/logger.ts:11`, `src/docker/index.ts:72`).

### Recommended Rust architecture

Use a compatibility-first Rust workspace, not a broad product redesign:

- `crates/dykw-core`: config structs, normalization/reconciliation, cookie parsing/selection, request builders, response parsers, gift allocation, and pure task planning.
- `crates/dykw-douyu`: async Douyu HTTP/WebSocket clients using the core request builders and parsers.
- `crates/dykw-web`: Axum router, auth/session middleware, JSON route handlers, static `html` response, and route validation.
- `crates/dykw-runtime`: config file IO, log buffer, scheduler, task locks, startup/shutdown, and trigger wiring.
- `crates/dykw-bin`: thin binary entrypoint that reads env, assembles runtime state, and serves the WebUI.

Keep shared behavior in pure modules first. The risky Rust work is not Axum itself; it is preserving all small compatibility semantics that currently live across `src/core/*` and `src/docker/*`.

Recommended crate choices:

- `tokio` for async runtime, timers, locks, signal handling, and task execution.
- `axum` for HTTP routes. Its `State` extractor gives compile-time state typing and `Router::with_state` fits the current `AppContext` pattern.
- `serde` and `serde_json` for config and API payloads, with `#[serde(default)]`, `#[serde(rename_all)]` only where exact JSON names are preserved, and custom normalizers for legacy compatibility.
- `reqwest` for HTTP. Build requests with explicit `Cookie`, `User-Agent`, `Referer`, `Origin`, content type, timeout, and redirect policy; do not rely on automatic cookie storage for Douyu compatibility.
- `tokio-tungstenite`/`tungstenite` for danmu WebSocket packets and binary frames.
- `croner` plus `chrono`/`chrono-tz` for six-field cron parsing and Shanghai-local preview. `croner` supports seconds and timezone-aware next occurrence, which matches the current six-field contract better than a default five-field scheduler.
- `tracing` can be used internally, but preserve the existing WebUI log buffer shape and stdout text format.

### Phased migration plan

1. Freeze the contract before replacing runtime code.
   - Keep `v2.4.0` as rollback and document it in the PRD/release notes.
   - Add compatibility fixtures before writing Rust: config examples, route response snapshots, parser input/output fixtures, and request-construction assertions.
   - Treat `research/current-runtime-behavior.md` as the baseline and update the PRD with exact required parity.

2. Port pure data and normalization first.
   - Implement Rust `DockerConfig`, task config, fans/status/gift structs, `normalize_config`, `reconcile_config`, `compute_gift_count_*`, CookieCloud decrypt/selection, and parsers.
   - Acceptance gate: Rust tests load existing `config.example.json` and legacy-minimal configs, then compare normalized JSON to checked-in expected outputs.

3. Build the Rust HTTP server without Douyu side effects.
   - Serve the current WebUI routes and implement auth/session, config get/raw/masked, logs, overview, cron preview, and validation.
   - Keep task trigger and Douyu-dependent routes behind stubbed service traits until pure compatibility tests pass.
   - Acceptance gate: black-box HTTP tests assert status codes, JSON shapes, cookie attributes, masked/raw config behavior, and path-routed WebUI boot.

4. Port Douyu clients behind narrow traits.
   - Port request builders and parsers separately from network execution.
   - Use fixture tests for all parsers and request payloads, including headers and form fields.
   - Keep live Douyu calls out of CI. Add optional manual smoke scripts gated by env vars and sanitized logs.

5. Port scheduler/runtime last.
   - Implement one scheduler loop abstraction that owns next-run calculation, task handles, task locks, and status updates.
   - Start with manual triggers and only then enable scheduled jobs.
   - Acceptance gate: deterministic scheduler tests using fake clock or injected time prove overlap behavior, next-run strings, start/stop/restart decisions, and manual-vs-scheduled lock semantics.

6. Add Rust Docker image as experimental, then switch stable.
   - First publish an experimental tag such as `rust-edge` or `edge-rust` without moving `latest`.
   - Run side-by-side manual smoke testing with the same config bind mount copied to a test directory.
   - Only move `edge` to Rust after parity gates pass. Only move `latest` on a semver release tag after at least one `edge` cycle.

7. Remove Node only after Rust has owned `edge` long enough.
   - Keep Node source or a rollback branch/tag until the Rust release has real user runtime coverage.
   - When removing Node scripts, update Trellis specs and CI in the same task so future agents do not keep running stale `npm` gates.

### Acceptance tests to require before replacement

- Config compatibility:
  - load empty/missing config, current `config.example.json`, `cookie`-only legacy config, missing optional tasks, old `percentage` fields, invalid active flags, and malformed task payloads.
  - assert normalized JSON preserves current defaults and compatibility fields.
- HTTP API compatibility:
  - unauthenticated protected API returns `401 { "error": "请先登录" }`.
  - login missing/wrong password returns 400 with current Chinese messages.
  - `dykw_session` cookie properties match the current behavior closely.
  - `/api/config` masks `cookie`, `manualCookies.*`, and `cookieCloud.password`; `/api/config/raw` returns raw config after auth.
  - all current API paths return the same top-level JSON shape as the Node runtime.
- Cron compatibility:
  - six-field cron strings parse.
  - invalid cron strings return route validation errors.
  - next-run preview returns ISO strings and scheduler/log display remains Shanghai-local.
- Runtime compatibility:
  - task status shape stays `{ running, lastRun, nextRun }`.
  - scheduled overlap logs and skips; manual overlap returns a 400-compatible error path.
  - start/stop/restart decisions match current JSON-config comparison semantics.
- Douyu request compatibility:
  - main-site requests include `Cookie`, browser-like `User-Agent`, `Referer`, and `Origin`.
  - gift send form contains `rid`, `prop_id`, `num`, `sid`, `did`, and `dy`.
  - backpack endpoint order remains default rooms first, v5 then v1, then deduped fan room candidates.
  - danmu packets preserve current escaping, little-endian packet lengths, login/h5ck request fields, timeout behavior, and success condition.
  - Yuba dy-token and fallback request paths preserve current field names and stop/retry rules.
- Docker/CI compatibility:
  - image starts on port `51417`, reads `/app/config/config.json`, honors `CONFIG_PATH`, `WEB_PORT`, `WEB_PASSWORD`, and `TZ=Asia/Shanghai`.
  - linux/amd64 and linux/arm64 release builds succeed.
  - idle RSS and compressed/uncompressed image size are measured for Node `v2.4.0`, Rust experimental tag, and final Rust release.

### CI and Docker changes

- Add Rust checks in parallel with the existing Node checks at first:
  - `cargo fmt --check`
  - `cargo clippy --workspace --all-targets -- -D warnings`
  - `cargo test --workspace --locked`
  - `cargo build --workspace --release --locked`
- Keep current `npm run lint`, `npm run type-check`, and `npm run build:docker` while Node remains the production runtime.
- Introduce a Rust Dockerfile or a Rust target in the existing Dockerfile only after the Rust binary can serve non-Douyu routes.
- Use Docker multi-stage builds so the final image only carries the compiled binary, CA certificates, timezone data if needed, and `/app/config`.
- Preserve current tag rules. Experimental Rust should not publish `latest`. Stable Rust should use the same release-tag mechanism after the default branch has already proven `edge`.
- Keep native arm64 release jobs. The current workflow already uses `ubuntu-24.04-arm`; preserving that avoids slow QEMU-backed Rust builds.
- Use Buildx cache scopes for Rust separately from the current Node scopes, for example `docker-rust-amd64`, `docker-rust-arm64`, and optionally a Cargo registry cache in non-Docker Rust validation jobs.

### Rollback strategy

- Operational rollback should be a Docker tag change, not a config migration rollback.
- Keep the config file backward-compatible and avoid one-way writes until the Rust runtime has shipped successfully.
- If Rust needs extra internal fields, make them optional and ignored by Node `v2.4.0` where practical; otherwise write them under a clearly optional namespace and verify Node still tolerates them before release.
- Document:
  - `DOCKER_TAG=v2.4.0 docker compose up -d`
  - how to copy `./config` before testing Rust
  - how to restore the copied config
  - how to compare logs and WebUI status after rollback
- Do not publish `latest` from the first Rust image. Use `edge-rust` or `rust-edge` for the first user-testable artifact, then `edge`, then release tag plus `latest`.

### Risk controls for unofficial external APIs

- Treat Douyu and Yuba network behavior as unstable external contracts. The Rust rewrite should not "clean up" URLs, header values, cookie selection, request timing, parser leniency, or business-error interpretation unless a test and PRD decision say so.
- Put request construction in pure functions returning method, URL, headers, and body. Test those without network access.
- Put parser behavior in pure functions with sanitized fixtures. Include fixtures for malformed HTML/JSON and upstream business errors, not only happy paths.
- Centralize endpoint constants and cookie key requirements so agents cannot accidentally fork behavior across modules.
- Keep live smoke tests optional and credential-gated. They must redact cookies and tokens and should never run in public CI.
- Add a "protocol drift" manual checklist for releases: fan list, backpack, gift send dry/manual small send, collect-gift WebSocket, double-card status, Yuba status, Yuba sign-in.
- Keep transport-level differences visible. Rust `reqwest` will not perfectly match Node/axios TLS and HTTP behavior. If Douyu begins checking TLS/browser fingerprints, headers alone may be insufficient; that should be treated as an external compatibility incident, not hidden behind retries.

### Structure for AI coding agents

- Give agents one compatibility slice at a time. Good first slices: config structs + normalization tests, gift allocation tests, CookieCloud decrypt fixtures, Axum auth routes, cron preview tests.
- Require every implementation slice to update or add fixtures before porting the behavior.
- Prefer ports from a single source file to a Rust module with matching tests, then integrate. Avoid asking an agent to "rewrite the app in Rust" in one pass.
- Keep PRD acceptance criteria executable: each criterion should name a command or fixture assertion.
- For generated Rust, enforce small modules and explicit trait boundaries:
  - `Clock` for testable time.
  - `DouyuClient` for live HTTP/WebSocket calls.
  - `ConfigStore` for file IO.
  - `Scheduler` for task lifecycle.
  - `LogSink` for WebUI log buffer.
- Use golden JSON snapshots sparingly for external route/config contracts, and normal unit assertions for pure functions where exact output is easier to read.
- Update Trellis specs after the Rust runtime becomes production, because the current specs still describe TypeScript build commands and `src/core`/`src/docker` paths.

### External references

- Docker Rust image guide recommends a Rust build stage and a minimal runtime stage that copies only the compiled binary; this aligns with the goal of reducing final image size. Reference: https://docs.docker.com/guides/rust/build-images/
- Docker multi-stage build docs describe using multiple `FROM` stages and copying only build artifacts into the final image, leaving build tools out of the runtime image. Reference: https://docs.docker.com/build/building/multi-stage/
- Docker Buildx GitHub Actions cache docs describe the `gha` backend and note it is the recommended cache inside GitHub Actions within usage limits. Reference: https://docs.docker.com/build/cache/backends/gha/
- Docker multi-platform docs cover multi-platform image strategies and note native/cross-compilation options; current workflow's native arm64 release runner is consistent with avoiding QEMU for normal builds. Reference: https://docs.docker.com/build/building/multi-platform/
- GitHub-hosted runner docs list public arm64 Linux runners such as `ubuntu-24.04-arm`, matching the current release workflow. Reference: https://docs.github.com/en/actions/reference/github-hosted-runners-reference
- Docker Build Push Action v6 supports `push`, `tags`, `cache-from`, `cache-to`, `provenance`, and `sbom` inputs, matching the current workflow pattern. Reference: https://github.com/docker/build-push-action
- Axum `Router` and `State` docs support typed app state and route composition suitable for replacing Express plus `AppContext`. References: https://docs.rs/axum/latest/axum/struct.Router.html and https://docs.rs/axum/latest/axum/extract/struct.State.html
- Reqwest docs show explicit client builder controls for default headers, timeouts, redirect policy, cookies, and proxy behavior. This supports request-builder parity tests and warns against accidental cookie-store behavior. Reference: https://docs.rs/reqwest/latest/reqwest/struct.ClientBuilder.html
- Tokio Tungstenite docs expose async WebSocket connection APIs and configurable TLS connection paths for the danmu WebSocket port. Reference: https://docs.rs/tokio-tungstenite/latest/tokio_tungstenite/
- Croner docs state support for timezone-aware scheduling and seconds-level granularity; use `Seconds::Required` to preserve current six-field cron semantics. References: https://docs.rs/croner/latest/croner/ and https://docs.rs/croner/latest/croner/struct.Cron.html
- Cargo docs define `cargo test` as compiling and executing unit, integration, and documentation tests; this should replace the current `npm test` build-only behavior once Rust is production. Reference: https://doc.rust-lang.org/cargo/commands/cargo-test.html
- Clippy docs describe `cargo clippy` as a Cargo subcommand for lints; use it as a CI gate after Rust code exists. Reference: https://doc.rust-lang.org/stable/clippy/usage.html

### Related specs

- `.trellis/spec/backend/directory-structure.md` - current Docker-only runtime boundary and shared-core separation.
- `.trellis/spec/backend/database-guidelines.md` - whole-file JSON config persistence and backward-compatible loading.
- `.trellis/spec/backend/error-handling.md` - direct error handling, `{ error }` JSON routes, and preserving upstream failure semantics.
- `.trellis/spec/backend/logging-guidelines.md` - log buffer shape, categories, timestamp timezone, and no full cookies.
- `.trellis/spec/backend/quality-guidelines.md` - shared logic reuse, thin entrypoints, boundary validation, no secret logging, and failure semantics.
- `.trellis/spec/frontend/index.md` - current UI is the Docker WebUI served from `src/docker/html.ts`, not Vue/Electron.
- `.trellis/spec/guides/cross-layer-thinking-guide.md` - required for config/API/UI/runtime contract mapping.
- `.trellis/spec/guides/code-reuse-thinking-guide.md` - required because this rewrite is high-risk for duplicated parsing and config logic.
- `.trellis/spec/guides/docker-medal-sync-contract.md` - authoritative contract for CookieCloud, medal sync, task config, yuba status, backpack, and WebUI boundaries.
- `.trellis/spec/guides/docker-webui-auth-contract.md` - authoritative contract for auth/session routes and Docker image build wiring.

## Caveats / Not Found

- No Rust code exists yet in the repository, so crate names and module layout above are recommendations, not observed files.
- No backend unit test suite currently exists; `npm test` is only `npm run build:docker`. The Rust rewrite must add real tests rather than translating the current weak test gate.
- No official Douyu/Yuba API documentation was found in the project. Current behavior is inferred from code and must be preserved with fixtures and optional live smoke tests.
- Exact TLS fingerprint parity with Node/axios was not verified. Rust `reqwest` may behave differently at TLS/HTTP transport level even when headers and payloads match.
- `croner` appears better aligned with the six-field/timezone requirement than a generic scheduler, but final crate choice should be validated with tests for every existing cron string before implementation commits to it.
- The current specs still name TypeScript paths and npm commands. Do not update those specs from the research agent; update them later with the `update-spec` skill after the Rust runtime becomes the production implementation.
