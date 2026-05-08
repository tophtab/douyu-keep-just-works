# Research: current runtime behavior

- Query: What behavior must a Go rewrite preserve from the current Node/TypeScript Docker runtime?
- Scope: internal
- Date: 2026-05-08

## Findings

### Files found

- `package.json` - Node runtime dependencies and build scripts for the Docker-only TypeScript target.
- `tsconfig.docker.json` - Docker compile boundary limited to `src/core/**/*.ts` and `src/docker/**/*.ts`.
- `Dockerfile` - two-stage Node 18 image, production npm install, `/app/config`, default port, and runtime entrypoint.
- `docker-compose.yml` - published service shape, default port mapping, config bind mount, timezone, and default `WEB_PASSWORD`.
- `.github/workflows/docker.yml` - lint/type-check/build validation plus amd64 CI image and release multi-arch image flow.
- `src/docker/index.ts` - process entrypoint, config IO, cookie resolution, scheduler lifecycle, manual triggers, status composition, and graceful shutdown.
- `src/docker/server.ts` - Express WebUI/API routes, auth session cookie, validation, masked config responses, and JSON error shapes.
- `src/docker/cron.ts` - cron validation and next-run preview using `Asia/Shanghai`.
- `src/docker/logger.ts` - in-memory log buffer and stdout log format.
- `src/core/types.ts` - persisted config, API response, job, fan, backpack, CookieCloud, and Yuba types.
- `src/core/medal-sync.ts` - default config values and compatibility normalization/reconciliation for old persisted JSON.
- `src/core/api.ts` - shared Douyu HTTP calls, cookie parsing, browser-like headers, gift send validation, fan badge parsing, and backpack parsing.
- `src/core/collect-gift.ts` - browserless glow-stick collection through Douyu danmu WebSocket.
- `src/core/job.ts` - collect/keepalive/double-card/expiring-gift/Yuba orchestration, throttling, and per-room failure behavior.
- `src/core/double-card.ts` - double-card status endpoint call.
- `src/core/yuba.ts` - Yuba list/status/sign-in/supplement flows.
- `src/core/cookie-cloud.ts` - CookieCloud legacy decrypt, cookie selection by URL, and diagnostic readiness checks.

### Runtime and packaging contract

- Current package version is `2.4.0`; `npm run build`, `npm run test`, and `npm run type-check` all target the Docker TypeScript build path, not a desktop runtime (`package.json:3`, `package.json:13`).
- Runtime dependencies are `axios`, `cron`, `cron-parser`, `express`, and `ws`; dev-only TypeScript/ESLint/type packages are separate (`package.json:21`).
- Docker build uses `node:18-slim` for both builder and runtime, runs `npm ci --ignore-scripts`, then production installs with `--omit=dev --omit=optional` (`Dockerfile:1`, `Dockerfile:5`, `Dockerfile:19`).
- The container sets `NODE_ENV=production`, `TZ=Asia/Shanghai`, and `WEB_PORT=51417`; it creates `/app/config`, exposes `51417`, and runs `node dist/docker/index.js` (`Dockerfile:15`).
- Compose publishes `51417:51417`, bind-mounts `./config:/app/config`, sets `TZ=Asia/Shanghai`, and defaults `WEB_PASSWORD=password` (`docker-compose.yml:6`).
- CI validates `npm run lint`, `npm run type-check`, and `npm run build:docker`; regular branch builds are linux/amd64, while release tags build linux/amd64 and linux/arm64 and create a manifest (`.github/workflows/docker.yml:43`, `.github/workflows/docker.yml:116`, `.github/workflows/docker.yml:130`, `.github/workflows/docker.yml:209`).

### Config and persistence contract

- `CONFIG_PATH` defaults to `config/config.json`; `WEB_PORT` defaults to `51417`; `WEB_PASSWORD` defaults to `password`; the runtime hardcodes display/scheduler timezone as `Asia/Shanghai` (`src/docker/index.ts:21`).
- Config load reads whole JSON and normalizes it with `ensureCollectGift: true`; missing config creates a default config and writes it to disk (`src/docker/index.ts:265`, `src/docker/index.ts:793`).
- Config save creates the parent directory lazily and writes pretty JSON (`src/docker/index.ts:274`).
- Persisted shape is `DockerConfig` with legacy top-level `cookie`, optional `manualCookies`, `cookieCloud`, `ui`, and task configs for `collectGift`, `keepalive`, `doubleCard`, `expiringGift`, and `yubaCheckIn` (`src/core/types.ts:185`).
- Normalization migrates legacy `cookie` into `manualCookies.main`, defaults `ui.themeMode`, normalizes task active flags and cron values, and preserves missing optional task configs as absent unless default creation is requested (`src/core/medal-sync.ts:137`, `src/core/medal-sync.ts:303`).
- Default tasks: collect gift active with `0 10 3,5 * * *`, keepalive active with `0 0 8 */6 * *`, expiring gift inactive with threshold 24h, and Yuba check-in inactive (`src/core/medal-sync.ts:4`, `src/core/medal-sync.ts:345`).
- Saving task config performs fan sync when keepalive/double-card/expiring-gift config changes and a cookie source exists; otherwise it saves and applies config directly (`src/docker/index.ts:825`).

### WebUI/API contract

- The server uses Express JSON parsing and in-memory auth sessions keyed by `dykw_session`, 30-day max age, `HttpOnly`, and `SameSite=Strict` (`src/docker/server.ts:54`, `src/docker/server.ts:167`, `src/docker/server.ts:204`).
- Page routes from `DOCKER_WEBUI_PAGE_ROUTES` serve the single HTML document before auth enforcement; API routes other than auth require a valid session and return `401 { error: '请先登录' }` when unauthenticated (`src/docker/server.ts:363`, `src/docker/server.ts:393`).
- `/api/auth/status`, `/api/auth/login`, and `/api/auth/logout` return plain JSON; missing/wrong password is a 400 with Chinese `error` string (`src/docker/server.ts:371`, `src/docker/server.ts:375`, `src/docker/server.ts:388`).
- `/api/config` masks manual cookies and CookieCloud password, while `/api/config/raw` returns the raw config after authentication (`src/docker/server.ts:417`, `src/docker/server.ts:433`).
- `/api/overview` returns cookie/task summary, `timezone: 'Asia/Shanghai'`, readiness, task statuses, and the latest 10 log entries (`src/docker/server.ts:441`).
- `/api/config` validates task cron, allocation model, send room values, double-card enabled/gift scope, expiring threshold, Yuba mode, CookieCloud fields, and UI object type before saving (`src/docker/server.ts:474`).
- Other API routes include fan reconcile, status, cron preview, logs get/delete, fans list, fans status, Yuba status, cookie-source check/effective/persist, and manual trigger by task type (`src/docker/server.ts:540`, `src/docker/server.ts:553`, `src/docker/server.ts:557`, `src/docker/server.ts:566`, `src/docker/server.ts:575`, `src/docker/server.ts:588`, `src/docker/server.ts:601`, `src/docker/server.ts:614`, `src/docker/server.ts:657`).

### Scheduler and task execution contract

- Task types are exactly `collectGift`, `keepalive`, `doubleCard`, `expiringGift`, and `yubaCheckIn`; each has `running`, `lastRun`, and `nextRun` status fields (`src/docker/index.ts:30`, `src/docker/index.ts:57`).
- Cron validation and scheduled jobs use `Asia/Shanghai`; the current persisted cron expressions include a leading seconds field and are accepted by the Node `cron` package (`src/docker/cron.ts:5`, `src/docker/cron.ts:11`).
- `getNextCronRuns` returns ISO timestamps even though log/status display uses Shanghai-local formatted strings (`src/docker/cron.ts:25`, `src/docker/index.ts:294`).
- CookieCloud sync uses a default cron `0 5 0 * * *`, a 60s in-memory snapshot cache, skips overlapping syncs, persists effective cookies when changed, and starts a startup sync after scheduling (`src/docker/index.ts:27`, `src/docker/index.ts:340`, `src/docker/index.ts:368`).
- Each scheduled task is guarded by an in-memory active-run lock; scheduled overlaps are skipped with a log line, while manual overlaps throw `任务正在执行中，请稍后再试` (`src/docker/index.ts:395`, `src/docker/index.ts:420`, `src/docker/index.ts:876`).
- Task startup/reload compares previous and next task config JSON and only starts, stops, or restarts affected tasks; if no cookie source or no configured jobs exist, jobs are stopped and a system log explains the state (`src/docker/index.ts:583`, `src/docker/index.ts:692`).
- Manual triggers reuse the same task functions as scheduled jobs and resolve either main Douyu cookie or Yuba cookie based on target URL (`src/docker/index.ts:876`, `src/docker/index.ts:889`, `src/docker/index.ts:903`, `src/docker/index.ts:917`, `src/docker/index.ts:931`).

### Douyu HTTP/WebSocket behavior

- Shared HTTP headers include `Cookie`, Edge/Chrome-like `User-Agent`, `Referer` defaulting to `https://www.douyu.com/`, and `Origin` defaulting to `*` (`src/core/api.ts:4`, `src/core/api.ts:9`).
- Gift send posts `application/x-www-form-urlencoded` to `https://www.douyu.com/member/prop/send` with `rid`, `prop_id`, `num`, `sid`, `did`, and `dy`; response body business fields `error`, `code`, or `status_code` are checked before success (`src/core/api.ts:73`, `src/core/api.ts:246`).
- Fan list fetches `https://www.douyu.com/member/cp/getFansBadgeList` as HTML, extracts the `fans-badge-list` table with regexes, maps room/name/level/rank/intimacy/today, and sorts by descending level (`src/core/api.ts:279`).
- Backpack status probes v5 and v1 endpoints for default rooms plus configured fan rooms, requires `data.data.list`, normalizes gift rows, converts second timestamps to milliseconds, and summarizes glow-stick count/earliest expiry (`src/core/api.ts:95`, `src/core/api.ts:189`).
- Double-card status calls `https://www.douyu.com/japi/interact/cdn/pocket/effective?rid=<roomId>` and treats a list item with `type === 1` and future `expireTime` as active (`src/core/double-card.ts:10`).
- Collect gift is browserless: get fan rooms, randomly choose one valid room, connect to `wss://wsproxy.douyu.com:6672`, send `loginreq`, require `loginres` with `roomgroup@=1`, send `h5ckreq`, and succeed on `h5ckres` (`src/core/job.ts:127`, `src/core/collect-gift.ts:6`, `src/core/collect-gift.ts:118`, `src/core/collect-gift.ts:160`).
- Danmu WebSocket handshake includes `Cookie`, shared `User-Agent`, `Origin: https://www.douyu.com`, and room-specific `Referer`; it uses a 10s handshake timeout and a 15s collect timeout (`src/core/collect-gift.ts:8`, `src/core/collect-gift.ts:130`).
- Keepalive loads current glow-stick count, waits 2s, computes gift counts by weight or fixed number, sends gifts one room at a time, transfers failed counts to the next room, and sleeps 2s between sends (`src/core/job.ts:152`, `src/core/job.ts:190`).
- Double-card job filters enabled rooms, optionally uses all limited-time gifts instead of glow sticks, checks per-room double-card status, only sends when at least one active room exists, and computes distribution with double-card-aware allocation (`src/core/job.ts:218`).
- Expiring-gift job loads backpack detail, filters positive-count rows with `expireTime` within threshold hours, logs skipped counts and earliest expiry, then sends by gift ID but cannot specify Douyu backpack batch (`src/core/job.ts:72`, `src/core/job.ts:327`).
- Yuba status/sign-in constructs `dy-token` from main cookie keys, uses Yuba-specific cookie plus main cookie, falls back from dy-token status to older Yuba cookie status for some non-token errors, handles Gee/login/closed-group cases explicitly, runs fast sign, then per-group sign and supplement with 5-8s random delay (`src/core/yuba.ts:93`, `src/core/yuba.ts:341`, `src/core/yuba.ts:407`, `src/core/yuba.ts:434`, `src/core/yuba.ts:517`).

### Logging and error patterns

- Log entries are `{ timestamp, category, message }`, max buffer length is 500, timestamps are formatted in `Asia/Shanghai`, and entries are mirrored to stdout as `[timestamp] [category] message` (`src/docker/logger.ts:1`, `src/docker/logger.ts:7`, `src/docker/logger.ts:11`, `src/docker/logger.ts:24`).
- Task categories are `领取`, `保活`, `双倍`, `临期`, `鱼吧`; system logs use `系统` (`src/docker/index.ts:72`).
- Route handlers return lightweight JSON errors: generally 400 for validation/no-cookie and 500 for runtime failures (`src/docker/server.ts:460`, `src/docker/server.ts:474`, `src/docker/server.ts:575`, `src/docker/server.ts:657`).
- Fan status degrades backpack lookup into `gift.error` after fan list succeeds, and per-room double-card failures become `doubleActive: false` with a system log (`src/docker/index.ts:950`).

### Related specs

- `.trellis/spec/backend/directory-structure.md` - current supported runtime is Docker WebUI plus shared core; runtime wiring stays out of core.
- `.trellis/spec/backend/database-guidelines.md` - config persistence is whole-file JSON at `CONFIG_PATH`; backward compatibility is handled in read/init code.
- `.trellis/spec/backend/error-handling.md` - use direct `try/catch`, plain `Error`, JSON `{ error }`, and preserve upstream/business failure semantics.
- `.trellis/spec/backend/logging-guidelines.md` - simple in-memory Docker log buffer, stdout mirror, categories, no full cookies, and timezone consistency.
- `.trellis/spec/backend/quality-guidelines.md` - reuse shared core logic, validate route inputs, return plain JSON, keep entrypoints thin.
- `.trellis/spec/guides/docker-medal-sync-contract.md` - relevant for fan/medal-driven task config reconciliation.
- `.trellis/spec/guides/docker-webui-auth-contract.md` - relevant for WebUI auth/session/build behavior.

## Caveats / Not Found

- No backend unit test suite was found; `npm test` maps to `npm run build:docker` (`package.json:16`).
- Current cron strings use six fields with seconds. A Go scheduler must deliberately support seconds rather than default five-field cron parsing.
- `nextRun` values are ISO strings from the cron library, while log/status timestamps are Shanghai-local strings. A rewrite should preserve API compatibility or explicitly update the WebUI contract.
- Current code uses regex HTML parsing for fan badges and browser-like headers, but not a browser network stack. If Douyu starts requiring exact browser TLS fingerprints or header ordering, the Go stdlib HTTP client may not be enough.
- `/api/config/raw` returns raw secrets to an authenticated browser session. This is existing behavior, not a recommendation.
