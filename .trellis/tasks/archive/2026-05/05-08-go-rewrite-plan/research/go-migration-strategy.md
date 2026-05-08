# Research: Go migration strategy

- Query: Strategy for rewriting the Docker/WebUI Node/TypeScript runtime to Go while preserving API/config compatibility, phased migration, acceptance tests, rollback, Docker tagging, CI, and risk controls for external HTTP/WebSocket APIs.
- Scope: mixed
- Date: 2026-05-08

## Findings

### Files found

- `.trellis/tasks/05-08-go-rewrite-plan/prd.md` - Current rewrite goal, known measurements, requirements, acceptance criteria, and rollback tag.
- `.trellis/workflow.md` - Trellis planning/execution rules and requirement to persist research/decisions.
- `.trellis/spec/backend/index.md` - Backend pre-development checklist and relevant guide index.
- `.trellis/spec/backend/directory-structure.md` - Runtime boundary between Docker wiring and shared Douyu logic.
- `.trellis/spec/backend/database-guidelines.md` - JSON config persistence and no-migration-framework convention.
- `.trellis/spec/backend/error-handling.md` - JSON error response and Douyu business-error handling conventions.
- `.trellis/spec/backend/logging-guidelines.md` - In-memory/stdout logging shape, timestamp contract, and secret handling.
- `.trellis/spec/guides/docker-webui-auth-contract.md` - Docker WebUI auth, config route, runtime env, Docker build, and protected API contract.
- `.trellis/spec/guides/docker-medal-sync-contract.md` - Persisted config schema, task activation, CookieCloud, yuba, medal reconciliation, and scheduler contracts.
- `src/docker/index.ts` - Node runtime entrypoint, config IO, scheduler orchestration, CookieCloud sync, manual triggers, and shutdown.
- `src/docker/server.ts` - Express WebUI routes, auth/session behavior, validation, JSON response shapes, and API boundary.
- `src/docker/html.ts` - Single-file WebUI and client-side assumptions about routes/default config.
- `src/docker/cron.ts` - Current cron validation/preview wrapper using Shanghai timezone.
- `src/docker/logger.ts` - In-memory log buffer and stdout logging.
- `src/core/types.ts` - Persisted config and response type surface that the Go implementation must mirror.
- `src/core/medal-sync.ts` - Config defaulting, legacy field normalization, and fan-medal reconciliation.
- `src/core/api.ts` - Douyu HTTP request headers, backpack/fans/gift parsing, cookie helpers, and business-error validation.
- `src/core/collect-gift.ts` - Douyu danmu WebSocket collect-gift protocol.
- `src/core/job.ts` - Task workflows and per-room failure behavior.
- `src/core/cookie-cloud.ts` - CookieCloud fetch/decrypt/diagnostics and effective cookie construction.
- `src/core/yuba.ts` - Yuba HTTP list/head/sign logic and dy-token behavior.
- `Dockerfile` - Current Node builder/runtime image contract.
- `docker-compose.yml` - Current deployment shape: image/tag env vars, port, config bind mount, timezone/password env.
- `.github/workflows/docker.yml` - Validation, Docker Hub tagging, amd64 edge builds, multi-arch release build-by-digest, and manifest assembly.
- `Makefile` - Local build/check/up/down commands and default `local` image tag.
- `package.json` - Current version and quality scripts.

### Code patterns

- Current deployment contract is a single Docker WebUI runtime. The Docker entrypoint reads `CONFIG_PATH`, `WEB_PORT`, and `WEB_PASSWORD`, defaults to `config/config.json`, `51417`, and `password`, and binds the server on `0.0.0.0` (`src/docker/index.ts:20`, `src/docker/index.ts:21`, `src/docker/index.ts:22`, `src/docker/index.ts:991`).
- Config persistence is whole-file JSON. `loadConfigFromDisk()` reads and normalizes the file, and `saveConfigToDisk()` creates the parent directory and writes pretty JSON (`src/docker/index.ts:265`, `src/docker/index.ts:274`).
- Legacy compatibility depends on normalization, not explicit migration files. `normalizeDockerConfig()` maps old `cookie` into `manualCookies`, fills defaults, and keeps optional task payloads compatible (`src/core/medal-sync.ts:303`).
- The persisted schema includes legacy `cookie`, `manualCookies`, `cookieCloud`, `ui`, `collectGift`, `keepalive`, `doubleCard`, `expiringGift`, and `yubaCheckIn`; these keys should remain stable for the Go release (`src/core/types.ts:185`).
- WebUI auth is in-memory session-token based. Login sets `dykw_session`, status returns `{ authenticated }`, logout clears the cookie, and all non-auth `/api/*` routes return `401 { "error": "请先登录" }` when unauthenticated (`src/docker/server.ts:371`, `src/docker/server.ts:375`, `src/docker/server.ts:388`, `src/docker/server.ts:409`).
- `/api/config` masks cookies/passwords for UI reads, while `/api/config/raw` exposes raw config to the WebUI after authentication (`src/docker/server.ts:417`, `src/docker/server.ts:433`). Go should preserve both shapes unless the WebUI is changed in the same release.
- Mutating task/config routes return `{ ok: true, data: result }` on success and simple `{ error: message }` on failure (`src/docker/server.ts:474`, `src/docker/server.ts:521`, `src/docker/server.ts:533`).
- The protected JSON API surface includes config, overview, cookie save, fans reconciliation, status, cron preview, logs, fans list/status, yuba status, cookie-source check/effective/persist, and manual task triggers (`src/docker/server.ts:417`, `src/docker/server.ts:441`, `src/docker/server.ts:460`, `src/docker/server.ts:540`, `src/docker/server.ts:553`, `src/docker/server.ts:557`, `src/docker/server.ts:566`, `src/docker/server.ts:575`, `src/docker/server.ts:588`, `src/docker/server.ts:601`, `src/docker/server.ts:614`, `src/docker/server.ts:627`, `src/docker/server.ts:640`, `src/docker/server.ts:657`).
- Scheduler behavior is selective reload. Config changes start, restart, or stop only affected task cron jobs instead of resetting everything (`src/docker/index.ts:589`, `src/docker/index.ts:638`, `src/docker/index.ts:692`).
- Current cron expressions include seconds, e.g. `0 10 3,5 * * *`. A Go cron library must be configured for required seconds, not the default five-field cron format (`src/core/medal-sync.ts:4`, `src/docker/cron.ts:17`).
- Task concurrency uses per-task locks. Scheduled overlap skips with a log line, while manual triggers return an error (`src/docker/index.ts:397`, `src/docker/index.ts:423`, `src/docker/index.ts:876`).
- Douyu HTTP calls depend on browser-like headers. `makeHeaders()` sets `Cookie`, a fixed desktop `User-Agent`, `Referer`, and `Origin` (`src/core/api.ts:6`, `src/core/api.ts:10`).
- Douyu business success is not equivalent to HTTP 200. The code validates response body `error`, `code`, and `status_code` before reporting success (`src/core/api.ts:64`).
- Backpack status has fallback endpoints across API versions and room IDs; the Go port should preserve endpoint order and error semantics (`src/core/api.ts:84`, `src/core/api.ts:165`).
- Collect-gift uses Douyu danmu WebSocket, sends a binary `loginreq`, then waits for `h5ckres`; headers include Cookie, User-Agent, Origin, and room Referer (`src/core/collect-gift.ts:37`, `src/core/collect-gift.ts:62`, `src/core/collect-gift.ts:118`, `src/core/collect-gift.ts:130`, `src/core/collect-gift.ts:161`).
- The current Dockerfile is Node-specific and compiles TypeScript inside the image, then starts `node dist/docker/index.js` (`Dockerfile:1`, `Dockerfile:9`, `Dockerfile:14`, `Dockerfile:28`). A Go rewrite should replace this with a Go builder stage and a minimal runtime image while keeping `/app/config` and port behavior.
- Compose already allows rollback/experimentation by overriding `DOCKER_IMAGE` and `DOCKER_TAG` (`docker-compose.yml:3`). The first Go release can use this without changing the user deployment shape.
- CI already separates validation from Docker publish. It tags release pushes as `<version>` and `latest`, branch pushes as `edge`, builds non-tag amd64 through `docker/build-push-action@v6`, and builds release `linux/amd64` plus `linux/arm64` by digest before creating a multi-arch manifest (`.github/workflows/docker.yml:30`, `.github/workflows/docker.yml:69`, `.github/workflows/docker.yml:83`, `.github/workflows/docker.yml:114`, `.github/workflows/docker.yml:176`).
- Local Docker commands use Buildx with `IMAGE`, `TAG`, `PLATFORM`, and `DOCKERFILE` variables, so Go image validation can reuse `make docker-build TAG=go-local` and `make docker-up TAG=go-local` once the Dockerfile changes (`Makefile:1`, `Makefile:12`, `Makefile:15`).

### Recommended migration strategy

Use a strangler migration with compatibility fixtures rather than a single unchecked cutover.

1. Freeze the Node behavior as executable fixtures before writing Go:
   - Config normalization fixtures: old `cookie`-only config, manual main/yuba cookies, CookieCloud enabled/disabled, missing task fields, legacy `percentage`, `model = 2` with `-1` remainder, `ui.themeMode`, and invalid cron.
   - HTTP contract fixtures: request/response/status/header checks for every route listed above, especially auth cookie attributes, masked `/api/config`, raw config, protected `401`, trigger errors, cron preview, and logs.
   - Douyu request construction fixtures: headers, form bodies, query URLs, cookie parsing, dy/sid/did extraction, yuba dy-token construction, and WebSocket packet bytes.
2. Port in this order:
   - Go types and config normalization/reconciliation.
   - HTTP server/auth/API contract using `net/http` or a tiny router.
   - Logger and scheduler shell with fake task implementations.
   - Douyu HTTP parsing/request code.
   - Collect-gift WebSocket.
   - CookieCloud and yuba flows.
   - Dockerfile/CI/tag docs.
3. Keep the WebUI HTML unchanged initially if practical. Serving the existing single HTML string/static asset from Go reduces frontend risk and makes the HTTP API contract the main compatibility boundary.
4. Run Node and Go against the same fixture suite during migration until the Go runtime is a drop-in replacement. The primary quality gate should be route-level golden tests plus config round-trip tests, not only unit tests around helper functions.
5. Ship the first Go image as an experimental tag before moving `latest`:
   - Publish `go-preview` or `go-<semver>` from the same repo image name.
   - Keep `v2.4.0` and the existing Node image tag documented as rollback.
   - After compatibility and resource measurements pass, promote the Go release to normal semver and `latest`.

### Acceptance tests to add

- `config_compat`: load fixture JSON, normalize, save, reload, and compare stable JSON for every old/new config shape.
- `api_auth_contract`: unauthenticated protected routes return `401 { "error": "请先登录" }`; login sets `dykw_session` with `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Max-Age=2592000`; logout clears it.
- `api_config_masking`: `/api/config` masks all cookie/password fields and preserves non-secret fields; `/api/config/raw` returns raw data only after auth.
- `api_route_contract`: every existing route returns the same status codes and JSON envelopes for success, validation error, missing cookie, busy trigger, unknown trigger, and runtime failure.
- `cron_contract`: validate current six-field cron defaults and preview the next runs in `Asia/Shanghai`; reject malformed cron with Chinese error text.
- `scheduler_contract`: saving unrelated UI config does not restart tasks; changed task config restarts only that task; empty cookie source stops or prevents tasks.
- `douyu_http_contract`: generated requests match method, URL, headers, query/body encoding, and business-error interpretation.
- `douyu_ws_contract`: collect-gift WebSocket sends the same login/h5ck packet flow and errors on missing auth response or timeout.
- `docker_contract`: build `linux/amd64` and `linux/arm64`; container starts on `51417`; `/app/config/config.json` persists through bind mount; `WEB_PORT`, `WEB_PASSWORD`, `CONFIG_PATH`, and `TZ` behave as before.
- `resource_contract`: document image size and idle RSS for Node `v2.4.0` and Go preview using the same host, compose file, config, and measurement commands.

### Rollback and tagging

- Preserve `tophtab/douyu-keep-just-works:v2.4.0` as the known Node rollback tag from the PRD.
- Use Compose override rollback:
  - Preview: `DOCKER_TAG=go-preview docker compose up -d`
  - Rollback: `DOCKER_TAG=v2.4.0 docker compose up -d`
- Do not mutate the persisted config into a Go-only shape during preview. If Go writes a new optional field, Node `v2.4.0` should ignore it or the preview should create a backup before first write.
- Release promotion should be two-step: first publish a preview/edge Go image, then retag semver/latest only after acceptance tests and manual smoke checks pass.
- CI can retain the existing release manifest pattern, but the Dockerfile and validation job should switch from `npm` scripts to `go test`, `go vet`, `go test -race` where feasible, and `docker buildx build`.

### External references

- Go `net/http` is sufficient for the local WebUI. Its server API supports graceful shutdown, but WebSockets must be closed separately during shutdown; see `http.Server.Shutdown` docs: https://pkg.go.dev/net/http#Server.Shutdown
- Go `net/http/httptest` provides route-level HTTP testing utilities suitable for the compatibility suite: https://pkg.go.dev/net/http/httptest
- `github.com/robfig/cron/v3` supports cron job runners, explicit time zones, and a required-seconds parser via `cron.WithSeconds()`, which matches this repo's six-field cron defaults: https://pkg.go.dev/github.com/robfig/cron/v3
- `github.com/coder/websocket` and `github.com/gorilla/websocket` are both viable WebSocket clients. `coder/websocket` is a smaller modern option; `gorilla/websocket` is stable and widely imported. Either choice needs explicit deadline/timeout handling and one-reader/one-writer discipline.
- Docker's current GitHub Actions documentation shows `docker/build-push-action@v7`, `setup-buildx-action@v4`, and `login-action@v4` examples for multi-platform images, while this repo currently uses v6/v3/v3. See Docker multi-platform docs: https://docs.docker.com/build/ci/github-actions/multi-platform/ and build-push-action release page: https://github.com/docker/build-push-action

### Related specs

- `.trellis/spec/backend/directory-structure.md` - Preserve Docker/runtime boundary; in Go this likely becomes packages such as `internal/core` and `internal/docker` rather than mixing route handlers with Douyu business logic.
- `.trellis/spec/backend/database-guidelines.md` - Keep single JSON config file, optional fields, startup normalization, and whole-blob writes.
- `.trellis/spec/backend/error-handling.md` - Preserve plain user-facing Chinese error messages and route-level `{ error }` JSON envelopes.
- `.trellis/spec/backend/logging-guidelines.md` - Preserve `{ timestamp, category, message }`, cap log buffer, keep Shanghai-local timestamp semantics, and never log full cookies.
- `.trellis/spec/guides/docker-webui-auth-contract.md` - Treat auth cookie, protected route boundary, env vars, and masked config shape as executable contract.
- `.trellis/spec/guides/docker-medal-sync-contract.md` - Treat persisted config schema, defaults, task activation rules, and medal reconciliation as executable contract.
- `.trellis/spec/guides/docker-medal-sync-contract.md` and `.trellis/spec/backend/directory-structure.md` both forbid reintroducing browser automation as the default collect-gift path unless explicitly restored.

### Critical risks and controls

- Risk: Douyu endpoints are unofficial and may be sensitive to header/protocol changes. Control: create request-construction golden tests and record sanitized real-request smoke results separately from unit tests.
- Risk: Go cron defaults are five-field, while existing config uses six-field seconds. Control: require seconds parser and fixture all default cron strings before starting jobs.
- Risk: Go JSON `omitempty`, zero values, and map ordering can change persisted config. Control: compare semantic normalization and avoid deleting unknown fields unless intentionally unsupported.
- Risk: Go HTTP error/status defaults may diverge from Express. Control: route-level tests should assert exact status and JSON body for all UI-visible failures.
- Risk: In-memory session/log/task state needs synchronization in Go. Control: guard maps/log buffers/status with mutexes and test concurrent manual triggers.
- Risk: graceful shutdown differs. Current Node code exits immediately after stopping cron jobs (`src/docker/index.ts:997`); a Go server can do better, but WebSocket clients must be closed separately per Go docs.
- Risk: image-size wins can be obscured by base image choice. Control: measure both compressed/pulled size and `docker image inspect .Size`, and measure container RSS after the same idle period.

## Caveats / Not Found

- No Go code exists yet in this repo, so package layout and exact dependency choices are recommendations, not observed project patterns.
- The WebUI is currently embedded as a large TypeScript string in `src/docker/html.ts`; the research assumes it can be served unchanged or mechanically moved to a static asset, but implementation should verify build/licensing implications.
- External Douyu API schemas are not official public contracts. Acceptance tests can lock current behavior, but live smoke tests with sanitized cookies remain necessary before release.
- Docker's official examples now show newer action majors than this repo uses. Upgrading actions is optional for the rewrite, but should be decided explicitly because it changes CI surface area beyond the Go port.
