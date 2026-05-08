# Go Rewrite Technical Plan

## Summary

Rewrite the Docker/WebUI runtime from Node/TypeScript to Go while preserving the existing user-facing contract: Docker deployment shape, config file compatibility, WebUI/API behavior, scheduler semantics, Douyu HTTP/WebSocket flows, CookieCloud support, and rollback to `v2.4.0`.

Recommended path: build a Go runtime in parallel, freeze Node behavior as compatibility tests/fixtures, ship a preview Docker tag, then promote after measured resource and behavior checks pass.

## Why Go

Go is the best fit for this project because the runtime is a single Docker service with HTTP routes, cron scheduling, JSON config, outbound HTTP calls, a WebSocket client, and a static WebUI document. It should reduce idle RSS and image size without the added migration cost of Rust.

Expected target range after implementation:

```text
Idle RSS:      8-20 MiB typical target, measured after implementation
Image size:    10-60 MB depending on runtime image and CA/timezone packaging
Current Node:  about 30.55 MiB idle RSS, docker images showed about 303 MB locally
```

These are targets, not guarantees. The implementation must measure the actual result.

## Runtime Contract To Preserve

Deployment:

* Service name and image can stay as `tophtab/douyu-keep-just-works`.
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
* Avoid writing Go-only config changes during preview unless old Node `v2.4.0` can ignore them safely.

WebUI/API:

* Serve the existing WebUI first. Move the large HTML document to a Go embedded file or string without redesigning it.
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

* Preserve fixed `User-Agent`, `Cookie`, `Referer`, and `Origin` values as closely as Go allows.
* Preserve request URLs, form body encoding, response business-error parsing, and fallback endpoint order.
* Preserve danmu WebSocket packet encoding, login/h5ck flow, timeout behavior, and handshake headers.
* Preserve CookieCloud legacy OpenSSL-compatible AES-256-CBC decrypt and cookie selection semantics.
* Do not reintroduce Chromium/Playwright by default.

## Recommended Go Stack

Use standard library first:

```text
net/http
encoding/json
net/url
crypto/aes
crypto/cipher
crypto/md5
crypto/rand
context
time
time/tzdata or -tags timetzdata
log/slog
os/signal
sync
embed
```

Third-party dependencies:

```text
github.com/robfig/cron/v3
github.com/coder/websocket
```

Notes:

* Configure cron with seconds and Shanghai location: `cron.New(cron.WithSeconds(), cron.WithLocation(shanghai))`.
* Use `github.com/coder/websocket` first; keep `github.com/gorilla/websocket` as fallback if Douyu handshake behavior differs.
* Use `net/http` for local server and outbound Douyu/Yuba calls. Do not add Gin/Fiber/Echo unless standard routing becomes painful.
* Include CA roots and timezone support in Docker. Prefer a distroless static image over pure `scratch` unless the Dockerfile explicitly copies CA certificates and embeds timezone data.

## Proposed Go Package Layout

```text
cmd/douyu-keep/
  main.go

internal/app/
  app.go              # process wiring, config apply, scheduler lifecycle
  status.go           # task status and active-run locks

internal/config/
  types.go            # persisted schema compatible with current DockerConfig
  normalize.go        # defaults, legacy migration, fan reconciliation
  store.go            # whole-file JSON load/write

internal/httpapi/
  server.go           # net/http route registration, auth middleware
  auth.go             # in-memory sessions and cookies
  masks.go            # config masking
  validation.go       # route input validation

internal/webui/
  html.go or embed.go # existing WebUI document

internal/scheduler/
  cron.go             # validation, preview, six-field parser
  jobs.go             # job registration and selective reload helpers

internal/logbuf/
  logger.go           # bounded in-memory logs plus stdout mirror

internal/douyu/
  api.go              # headers, HTTP helpers, fan/backpack/send gift
  collect.go          # danmu WebSocket collect flow
  double_card.go
  gifts.go
  jobs.go             # collect/keepalive/double/expiring orchestration
  yuba.go
  cookiecloud.go
  types.go

internal/testutil/
  fixtures.go         # shared fixtures for compatibility tests
```

The exact names can change during implementation, but the boundary should stay clear: runtime wiring in `internal/app`/`internal/httpapi`, reusable Douyu logic in `internal/douyu`, and JSON config compatibility in `internal/config`.

## Migration Phases

### Phase 0 - Baseline and Branch

* Create a dedicated branch, for example `rewrite-go`.
* Keep `v2.4.0` as the rollback point.
* Record current measurements:
  * `docker images`
  * `docker image inspect`
  * `docker stats --no-stream`
  * startup logs
* Preserve a sample sanitized config fixture.

### Phase 1 - Compatibility Fixtures

Before porting behavior, create fixtures/tests describing the Node contract:

* Config normalization fixtures:
  * legacy top-level `cookie`
  * `manualCookies.main` and `manualCookies.yuba`
  * CookieCloud enabled/disabled
  * missing task fields
  * legacy `percentage`
  * allocation model `1` and `2`
  * `number = -1` remainder room
  * invalid cron
* HTTP route contract fixtures:
  * auth status/login/logout
  * protected API 401
  * masked `/api/config`
  * raw `/api/config/raw`
  * overview/status/logs
  * cron preview
  * manual trigger validation and busy errors
* Douyu request construction fixtures:
  * headers
  * form body encoding
  * cookie parsing
  * `dy`/`sid`/`did` extraction
  * Yuba dy-token
  * danmu packet bytes

### Phase 2 - Go Skeleton

* Add `go.mod`.
* Add `cmd/douyu-keep/main.go`.
* Implement config types, load/write, default config generation, and normalization.
* Implement log buffer.
* Implement HTTP auth and basic route skeleton.
* Serve WebUI and return current status/config/logs.
* Add tests for these boundaries.

### Phase 3 - Scheduler and API Compatibility

* Add `robfig/cron/v3` with seconds and Shanghai location.
* Implement cron validation and preview.
* Implement task status, active-run locks, selective reload, and CookieCloud sync scheduling.
* Implement fake/no-op task runners initially so route and scheduler behavior can be tested without Douyu calls.

### Phase 4 - Port Douyu Core

Port in this order:

1. Cookie parsing and shared HTTP helpers.
2. Fan list parsing.
3. Backpack/gift status parsing.
4. Gift allocation and send-gift request logic.
5. Double-card status.
6. Collect-gift danmu WebSocket.
7. CookieCloud decrypt and effective cookie selection.
8. Yuba status and sign-in flow.
9. Full task workflows.

Keep tests focused on deterministic parsing, request construction, and error mapping. Live Douyu checks should be smoke tests, not required unit tests.

### Phase 5 - Docker and CI

* Replace Dockerfile with a Go multi-stage build.
* Build static binary with `CGO_ENABLED=0`, `-trimpath`, and `-ldflags="-s -w"`.
* Use a minimal final image that includes CA roots and timezone support.
* Update Makefile scripts if needed.
* Update CI validation from npm lint/type-check/build to:
  * `go test ./...`
  * `go vet ./...`
  * Docker buildx build
* Keep release linux/amd64 and linux/arm64.

### Phase 6 - Preview Release and Measurement

* Publish a preview tag first, for example `go-preview`.
* Test with:
  * existing config file
  * fresh config directory
  * wrong password/auth flow
  * cookie save
  * task save
  * cron preview
  * logs
  * manual task trigger with real sanitized cookies when available
* Measure image size and idle RSS using the same method as the Node baseline.
* Document rollback:

```bash
DOCKER_TAG=v2.4.0 docker compose up -d
```

### Phase 7 - Promotion

Promote Go runtime to normal semver/latest only after:

* Compatibility tests pass.
* Docker amd64 and arm64 images build.
* Real smoke tests pass or known Douyu limitations are documented.
* Memory/image numbers are documented.
* Rollback path is verified.

## Test Plan

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

* Measure idle RSS after startup and after a short stable wait.
* Measure image size through `docker images` and `docker image inspect`.
* Confirm writable layer stays small with bind-mounted config.

## Risk Register

| Risk | Mitigation |
|---|---|
| Go HTTP/WebSocket behavior differs from Node enough to affect Douyu | Preserve headers and request bodies; add request-construction tests; run live smoke tests; keep websocket library fallback option |
| Cron parser accidentally treats six-field cron as five-field | Require `cron.WithSeconds()` and fixture every current default cron |
| Go JSON zero values change persisted config | Use pointer/omitempty carefully; test old/new config fixtures; avoid Go-only fields during preview |
| Auth/session route behavior changes | Route-level tests for status codes, cookies, and JSON bodies |
| Scheduler reload restarts too much or too little | Add tests around changed vs unchanged task config |
| Minimal Docker image misses CA roots or timezone | Prefer distroless static or explicitly copy/enable CA and tzdata; smoke HTTPS and Shanghai cron |
| Preview writes config incompatible with Node rollback | Keep schema compatible; back up config before first Go preview if needed |

## Next Session Starting Point

In a new session:

1. Load Trellis context.
2. Continue this task: `.trellis/tasks/05-08-go-rewrite-plan`.
3. Confirm the PRD and this plan are accepted.
4. Start the task when ready for implementation.
5. Implement Phase 1 first: compatibility fixtures and Go skeleton, not the full Douyu port in one pass.

Do not start by deleting the Node runtime. Keep the old implementation available until the Go runtime passes compatibility and smoke tests.

