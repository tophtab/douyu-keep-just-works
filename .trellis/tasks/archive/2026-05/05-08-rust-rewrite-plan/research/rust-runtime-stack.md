# Research: Rust runtime stack for Docker/WebUI rewrite

- Query: Rust technology choices for rewriting the Node/TypeScript Docker runtime while preserving HTTP API, scheduler, WebSocket, config, logging, Docker, TLS/timezone, and browser-like request behavior.
- Scope: mixed
- Date: 2026-05-08

## Findings

### Recommendation

Use a small Tokio stack:

- `tokio` for async runtime, timers, signal handling, and task orchestration.
- `axum` for the local WebUI/API server.
- `serde` + `serde_json` for config and route contracts.
- `reqwest` with explicit Rustls TLS features for Douyu/CookieCloud HTTP calls.
- `tokio-tungstenite` for the Danmu WebSocket gift-collection path.
- `croner` + `chrono-tz` with a thin in-house scheduler loop, or `tokio-cron-scheduler` only if its lifecycle/reload behavior is tested against this app's needs.
- `tracing` + `tracing-subscriber` for stdout diagnostics, plus an application-owned 500-entry in-memory log ring to preserve the existing WebUI contract.
- `rustls`/`webpki-roots` or reqwest's Rustls webpki feature for HTTPS trust in minimal images.

This is the lowest-risk Rust shape because it maps closely to the current Node runtime without pulling in a large web framework, database, template engine, job framework, or actor system.

### Files Found

- `src/docker/index.ts` - runtime entrypoint, config load/save, CookieCloud cache/sync, scheduler lifecycle, task locking, and task trigger wiring.
- `src/docker/server.ts` - Express WebUI/API server, session cookie auth, validation, masked config responses, cron preview, and trigger routes.
- `src/docker/cron.ts` - current cron validation and next-run preview using six-field cron with `Asia/Shanghai`.
- `src/docker/logger.ts` - stdout plus bounded 500-entry in-memory log buffer.
- `src/core/types.ts` - persisted Docker config and response data contracts.
- `src/core/medal-sync.ts` - config defaults, legacy migration, fan-medal reconciliation, task config normalization.
- `src/core/api.ts` - Douyu HTTP requests, browser-like headers, cookie parsing, backpack/fans HTML parsing, gift send form posts.
- `src/core/collect-gift.ts` - Douyu Danmu WebSocket protocol and gift collection handshake.
- `src/core/job.ts` - collect/keepalive/double-card/expiring-gift/yuba task behavior, delays, allocation calls, and logs.
- `src/core/yuba.ts` - Yuba HTTP APIs, dy-token construction, multipart signing, retries, paced sign-in loop.
- `src/core/cookie-cloud.ts` - CookieCloud legacy AES-CBC decryption, cookie flattening, cookie matching, diagnostics.
- `Dockerfile` - current Node 18 slim multi-stage Docker image, `TZ=Asia/Shanghai`, `/app/config`, port `51417`.
- `package.json` - current runtime dependencies: axios, cron, cron-parser, express, ws.
- `.trellis/spec/backend/logging-guidelines.md` - Docker logging and timezone contract.
- `.trellis/spec/guides/docker-medal-sync-contract.md` - executable cross-layer Docker/WebUI behavior contract.
- `.trellis/tasks/05-08-rust-rewrite-plan/prd.md` - rewrite goal, constraints, acceptance criteria, and rollback context.

### Code Patterns

- Runtime environment defaults are `CONFIG_PATH=config/config.json`, `WEB_PORT=51417`, `WEB_PASSWORD=password`, and `DOCKER_TIMEZONE='Asia/Shanghai'` in `src/docker/index.ts:21`.
- Current task types are `collectGift`, `keepalive`, `doubleCard`, `expiringGift`, and `yubaCheckIn` in `src/docker/index.ts:30`.
- Config load normalizes existing JSON and ensures collect-gift defaults in `src/docker/index.ts:265`.
- Config save creates the parent directory and pretty-prints JSON in `src/docker/index.ts:274`.
- Status and log timestamps are Shanghai-local, ISO-like strings without an offset in `src/docker/index.ts:294` and `src/docker/logger.ts:11`.
- Scheduler state is per task: stop clears job and resets status in `src/docker/index.ts:386`; start records `running`, `lastRun`, and `nextRun` in `src/docker/index.ts:420`.
- Scheduled tasks skip overlapping runs, while manual triggers should return an error on overlap via `runTaskWithLock` in `src/docker/index.ts:395`.
- Task reload is selective: changed task configs restart only affected jobs in `src/docker/index.ts:583`.
- CookieCloud sync is a separate scheduled job with default cron `0 5 0 * * *`, one-minute cache, and startup sync in `src/docker/index.ts:27` and `src/docker/index.ts:340`.
- Web auth is an in-memory 30-day random session cookie named `dykw_session` in `src/docker/server.ts:54`.
- WebUI page routes serve one generated HTML document before API auth middleware in `src/docker/server.ts:363`.
- API auth exempts page routes plus `/api/auth/status`, `/api/auth/login`, and `/api/auth/logout`; other `/api/*` calls return `401 { "error": "请先登录" }` in `src/docker/server.ts:393`.
- `/api/config` masks secrets, while `/api/config/raw` returns the full config in `src/docker/server.ts:417` and `src/docker/server.ts:433`.
- `/api/overview` returns timezone string `Asia/Shanghai`, readiness, task status, and last 10 logs in `src/docker/server.ts:441`.
- Cron validation currently accepts current Node `cron` semantics and previews three ISO UTC instants from an Asia/Shanghai schedule in `src/docker/cron.ts:11` and `src/docker/cron.ts:25`.
- Current default task crons are defined in `src/core/medal-sync.ts:4`.
- JSON config must preserve legacy `cookie`, migrate `manualCookies`, keep optional CookieCloud, UI, and task sections, and normalize missing/old fields in `src/core/medal-sync.ts:303`.
- Douyu HTTP calls use a stable browser-like User-Agent and explicit `Cookie`, `Referer`, and `Origin` headers in `src/core/api.ts:4` and `src/core/api.ts:9`.
- Backpack reads try several room-specific v5/v1 endpoints before failing in `src/core/api.ts:95` and `src/core/api.ts:189`.
- Gift sending is an `application/x-www-form-urlencoded` POST to `https://www.douyu.com/member/prop/send` in `src/core/api.ts:246`.
- Fans list parsing currently scrapes an HTML table and sorts by fan-medal level in `src/core/api.ts:279`.
- Danmu gift collection uses `wss://wsproxy.douyu.com:6672`, custom binary packet framing, WebSocket headers, 10s handshake timeout, and 15s overall timeout in `src/core/collect-gift.ts:6` and `src/core/collect-gift.ts:118`.
- Yuba dy-token is made by joining `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, and `acf_ltkid` from the main cookie in `src/core/yuba.ts:93`.
- Yuba status fetch uses bounded concurrency of 5 in `src/core/yuba.ts:287`.
- Yuba sign-in paces per group with random 5-8s sleeps and stops early on login/CSRF/Gee/token failures in `src/core/yuba.ts:507` and `src/core/yuba.ts:587`.
- CookieCloud legacy decrypt uses OpenSSL-compatible salted AES-256-CBC key derivation with MD5 in `src/core/cookie-cloud.ts:94` and `src/core/cookie-cloud.ts:114`.
- CookieCloud cookie selection respects domain, hostOnly, path, secure, expiry, specificity, and sorts names in `src/core/cookie-cloud.ts:242`.
- The current Docker runtime image is `node:18-slim`, installs production npm dependencies, exposes `51417`, and runs `node dist/docker/index.js` in `Dockerfile:1`.

### HTTP Server Choice

`axum` is the best fit. Its docs describe a macro-free router/handler model, extractors, predictable response/error handling, shared state via `State`, and Tower middleware compatibility. Current docs.rs observed version: `axum 0.8.9`.

Why this fits the repo:

- The route surface is JSON APIs plus one HTML response, not MVC.
- Shared state maps cleanly to an `Arc<AppState>` holding config, jobs, sessions, logs, and HTTP clients.
- Route handlers can preserve the existing `AppContext` boundary from `src/docker/server.ts:19`.
- Tower middleware can implement auth without a custom full framework.

Avoid Actix/Rocket unless implementation discovers a hard blocker. They add more framework-specific surface without solving a current problem.

### Scheduler Choice

The schedule contract is stricter than "run something daily":

- Six-field cron with seconds is required by default crons such as `0 10 3,5 * * *` in `src/core/medal-sync.ts:4`.
- `Asia/Shanghai` evaluation must remain explicit, not inherited from the container.
- API cron preview must return ISO instants compatible with current WebUI expectations from `src/docker/cron.ts:25`.
- Task reload must be selective and overlap behavior must differ between scheduled and manual runs.

Recommendation:

- Use `croner` for parsing and next-occurrence computation, with `Seconds::Required` and `chrono-tz::Asia::Shanghai`.
- Implement a tiny per-task scheduler loop using `tokio::spawn`, `tokio::time::sleep_until`, and a cancellation token/watch channel.
- Store the computed next UTC instant for API status, while formatting logs in Shanghai-local text.

Rationale:

- `croner` docs state it supports timezone-aware cron evaluation and granularity up to seconds. Current docs.rs observed version: `croner 3.0.1`.
- A local scheduler loop is easier for AI-assisted maintenance because it makes the app's reload, lock, cancellation, and status rules visible in this repo instead of hidden inside a job framework.

Alternative:

- `tokio-cron-scheduler` docs show six-field syntax and `JobBuilder` timezone support, but also state time is UTC by default and timezone-specific creation requires the `_tz`/builder path plus adding `chrono-tz`. Current docs.rs observed version: `tokio-cron-scheduler 0.15.1`.
- It can work, but it adds persistence features this app does not need and has sparse generated API docs coverage in the crate page. Use it only after a spike proves reload/cancel/next-run/status behavior is simpler than the local loop.

### HTTP Client and Browser-Like Headers

Use one configured `reqwest::Client` for HTTP calls:

- Disable default features and enable Rustls intentionally, rather than relying on whichever TLS backend another dependency activates.
- Set no global cookie store; this app builds explicit `Cookie` headers from manual or CookieCloud sources.
- Build request helpers mirroring `makeHeaders` from `src/core/api.ts:9`.
- Keep endpoint-specific `Referer`, `Origin`, `Content-Type`, `dy-client`, `dy-token`, `client`, `token`, and `X-CSRF-TOKEN` logic close to current modules.
- Preserve form encoding for gift send, yuba dy-token sign, fast sign, supplement, and multipart yuba legacy sign.

Current reqwest docs observed version: `reqwest 0.13.2`. The TLS docs say default TLS is enabled by `default-tls`, may change backend by configuration, and default features are additive; they recommend `default-features = false` when ensuring a specific backend. They also expose headers, multipart, redirect, retry, cookie, and TLS modules.

Implementation notes:

- For Douyu, do not use typed header abstractions if they make odd values harder; existing `Origin: *` in `src/core/api.ts:18` should be reproduced exactly unless tests prove it is unnecessary.
- Configure per-request timeout equivalents for sensitive flows, especially WebSocket connect/collect timeout and potentially Douyu HTTP calls that currently rely on axios defaults.
- Preserve current permissive parser behavior for fragile Douyu responses: response numbers may be numeric strings, HTML parsing is regex-based today, and business errors are encoded in JSON fields rather than HTTP status alone.

### WebSocket Client

Use `tokio-tungstenite` for `collectGiftViaDanmu`.

Docs.rs observed version: `tokio-tungstenite 0.29.0`. Its docs describe async WebSocket use, Tokio integration, `Stream`/`Sink` support, and a `Request` path that allows custom headers. The crate page also notes TLS is available through `native-tls` or Rustls feature flags.

Required compatibility details:

- Connect to `wss://wsproxy.douyu.com:6672`.
- Include `Cookie`, browser User-Agent, `Origin: https://www.douyu.com`, and room-specific `Referer`.
- Reimplement packet framing exactly: two little-endian lengths, message type `689`, UTF-8 payload, trailing NUL.
- Reimplement Douyu value escaping where `@` becomes `@A` and `/` becomes `@S`.
- Keep 10s handshake timeout and 15s collect timeout semantics.
- Treat login response without `roomgroup@=1` as cookie auth failure and include missing cookie-key diagnostics.

### JSON Config Compatibility

Use strongly typed Serde structs for the canonical current config, but parse through a compatibility layer:

- First parse into `serde_json::Value`.
- Apply migrations/defaults equivalent to `normalizeDockerConfig` and `reconcileDockerConfig`.
- Deserialize into canonical structs after migration.
- Write pretty JSON and keep field names/case compatible with the TypeScript config.
- Use `#[serde(default)]`, `skip_serializing_if`, custom deserializers for `model`, `active`, and number-like fields where the current code accepts loose input.
- Avoid `deny_unknown_fields` on persisted config structs; the Serde docs note `flatten` is incompatible with `deny_unknown_fields`, and unknown-field tolerance is useful for forward/backward migration.

Docs.rs observed version: `serde_json 1.0.149`. Its docs describe both untyped `serde_json::Value` and strongly typed deserialization, which matches the migration-first approach.

### Logging

Use `tracing` for Rust-side diagnostics, but preserve the app-owned log buffer contract:

- `LogEntry { timestamp, category, message }`
- bounded to 500 entries
- stdout line format equivalent to `[timestamp] [category] message`
- categories like `系统`, `领取`, `保活`, `双倍`, `临期`, `鱼吧`
- no full cookies or CookieCloud passwords
- Shanghai-local timestamp alignment with task status

`tracing-subscriber` docs expose `fmt`, `EnvFilter`, JSON formatting, and local-time feature flags. Current docs.rs observed page did not show a version number in search output, so verify during implementation.

### Docker, TLS, CA, and Timezone Packaging

Build target should start conservative:

- Multi-stage Docker build for `linux/amd64` and `linux/arm64`.
- Runtime image based on a small base that already includes CA certificates and tzdata, or explicitly copies/provides them.
- Keep `/app/config`, `CONFIG_PATH`, `WEB_PORT`, and exposed `51417`.
- Prefer Rustls over OpenSSL/native-tls to simplify cross-architecture builds and avoid Linux OpenSSL package coupling.

Runtime image options:

- `cgr.dev/chainguard/static` or equivalent distroless-style static runtime: attractive if the binary is fully static and the image includes CA certificates plus tzdata. Chainguard docs list `static` as intended for stand-alone static binaries and include `ca-certificates-bundle` and `tzdata`.
- Alpine runtime: easier debugging and familiar `apk add --no-cache ca-certificates tzdata`, but dynamically linked musl/glibc choices and package CVE surface need measurement.
- `scratch`: smallest, but only safe if the binary embeds/ships root trust and timezone data or the Dockerfile copies `/etc/ssl/certs` and zoneinfo correctly. This is higher rollout risk.

Important distinction:

- If using `chrono-tz`, the application can evaluate `Asia/Shanghai` schedules from embedded timezone data, so scheduler correctness should not depend on `/usr/share/zoneinfo`.
- The runtime may still need CA roots for HTTPS unless using webpki roots compiled into Rustls.
- Setting `TZ=Asia/Shanghai` can remain for operator expectations and any library/system formatting, but the application should use explicit `chrono-tz` conversions for logs/status.

Docker docs emphasize that containers making network requests need trusted CA certificates when HTTPS interception or custom roots are involved. Do not make a minimal image that silently loses operator-added CA support.

### Memory and Image Footprint Expectations

The PRD records current Node idle RSS at about 30.55 MiB after startup. A Rust implementation should beat that, but the exact outcome depends on:

- Tokio worker-thread count.
- reqwest/hyper/Rustls dependency graph.
- whether the binary is static or dynamic.
- allocator and panic/profile settings.
- in-memory HTML string, log buffer, sessions, and CookieCloud snapshot size.

Recommended measurement plan:

- Add a Docker target that reports image compressed/uncompressed size.
- Run the current Node image and Rust image with an empty/default config for 60s, then measure RSS/PSS with `docker stats` plus `/proc/<pid>/status`.
- Measure after enabling CookieCloud snapshot and after one manual status fetch to catch HTTP client/TLS initialization costs.
- Document both idle and active task memory, not only cold startup.

### AI-Assisted Maintainability

Rust's type system helps only if boundaries stay small and explicit:

- Keep modules parallel to today's ownership: `config`, `server`, `scheduler`, `logs`, `douyu_api`, `collect_gift_ws`, `cookie_cloud`, `jobs`, `gift`, `yuba`.
- Avoid macro-heavy routing or generic abstractions around every API.
- Keep request construction in named functions with tests that assert URL, method, headers, query/form/body, and parse behavior.
- Keep scheduler logic local and testable with a fake clock or injectable "now" where practical.
- Represent compatibility migrations as plain functions over `serde_json::Value` plus typed config structs, with fixture tests for old config files.
- Prefer explicit error enums/messages only where they preserve existing user-visible Chinese messages; do not over-model transient Douyu response variants that are currently parsed defensively.

## External References

- axum docs.rs, observed `0.8.9`: https://docs.rs/axum/latest/axum/
- reqwest TLS docs.rs, observed `0.13.2`: https://docs.rs/reqwest/latest/reqwest/tls/index.html
- reqwest crate docs.rs: https://docs.rs/reqwest/latest/reqwest/
- tokio-tungstenite docs.rs, observed `0.29.0`: https://docs.rs/tokio-tungstenite/latest/tokio_tungstenite/
- tokio-cron-scheduler docs.rs, observed `0.15.1`: https://docs.rs/crate/tokio-cron-scheduler/latest
- croner docs.rs, observed `3.0.1`: https://docs.rs/croner/latest/croner/
- croner `Cron` docs.rs: https://docs.rs/croner/latest/croner/struct.Cron.html
- serde_json docs.rs, observed `1.0.149`: https://docs.rs/serde_json/latest/serde_json/
- Serde field attributes: https://serde.rs/field-attrs.html
- Serde flatten attribute: https://serde.rs/attr-flatten.html
- tracing-subscriber docs.rs: https://docs.rs/tracing-subscriber/latest/
- chrono-tz docs.rs, observed `0.10.4`: https://docs.rs/crate/chrono-tz/latest
- webpki-roots docs.rs: https://docs.rs/crate/webpki-roots/latest
- Chainguard compiled-program container guidance: https://edu.chainguard.dev/chainguard/chainguard-images/about/images-compiled-programs/compiled-programs/
- Docker CA certificate guidance: https://docs.docker.com/engine/network/ca-certs/

## Related Specs

- `.trellis/spec/backend/index.md` - backend pre-development checklist and layer ownership.
- `.trellis/spec/backend/logging-guidelines.md` - Docker log shape, bounded buffer, redaction, and Shanghai timestamp contract.
- `.trellis/spec/guides/docker-medal-sync-contract.md` - persisted config, HTTP API, CookieCloud, scheduler, and task behavior contract.
- `.trellis/tasks/05-08-rust-rewrite-plan/prd.md` - task-specific rewrite acceptance criteria and constraints.

## Caveats / Not Found

- `cargo` is not installed in this workspace, so crate versions/features were checked through current web docs and must be re-verified with `cargo info`/`cargo metadata` when the Rust scaffold is created.
- The existing Node `cron` package and Rust `croner` may differ on edge syntax such as `?`, named months/weekdays, day-of-month/day-of-week interaction, or year fields. Add compatibility tests for all default crons and WebUI-entered examples before replacing validation.
- `Asia/Shanghai` has no current DST, but tests should still verify next-run output against the current Node implementation because the API returns UTC ISO strings while logs/status display Shanghai-local timestamps.
- Douyu may depend on TLS/HTTP fingerprint details not represented by headers alone. Current Node runtime works with axios/ws; Rustls/hyper may behave differently. Treat Douyu request integration as a live compatibility test area.
- The research did not measure actual Rust binary RSS or image size because no Rust implementation exists yet and Cargo is unavailable here.
- No evidence was found that browser automation is currently necessary; existing code is browserless HTTP/WebSocket and should remain so unless Douyu endpoints change.
