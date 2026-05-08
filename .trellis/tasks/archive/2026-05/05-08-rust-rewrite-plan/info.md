# Rust Rewrite Technical Plan

## Summary

Rewrite the Docker/WebUI runtime from Node/TypeScript to Rust while preserving the existing user-facing contract: Docker deployment shape, config file compatibility, WebUI/API behavior, scheduler semantics, Douyu HTTP/WebSocket flows, CookieCloud support, and rollback to `v2.4.0`.

This replaces the withdrawn Go direction. The current task is Rust-only.

## Why Rust

Rust is now the chosen direction because the user prefers it for AI-assisted implementation and wants the lower runtime overhead and stronger compile-time checking. Rust has higher implementation cost than Go, so the plan must be compatibility-first and sliced into small, testable modules.

Expected target range after implementation:

```text
Idle RSS target:   5-15 MiB typical target, measured after implementation
Image size target: 5-40 MB depending on binary, TLS roots, and runtime image
Current Node:      about 30.55 MiB idle RSS, docker images showed about 303 MB locally
```

These are targets, not guarantees. The implementation must measure the actual result.

## Runtime Contract To Preserve

Deployment:

* Service/image can stay as `tophtab/douyu-keep-just-works`.
* Default port remains `51417`.
* Bind mount remains `./config:/app/config`.
* Default config path remains `/app/config/config.json` inside Docker or `config/config.json` when run locally.
* Environment variables remain `CONFIG_PATH`, `WEB_PORT`, `WEB_PASSWORD`, and `TZ`.
* Container must support linux/amd64 and linux/arm64.

Config:

* Preserve top-level `cookie` for legacy compatibility.
* Preserve `manualCookies`, `cookieCloud`, `ui`, `collectGift`, `keepalive`, `doubleCard`, `expiringGift`, and `yubaCheckIn`.
* Preserve existing default crons and six-field cron syntax with seconds.
* Preserve JSON pretty-write behavior and do not introduce a database.
* Avoid one-way config writes during preview. Rollback to Node `v2.4.0` must stay practical.

WebUI/API:

* Serve the existing WebUI first. Move the large HTML document to a Rust embedded/static asset without redesigning it.
* Preserve auth session cookie name `dykw_session`, 30-day max age, `HttpOnly`, `SameSite=Strict`, and `Path=/`.
* Preserve `{ error: string }` JSON errors and existing status codes where practical.
* Preserve `/api/config` masking and `/api/config/raw` raw secret behavior for authenticated sessions.
* Preserve protected API behavior: unauthenticated non-auth `/api/*` returns `401 { "error": "请先登录" }`.

Scheduler:

* Keep task types: `collectGift`, `keepalive`, `doubleCard`, `expiringGift`, `yubaCheckIn`.
* Keep status shape: `{ running, lastRun, nextRun }`.
* Keep selective reload behavior: only restart affected jobs.
* Keep scheduled overlap behavior: skip and log.
* Keep manual overlap behavior: return `任务正在执行中，请稍后再试`.
* Keep CookieCloud startup sync and scheduled sync behavior, including overlap skip.

Douyu/CookieCloud:

* Preserve fixed `User-Agent`, `Cookie`, `Referer`, and `Origin` values as closely as Rust allows.
* Preserve request URLs, form body encoding, response business-error parsing, and fallback endpoint order.
* Preserve danmu WebSocket packet encoding, login/h5ck flow, timeout behavior, and handshake headers.
* Preserve CookieCloud legacy OpenSSL-compatible AES-256-CBC decrypt and cookie selection semantics.
* Do not reintroduce Chromium/Playwright by default.

## Recommended Rust Stack

Use this stack unless implementation proves a concrete blocker:

```text
tokio
axum
serde
serde_json
reqwest with rustls
tokio-tungstenite
croner
chrono
chrono-tz
tracing
tracing-subscriber
```

Key decisions:

* `axum` for local WebUI/API routes. It maps well to the current `AppContext` pattern through typed shared state.
* `reqwest` for outbound HTTP. Disable default features and enable Rustls intentionally.
* `tokio-tungstenite` for Douyu danmu WebSocket.
* `croner` plus `chrono-tz` for six-field cron parsing and `Asia/Shanghai` next-run calculation.
* `tracing` may handle Rust diagnostics, but the WebUI log buffer remains app-owned and must preserve `{ timestamp, category, message }`.

Avoid:

* Actix/Rocket unless axum hits a real blocker.
* A database for config.
* A heavyweight job framework.
* A macro-heavy architecture that makes AI-assisted incremental changes harder.

## Proposed Rust Workspace Layout

```text
crates/
  dykw-core/
    src/config.rs          # persisted schema, normalization, reconciliation
    src/types.rs           # shared config/API/domain structs
    src/cookies.rs         # cookie parsing/selection
    src/gift.rs            # gift allocation
    src/parsers.rs         # deterministic parser helpers

  dykw-douyu/
    src/http.rs            # reqwest client, request builders
    src/api.rs             # fans/backpack/gift/double-card calls
    src/collect.rs         # danmu WebSocket packet protocol
    src/cookie_cloud.rs    # CookieCloud decrypt and diagnostics
    src/yuba.rs            # Yuba status/sign-in flows
    src/jobs.rs            # task workflows

  dykw-web/
    src/server.rs          # axum router
    src/auth.rs            # session cookies and middleware
    src/validation.rs      # route boundary validation
    src/masks.rs           # config masking
    src/webui.rs           # embedded HTML

  dykw-runtime/
    src/app.rs             # startup, env, shutdown
    src/store.rs           # config file IO
    src/scheduler.rs       # local scheduler loop
    src/status.rs          # task status and locks
    src/logbuf.rs          # bounded in-memory logs

  dykw-bin/
    src/main.rs            # thin binary entrypoint
```

The exact crate split can be simplified during implementation, but keep these boundaries: pure config/domain logic, Douyu network logic, WebUI/API, and runtime orchestration.

## Migration Phases

### Phase 0 - Baseline and Tooling Check

* Confirm Rust toolchain availability. Current research noted `cargo` is not installed in this workspace.
* Create or switch to a dedicated branch, for example `rewrite-rust`.
* Keep `v2.4.0` as the rollback point.
* Record current Node measurements:
  * `docker images`
  * `docker image inspect`
  * `docker stats --no-stream`
  * startup logs
* Preserve sanitized config fixtures.

### Phase 1 - Compatibility Fixtures

Before replacing behavior, create fixtures/tests describing the current Node contract:

* Config normalization:
  * legacy top-level `cookie`
  * `manualCookies.main` and `manualCookies.yuba`
  * CookieCloud enabled/disabled
  * missing task fields
  * legacy `percentage`
  * allocation model `1` and `2`
  * `number = -1` remainder room
  * invalid cron
* HTTP route contract:
  * auth status/login/logout
  * protected API 401
  * masked `/api/config`
  * raw `/api/config/raw`
  * overview/status/logs
  * cron preview
  * manual trigger validation and busy errors
* Douyu request construction:
  * headers
  * form body encoding
  * cookie parsing
  * `dy`/`sid`/`did` extraction
  * Yuba dy-token
  * danmu packet bytes

### Phase 2 - Rust Core Skeleton

* Add workspace and crates.
* Implement config structs and compatibility normalization.
* Implement cookie parsing and gift allocation.
* Implement log buffer.
* Add tests for pure logic first.

### Phase 3 - WebUI/API Without Live Douyu Calls

* Add axum server.
* Serve the existing WebUI.
* Implement auth/session.
* Implement config, logs, overview, status, and cron preview.
* Stub Douyu-dependent routes through traits until core contracts pass.

### Phase 4 - Scheduler Runtime

* Add croner/chrono-tz cron validation and next-run preview.
* Implement local Tokio scheduler loop instead of hiding behavior inside a job framework.
* Add task status, active-run locks, selective reload, and manual-vs-scheduled overlap behavior.
* Keep tasks stubbed until scheduler behavior is tested.

### Phase 5 - Port Douyu/CookieCloud/Yuba

Port in this order:

1. Shared request headers and HTTP helper.
2. Fan list parsing.
3. Backpack/gift status parsing.
4. Gift send request construction and business response validation.
5. Double-card status.
6. Danmu WebSocket collect-gift protocol.
7. CookieCloud decrypt and effective cookie selection.
8. Yuba status/sign-in flow.
9. Full task workflows.

Keep live Douyu calls out of normal CI. Add credential-gated smoke tests/scripts for release validation.

### Phase 6 - Docker and CI

* Add Rust Docker build.
* Use multi-stage build and a minimal runtime image.
* Ensure HTTPS CA roots and timezone handling are present.
* Preserve `/app/config`, `WEB_PORT`, `WEB_PASSWORD`, `CONFIG_PATH`, and `TZ`.
* Add Rust checks:
  * `cargo fmt --check`
  * `cargo clippy --workspace --all-targets -- -D warnings`
  * `cargo test --workspace --locked`
  * `cargo build --workspace --release --locked`
* Keep Node checks while Node remains production.
* Preserve linux/amd64 and linux/arm64 release builds.

### Phase 7 - Preview, Measure, Promote

* Publish a Rust preview tag first, such as `rust-edge` or `edge-rust`.
* Test with copied config directory, not the only production config.
* Measure:
  * image size
  * idle RSS
  * active memory after HTTP/TLS initialization
  * writable layer size
* Promote only after compatibility tests and live smoke checks pass.
* Rollback command remains:

```bash
DOCKER_TAG=v2.4.0 docker compose up -d
```

## Acceptance Test Plan

Unit/contract tests:

* Config load/normalize/write round trip.
* API auth cookie behavior.
* API route JSON envelopes.
* Config masking.
* Cron validation and next-run preview.
* Scheduler selective reload and overlap behavior.
* CookieCloud decrypt and cookie selection.
* Douyu response parsing and request construction.
* Danmu packet encoding/decoding.
* Gift allocation logic.

Manual/smoke tests:

* Container boots with empty config.
* WebUI login works.
* Existing config from Node version loads.
* Saving cookie does not log full cookie values.
* Saving task config starts only expected jobs.
* `/api/fans/status` handles backpack failure without breaking fan list.
* Manual triggers return useful errors when cookies are missing.
* Real Douyu flows are tested with sanitized private credentials before release.

Resource tests:

* Measure idle RSS after startup and after a stable wait.
* Measure image size through `docker images` and `docker image inspect`.
* Measure after one HTTP/TLS call because reqwest/Rustls initialization may change RSS.
* Confirm writable layer stays small with bind-mounted config.

## Risk Register

| Risk | Mitigation |
|---|---|
| Rust transport behavior differs from Node/axios enough to affect Douyu | Preserve headers/body; add request-construction tests; run live smoke tests; treat TLS fingerprint issues as external compatibility incidents |
| Cron behavior differs from Node `cron` | Use croner with required seconds and `Asia/Shanghai`; fixture every current default cron and common WebUI inputs |
| Serde zero/default behavior changes persisted config | Parse through `serde_json::Value`, normalize first, tolerate unknown fields, test old/new config fixtures |
| Async shared state causes races/deadlocks | Use explicit `Arc`, locks, cancellation tokens, and small state owners; test concurrent manual triggers |
| Minimal Docker image misses CA roots | Use Rustls/webpki roots or package CA certs intentionally; smoke HTTPS calls |
| Preview writes config incompatible with Node rollback | Avoid Go/Rust-only required fields; back up config before preview testing |
| Rewrite scope grows too large | Implement one compatibility slice at a time; do not remove Node until Rust preview passes |

## Agent-Safe Implementation Rules

* Do not ask an agent to "rewrite the app in Rust" in one pass.
* Each implementation slice must add or update fixtures before porting behavior.
* Keep modules small and map them to current source ownership.
* Use traits sparingly for boundary seams: clock, Douyu client, config store, scheduler, log sink.
* Keep user-facing Chinese error messages stable unless a PRD decision changes them.
* Do not update Trellis specs to Rust production commands until the Rust runtime actually becomes production.

## Next Session Starting Point

In a new session:

1. Load Trellis context.
2. Continue this task: `.trellis/tasks/05-08-rust-rewrite-plan`.
3. Confirm the PRD and this Rust plan are accepted.
4. Start the task when ready for implementation.
5. Implement Phase 0 and Phase 1 first: toolchain check plus compatibility fixtures, not the full runtime rewrite.

Do not start by deleting the Node runtime. Keep the old implementation available until the Rust runtime passes compatibility, Docker, resource, and smoke checks.

