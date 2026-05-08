# Research: go runtime stack

- Query: Which Go runtime/dependency stack should be used for a minimal Docker/WebUI rewrite while preserving current behavior?
- Scope: mixed
- Date: 2026-05-08

## Findings

### Files found

- `package.json` - current dependency set is Express/axios/cron/cron-parser/ws and version is `2.4.0`.
- `Dockerfile` - current image is Node 18 slim with runtime `node_modules` and `/app/config`.
- `docker-compose.yml` - deployment contract is one service, port `51417`, bind-mounted config, Shanghai timezone, and password env.
- `.github/workflows/docker.yml` - current CI/release packaging expectations include lint/type-check/build and release linux/amd64 plus linux/arm64.
- `src/docker/index.ts` - current behavior that Go app must preserve: config IO, task lifecycle, scheduler, manual triggers, status, and graceful shutdown.
- `src/docker/server.ts` - API/auth shape that Go app must preserve.
- `src/docker/cron.ts` - six-field cron validation/preview with `Asia/Shanghai`.
- `src/docker/logger.ts` - in-memory log buffer contract.
- `src/core/api.ts` - Douyu HTTP request headers, payloads, and response parsing.
- `src/core/collect-gift.ts` - Douyu WebSocket packet protocol and handshake headers.
- `src/core/job.ts` - job semantics and throttling.
- `src/core/cookie-cloud.ts` - crypto/cookie-selection behavior.
- `src/core/yuba.ts` - Yuba dy-token, fallback, retry, and delay behavior.

### Recommended stack

- Use Go 1.26.x or 1.25.x as the toolchain baseline if implementing today. Official downloads list `go1.26.3` and `go1.25.10` as stable versions on 2026-05-08; `go1.26.3` is the featured stable release.
- Use standard library `net/http` for both the local WebUI/API server and outbound Douyu/Yuba HTTP calls. It supports HTTP clients/servers, per-request headers through `http.NewRequest`, reusable concurrent clients/transports, and `NewServeMux` for routing.
- Use standard library `encoding/json`, `net/url`, `crypto`, `time`, `context`, `os/signal`, and `log/slog` where possible. This avoids replacing Node dependencies with a large Go framework.
- Use `github.com/robfig/cron/v3` for cron scheduling and preview. It is stable (`v3.0.1`) and supports `WithSeconds()` plus `WithLocation(time.LoadLocation("Asia/Shanghai"))`, which matches the current six-field cron strings.
- Use `github.com/coder/websocket` for the Douyu danmu client. `nhooyr.io/websocket` is deprecated in favor of `github.com/coder/websocket`; `gorilla/websocket` is also stable and widely imported, but `coder/websocket` gives context-first dial/read/write APIs and is the maintained successor to nhooyr.
- Use `time/tzdata` or build with `-tags timetzdata` if the final image is `scratch`; this embeds timezone data needed for `Asia/Shanghai` and adds about 450 KB.
- Use a static Linux binary build with `CGO_ENABLED=0`, `GOOS=linux`, and per-arch `GOARCH=amd64/arm64`. A multi-stage Dockerfile can copy the resulting binary into `scratch`, `gcr.io/distroless/static-debian12:nonroot`, or a similarly minimal final image.
- Prefer distroless static over pure `scratch` unless the Dockerfile explicitly copies CA certificates, `/etc/passwd`/user metadata if running non-root, and timezone data. This app makes HTTPS requests to Douyu/Yuba/CookieCloud, so trust roots are mandatory.

### Current behavior implications for Go choices

- The current WebUI serves one embedded HTML document and plain JSON APIs; `net/http` plus embedded static string/files is enough. Express-specific middleware is not a requirement (`src/docker/server.ts:363`, `src/docker/server.ts:417`).
- The current auth model is an in-memory random session token cookie, not a database-backed auth system. Go can preserve it with `crypto/rand`, `http.SetCookie`, and a mutex-protected map (`src/docker/server.ts:54`, `src/docker/server.ts:169`, `src/docker/server.ts:204`).
- Current route errors are simple JSON shapes (`{ error: string }`) and success mutations usually return `{ ok: true }`, so no API framework is needed (`src/docker/server.ts:375`, `src/docker/server.ts:657`).
- Current config persistence is a single JSON document; Go should keep whole-file load/normalize/write behavior instead of introducing SQLite/bolt/migrations (`src/docker/index.ts:265`, `src/docker/index.ts:274`, `src/core/types.ts:185`).
- Current scheduler uses five user-facing task statuses and active-run locks. `robfig/cron/v3` can schedule jobs, but the Go app still needs its own status map and overlap policy to match current skip/throw behavior (`src/docker/index.ts:57`, `src/docker/index.ts:395`).
- Current six-field cron strings make `cron.New(cron.WithSeconds(), cron.WithLocation(shanghai))` important. The default `robfig/cron/v3` parser is five-field standard cron and would reject or reinterpret current config (`src/core/medal-sync.ts:4`, `src/docker/cron.ts:17`).
- Current Douyu HTTP calls require explicit `Cookie`, `User-Agent`, `Referer`, `Origin`, and form bodies. Go `net/http` can set these values, but it canonicalizes header keys and may automatically write or ignore some transport headers such as `Content-Length`/`Connection`.
- Current WebSocket behavior needs custom headers during handshake and raw binary packet read/write. `github.com/coder/websocket.Dial` supports `DialOptions.HTTPHeader`; the Go code can write binary messages and parse null-terminated Douyu payloads (`src/core/collect-gift.ts:130`, `src/core/collect-gift.ts:160`).
- Current logging is both user-facing in-memory entries and stdout. `slog` can handle stdout, but the app still needs a bounded in-memory buffer with `{ timestamp, category, message }` to preserve `/api/logs` (`src/docker/logger.ts:1`, `src/docker/logger.ts:24`).
- Current CookieCloud legacy decrypt is pure crypto: MD5 key derivation plus AES-256-CBC on OpenSSL `Salted__` payloads. Go standard `crypto/md5`, `crypto/aes`, and `crypto/cipher` cover it without third-party dependencies (`src/core/cookie-cloud.ts:94`, `src/core/cookie-cloud.ts:114`).

### External references

- Go downloads, official: `https://go.dev/dl/` lists featured `go1.26.3` and stable `go1.25.10` on 2026-05-08.
- Go `net/http`, official: `https://pkg.go.dev/net/http` documents HTTP client/server support, custom request headers, reusable clients/transports, `NewServeMux`, server timeouts, and header canonicalization.
- Go `log/slog`, official: `https://pkg.go.dev/log/slog` documents structured logging with records containing time, level, message, and key-value attributes.
- Go `time/tzdata`, official: `https://pkg.go.dev/time/tzdata` documents embedding timezone data and notes about a 450 KB size increase.
- `robfig/cron/v3`, pkg.go.dev: `https://pkg.go.dev/github.com/robfig/cron/v3` documents version `v3.0.1`, `WithSeconds()`, `WithLocation`, `CRON_TZ`, `SkipIfStillRunning`, `Recover`, `Start`, `Stop`, and next/previous entries.
- `github.com/coder/websocket`, pkg.go.dev: `https://pkg.go.dev/github.com/coder/websocket` documents version `v1.8.14`, RFC 6455 support, `Dial(ctx, url, opts)`, `Read`, `Reader`, `Ping`, and `DialOptions.HTTPHeader`.
- `nhooyr.io/websocket`, pkg.go.dev: `https://pkg.go.dev/nhooyr.io/websocket` shows `v1.8.17` but marks the package deprecated in favor of `github.com/coder/websocket`.
- `github.com/gorilla/websocket`, pkg.go.dev: `https://pkg.go.dev/github.com/gorilla/websocket` documents version `v1.5.3`, stable API, and a complete tested WebSocket implementation; viable fallback if coder/websocket does not interoperate with Douyu.
- Docker multi-stage builds, official: `https://docs.docker.com/build/building/multi-stage/` documents building in one stage and copying a binary into a later minimal or `scratch` stage.
- Docker Go image guide, official: `https://docs.docker.com/guides/golang/build-images/` describes using a full Go image for build and a bare/distroless image for lean static-binary deployment.
- Docker minimal/distroless docs, official: `https://docs.docker.com/dhi/core-concepts/distroless/` describes reduced image size and attack surface for minimal/distroless images.

### Suggested dependency set

```text
stdlib:
  net/http
  encoding/json
  net/url
  crypto/aes
  crypto/cipher
  crypto/md5
  crypto/rand
  crypto/tls
  context
  time
  time/tzdata or -tags timetzdata
  log/slog
  os/signal
  sync
  embed

third-party:
  github.com/robfig/cron/v3
  github.com/coder/websocket
```

### Docker shape for implementation planning

- Builder: `golang:1.26` or pinned `golang:1.26.x`, download modules, run `go test ./...`, build `CGO_ENABLED=0 GOOS=linux GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w"`.
- Runtime: prefer `gcr.io/distroless/static-debian12:nonroot` or equivalent minimal static image for CA roots/non-root defaults; pure `scratch` is possible if CA certificates and any required user/timezone files are copied or embedded.
- Preserve env/config defaults: `CONFIG_PATH=/app/config/config.json`, `WEB_PORT=51417`, `WEB_PASSWORD=password`, `TZ=Asia/Shanghai`, `/app/config` directory, and exposed port `51417`.
- CI: replace Node validate steps with `go test ./...`, `go vet ./...` or `staticcheck` if adopted, and Docker buildx for linux/amd64 plus linux/arm64 release images.

### Related specs

- `.trellis/spec/backend/directory-structure.md` - keep runtime wiring separate from reusable Douyu domain logic.
- `.trellis/spec/backend/database-guidelines.md` - keep JSON config whole-file persistence and normalize missing fields in code.
- `.trellis/spec/backend/error-handling.md` - preserve simple JSON error shapes and upstream business error distinctions.
- `.trellis/spec/backend/logging-guidelines.md` - preserve bounded in-memory logs and Shanghai-local timestamp contract.
- `.trellis/spec/backend/quality-guidelines.md` - avoid framework-heavy abstractions and keep boundary validation explicit.
- `.trellis/spec/guides/docker-medal-sync-contract.md` - relevant for task/fan/config sync.
- `.trellis/spec/guides/docker-webui-auth-contract.md` - relevant for WebUI auth and Docker build wiring.

## Caveats / Not Found

- Go `net/http` is not a browser stack. It can set the same header values used today, but it canonicalizes header keys and does not promise browser-like TLS/HTTP fingerprinting or header ordering. Current Node code also uses axios, not a browser, so exact browser fidelity is not part of the existing runtime contract.
- `robfig/cron/v3` default parsing is five-field cron. The rewrite must use `WithSeconds()` or a custom parser to preserve existing six-field schedules.
- `github.com/coder/websocket` is the recommended maintained path based on docs, but Douyu interoperability should be verified against `wss://wsproxy.douyu.com:6672`; keep `gorilla/websocket` as a fallback option if handshake/header behavior differs.
- Pure `scratch` images commonly miss CA roots and timezone files. This app makes HTTPS requests and uses `Asia/Shanghai`, so a final-image smoke test must cover outbound HTTPS and cron/time formatting.
- No Go memory/image measurement was performed in this research file. Acceptance criteria should measure the actual built binary and container RSS after implementation.
