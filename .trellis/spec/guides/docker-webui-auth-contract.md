# Docker WebUI Auth Contract

> **Purpose**: Define the executable contract for Docker WebUI password login, protected API access, login-cookie management, CookieCloud sync boundaries, and image-local Docker runtime compilation.

---

## Scope

This contract applies when changing any of:

- Docker WebUI login flow in `src/docker/webui/index.html`
- Docker auth/session routes in `src/docker/server.ts`
- Docker login-cookie / CookieCloud routes in `src/docker/server.ts`
- Docker fan-status / gift-status routes in `src/docker/server.ts`
- Docker runtime env wiring in `src/docker/index.ts`
- Douyu backpack query logic in `src/core/api.ts`
- Docker image build pipeline in `Dockerfile`
- GitHub Docker publish pipeline in `.github/workflows/docker.yml`
- Docker deployment defaults in `docker-compose.yml`

---

## Build Contract

Files:

- `Dockerfile`
- `.github/workflows/docker.yml`
- `package.json`
- `tsconfig.docker.json`

Required behavior:

1. Docker image build must compile Docker runtime code from `src/core/**/*.ts` and `src/docker/**/*.ts` inside the image.
2. `docker compose up -d --build` must not depend on prebuilt local `build/docker` artifacts.
3. Builder stage must run:
   - `npm ci --ignore-scripts`
   - `npm run build:docker`
4. Runtime stage must:
   - install production deps only
   - copy compiled output from builder stage into `/app/dist`
   - start with `node dist/docker/index.js`
5. Docker and CI builds must suppress Puppeteer browser download during dependency install with:
   - `PUPPETEER_SKIP_DOWNLOAD=true`
6. GitHub publish workflow must build the image through Buildx instead of legacy `docker build` wiring.

Current command/file contract:

```dockerfile
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json tsconfig.docker.json ./
RUN npm ci --ignore-scripts
COPY src ./src
RUN npm run build:docker
COPY --from=builder /app/build/docker ./dist/
ENV PUPPETEER_SKIP_DOWNLOAD=true
CMD ["node", "dist/docker/index.js"]
```

GitHub Actions contract:

```yaml
- uses: docker/setup-buildx-action@v3
- uses: docker/build-push-action@v6
```

`.dockerignore` must exclude at least:

- `node_modules`
- `build`
- `dist`
- `config`

---

## Runtime Env Contract

Files:

- `src/docker/index.ts`
- `docker-compose.yml`

Required env keys:

| Key | Required | Default | Meaning |
|-----|----------|---------|---------|
| `WEB_PASSWORD` | no | `password` | Docker WebUI login password |
| `WEB_PORT` | no | `51417` | Docker WebUI HTTP port |
| `TZ` | recommended | `Asia/Shanghai` | runtime timezone |
| `CONFIG_PATH` | no | `/app/config/config.json` | persisted config file path |

Rules:

- `src/docker/index.ts` must pass `WEB_PASSWORD` into the Express app context.
- `docker-compose.yml` example should expose `WEB_PASSWORD=password`.
- Password must not be logged or returned by API responses.

---

## HTTP API Contract

File:

- `src/docker/server.ts`

### `GET /api/auth/status`

Response:

```json
{
  "authenticated": true
}
```

### `POST /api/auth/login`

Request body:

```json
{
  "password": "password"
}
```

Success response:

```json
{
  "ok": true
}
```

Response headers:

- sets `Set-Cookie: dykw_session=...; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`

### `POST /api/auth/logout`

Success response:

```json
{
  "ok": true
}
```

Response headers:

- clears `dykw_session` via `Max-Age=0`

### Protected API Boundary

All existing Docker JSON APIs except:

- `/api/auth/status`
- `/api/auth/login`
- `/api/auth/logout`

must reject unauthenticated requests with:

```json
{
  "error": "请先登录"
}
```

and HTTP status `401`.

### `GET /api/config`

Purpose:

- return the masked persisted config for UI-safe reads

Success response:

```json
{
  "exists": true,
  "data": {
    "cookie": "acf_uid=12...abc",
    "manualCookies": {
      "main": "acf_uid=12...abc",
      "yuba": "acf_yb_uid...xyz"
    },
    "cookieCloud": {
      "active": true,
      "endpoint": "https://cookiecloud.example.com",
      "uuid": "uuid",
      "password": "passwo...word",
      "cryptoType": "legacy"
    }
  }
}
```

Rules:

- `cookie`, `manualCookies.main`, `manualCookies.yuba`, and `cookieCloud.password` must be masked.
- `endpoint` and `uuid` are returned as-is.
- `cryptoType`, when present, is normalized to `legacy`.
- when no config exists, respond with `{ "exists": false }`.

### `GET /api/fans/status`

Purpose:

- return fan-badge status plus current glow-stick inventory for the Docker WebUI

Success response:

```json
{
  "fans": [
    {
      "name": "主播名",
      "roomId": 123456,
      "level": 10,
      "rank": 1,
      "intimacy": "12345/20000",
      "today": 0,
      "doubleActive": false
    }
  ],
  "gift": {
    "count": 12,
    "expireTime": 1777000000000
  }
}
```

Degraded success response:

```json
{
  "fans": [
    {
      "name": "主播名",
      "roomId": 123456,
      "level": 10,
      "rank": 1,
      "intimacy": "12345/20000",
      "today": 0,
      "doubleActive": false
    }
  ],
  "gift": {
    "count": 0,
    "error": "获取荧光棒数量失败，接口返回错误码 9"
  }
}
```

Rules:

- route is still authenticated by the global protected API boundary
- route resolves the main-site cookie and loads fan badges first
- route then queries glow-stick inventory through `getGiftStatus(cookie, fanRoomIds)`
- `fanRoomIds` are derived from the returned `fans[].roomId`
- if gift lookup fails, the route must still return `200` with `fans` populated and `gift.error` describing the failure
- only complete route failure should return `500`, such as fan-badge fetch failure or unexpected route-level exception

### Douyu Backpack Query Contract

Files:

- `src/core/api.ts`
- `src/core/job.ts`
- `src/docker/index.ts`
- `src/renderer/run/utils.ts`

Required behavior:

1. Glow-stick inventory is read from Douyu backpack endpoints and requires a valid `rid` query parameter.
2. Default backpack candidate room IDs must start with:
   - `217331`
   - `557171`
3. If caller provides extra candidate room IDs, append them after the defaults and deduplicate.
4. For each candidate room ID, query in this order:
   - `/japi/prop/backpack/web/v5?rid=<roomId>`
   - `/japi/prop/backpack/web/v1?rid=<roomId>`
5. Stop on the first successful payload with a valid `data.list` array.
6. Requests without `rid` are invalid and must not be used as a fallback path.
7. If Douyu returns `error = 9` and the cookie lacks `acf_auth` or `acf_stk`, surface a clear missing-cookie-key error instead of a generic code-only message.

Current endpoint order contract:

```ts
const DEFAULT_BACKPACK_ROOM_IDS = [217331, 557171]
```

```text
https://www.douyu.com/japi/prop/backpack/web/v5?rid=<roomId>
https://www.douyu.com/japi/prop/backpack/web/v1?rid=<roomId>
```

Cookie/key rules:

- main-site backpack requests require the main Douyu cookie, not the yuba cookie
- missing-key hint currently checks:
  - `acf_auth`
  - `acf_stk`
- gift id `268` is treated as the glow stick inventory source
- when multiple glow-stick stacks exist, earliest expiry wins for `gift.expireTime`

### `GET /api/config/raw`

Purpose:

- return the unmasked persisted config to the authenticated in-page management script

Rules:

- this route is authenticated only
- `manualCookies` and `cookieCloud` are returned verbatim
- WebUI uses this route to prefill login Cookie textareas and CookieCloud fields

### `POST /api/cookie`

Request body:

```json
{
  "mainCookie": "acf_uid=...",
  "yubaCookie": "acf_yb_uid=..."
}
```

Compatibility request body:

```json
{
  "cookie": "acf_uid=..."
}
```

Success response:

```json
{
  "ok": true
}
```

Rules:

- at least one of `mainCookie`, `yubaCookie`, or legacy `cookie` must be non-empty
- route persists to `manualCookies.main` / `manualCookies.yuba`
- runtime also mirrors `manualCookies.main || manualCookies.yuba` into legacy `config.cookie`

### Cookie Source API Contract

These routes define the WebUI boundary between manual Cookie input, CookieCloud sync, and runtime-effective cookies.

#### `POST /api/cookie-source/check`

Success response:

```json
{
  "source": "cookieCloud",
  "mainCookieReady": true,
  "yubaDyTokenReady": true,
  "yubaCookieReady": true,
  "missingMainKeys": [],
  "missingYubaDyTokenKeys": [],
  "missingYubaCookieKeys": [],
  "missingYubaKeys": [],
  "cookieCount": 42,
  "domains": ["douyu.com", "yuba.douyu.com"],
  "updateTime": "2026-04-24 08:00:00"
}
```

Rules:

- when CookieCloud is enabled, this route forces a fresh CookieCloud pull
- when CookieCloud is disabled, this route validates persisted manual cookies
- main-cookie readiness is based on `acf_uid`, `dy_did`, `acf_auth`, `acf_stk`
- yuba dy-token readiness is based on main-cookie fields `acf_uid`, `acf_biz`, `acf_stk`, `acf_ct`, `acf_ltkid`
- full/legacy yuba-cookie readiness is based on `acf_yb_auth`, `acf_yb_uid`, `acf_yb_t`
- missing full/legacy `acf_yb_*` fields must not imply that dy-token-backed yuba list/status requests are unavailable
- `missingYubaKeys` is retained as a compatibility alias for `missingYubaCookieKeys`

#### `GET /api/cookie-source/effective`

Success response:

```json
{
  "source": "hybrid",
  "mainCookie": "acf_uid=...",
  "yubaCookie": "acf_yb_uid=...",
  "cookieCloudActive": true,
  "persistedLocally": false
}
```

Rules:

- runtime prefers CookieCloud cookies when `cookieCloud.active === true`
- if CookieCloud has no matching cookie for a hostname, manual cookie is used as fallback
- `source` may be `none`, `manual`, `cookieCloud`, or `hybrid`
- `persistedLocally` is `true` only when effective cookies already match `manualCookies.main` / `manualCookies.yuba`

#### `POST /api/cookie-source/persist`

Success response:

```json
{
  "ok": true,
  "data": {
    "config": { "...": "latest persisted config" },
    "effective": {
      "source": "cookieCloud",
      "mainCookie": "acf_uid=...",
      "yubaCookie": "acf_yb_uid=...",
      "cookieCloudActive": true,
      "persistedLocally": true
    },
    "updated": true
  }
}
```

Rules:

- route requires `cookieCloud.active === true` and complete CookieCloud config
- route writes the latest effective main / yuba cookies back into `manualCookies`
- when effective cookies are unchanged, respond with `updated: false`
- route must not disable CookieCloud after persistence; it only updates fallback manual cookies

---

## Session Contract

File:

- `src/docker/server.ts`

Cookie/session rules:

- cookie name: `dykw_session`
- server stores in-memory session tokens
- token issued with `crypto.randomBytes(24).toString('hex')`
- session TTL: `30 days`
- expired sessions are removed before auth checks
- restart clears all sessions

Non-goals:

- no persistent session store
- no username concept
- no password hashing inside app config file

---

## Frontend Contract

File:

- `src/docker/webui/index.html`

Required behavior:

1. Initial page load shows login shell first.
2. Frontend must call `GET /api/auth/status` before loading protected config/log/task data.
3. Login form submits password to `POST /api/auth/login`.
4. On `401`, client must clear protected page state and return to login shell.
5. Logout button must call `POST /api/auth/logout`.
6. After successful login, client loads:
   - `/api/config/raw`
   - `/api/overview`
   - `/api/logs`
   - fan sync/status when cookie source exists
   - yuba status when the user enters the fish-bar page and cookie source exists
7. Auth state updates must ignore stale async responses. A slower initial `GET /api/auth/status` response must not overwrite a newer successful login/logout result.
8. Route/path helpers embedded in the HTML template must emit valid browser JavaScript after TypeScript string interpolation. Regex literals used inside the template must be escaped for the final emitted script.
9. The page router must support these authenticated paths without breaking the login shell bootstrap:
   - `/`
   - `/Configurations/LoginConfig`
   - `/Configurations/CollectGiftConfig`
   - `/Configurations/DailyJobConfig`
   - `/Configurations/DoubleCardConfig`
   - `/Configurations/YubaCheckInConfig`
   - `/Logs`

UI state rules:

- login validation message stays local to the page script
- password input is not persisted in config
- incorrect password shows a clear error
- successful login switches the page from login shell to app shell without a manual refresh
- login page shows two manual Cookie inputs: `main-cookie-input` and `yuba-cookie-input`
- login page shows CookieCloud config fields: `endpoint`, `uuid`, `password`, plus a persisted enable toggle
- login page primary CookieCloud action is “保存并启用”; it persists the credentials through `/api/config` with `cookieCloud.active = true`
- login page secondary CookieCloud action is “同步并校验”; when CookieCloud is enabled, it must call `/api/cookie-source/persist` before `/api/cookie-source/check` so the visible diagnostics describe the locally persisted snapshot
- CookieCloud sync writes the latest Douyu-domain cookies back into the login Cookie textareas instead of creating a second “effective cookie” form
- path-routed pages such as `/Configurations/LoginConfig` and `/Logs` must still boot the same login/app shell script without browser syntax errors

---

## Validation Matrix

| Boundary | Condition | Result |
|----------|-----------|--------|
| `POST /api/auth/login` | `password` missing or empty | `400 { "error": "请输入密码" }` |
| `POST /api/auth/login` | password mismatch | `400 { "error": "密码错误" }` |
| frontend auth state | stale `/api/auth/status` resolves after login | keep authenticated app shell; do not overwrite with stale unauthenticated state |
| protected `/api/*` | no valid session cookie | `401 { "error": "请先登录" }` |
| `POST /api/auth/logout` | no cookie present | `200 { "ok": true }` |
| session lookup | token expired | reject as unauthenticated |
| `POST /api/cookie` | `mainCookie` and `yubaCookie` both empty | `400 { "error": "缺少 cookie" }` |
| `POST /api/cookie-source/check` | no manual cookie and CookieCloud disabled | `400 { "error": "请先配置 cookie" }` |
| `POST /api/cookie-source/check` | CookieCloud enabled but endpoint / uuid / password incomplete | `400 { "error": "...配置不完整" }` |
| `GET /api/cookie-source/effective` | no resolvable cookie source | `400 { "error": "请先配置 cookie" }` |
| `POST /api/cookie-source/persist` | CookieCloud not enabled | `400 { "error": "CookieCloud 未启用" }` |
| `POST /api/cookie-source/persist` | CookieCloud enabled but runtime cannot resolve cookies | `400 { "error": "请先配置 cookie" }` or `400 { "error": "...配置不完整" }` |
| backpack endpoint | request omits `rid` | Douyu returns invalid-parameter error; do not use as fallback contract |
| backpack endpoint | `rid` candidate `217331` fails but `557171` succeeds | continue to next candidate; inventory still resolves |
| backpack endpoint | default candidates fail but fan-room candidate succeeds | continue through appended fan room IDs and return resolved inventory |
| backpack endpoint | Douyu returns `error = 9` and cookie lacks `acf_auth` / `acf_stk` | surface missing-key guidance in `gift.error` / job log |
| `GET /api/fans/status` | fan list succeeds but gift lookup fails | `200` with `fans` populated and `gift.error` set |

---

## Good / Base / Bad Cases

### Good

- container starts with `WEB_PASSWORD=password`
- browser loads `/`
- user posts correct password
- server issues `dykw_session`
- protected APIs return `200`

### Good

- CI workflow builds and pushes image through `docker/setup-buildx-action@v3` + `docker/build-push-action@v6`
- Node install runs with `PUPPETEER_SKIP_DOWNLOAD=true`
- image build does not attempt bundled Chromium download

### Base

- user refreshes page after login
- `GET /api/auth/status` still returns `authenticated: true`
- page reloads protected data without re-entering password

### Base

- browser loads `/Configurations/LoginConfig` directly
- page script parses successfully and still renders the login shell before authentication
- wrong password shows inline error text
- correct password switches to app shell without a full page refresh

### Good

- user enables CookieCloud with valid endpoint / uuid / password
- login page clicks “保存并启用” and persists credentials through `/api/config`
- user clicks “同步并校验”
- WebUI persists the latest effective CookieCloud cookies through `/api/cookie-source/persist`
- server validates the latest persisted/synchronized cookie source through `/api/cookie-source/check`
- login card source displays `CookieCloud`
- login Cookie textareas show the values updated from `/api/cookie-source/persist`

### Base

- user disables CookieCloud and keeps manual cookies
- login card source displays `手填`
- runtime falls back to persisted `manualCookies.main` / `manualCookies.yuba`

### Base

- `/api/fans/status` loads fan badges successfully
- default backpack candidate `217331` fails for the current cookie/session
- fallback candidate `557171` succeeds
- page still shows valid glow-stick count

### Base

- `/api/fans/status` loads fan badges successfully
- default candidates fail
- one of the current fan badge room IDs succeeds
- page shows resolved glow-stick count without requiring manual room configuration

### Bad

- user enables CookieCloud but leaves `uuid` or `password` blank
- `/api/config` rejects the payload with `400`
- WebUI keeps the toggle state consistent with the persisted config after the failed save

### Bad

- user posts wrong password
- server returns `400 { "error": "密码错误" }`
- no session cookie is issued

### Bad

- user calls `/api/overview` before login or after logout
- server returns `401 { "error": "请先登录" }`

### Bad

- local source changed but no local build artifacts exist
- `docker compose up -d --build` must still produce a working image because compile happens inside builder stage

### Bad

- backpack request is sent without `rid`
- Douyu rejects the request as missing or invalid `rid`
- implementation must not treat no-`rid` probing as a valid compatibility path

### Bad

- `/api/fans/status` fails the entire response just because glow-stick inventory lookup returned code `9`
- this is a regression; correct behavior is `fans` success plus degraded `gift.error`

---

## Tests Required

Commands:

- `pnpm lint`
- `pnpm type-check`
- `pnpm test`

Assertion points:

- unauthenticated `GET /api/overview` returns `401 { "error": "请先登录" }`
- authenticated `GET /api/config` returns masked cookie fields
- authenticated `GET /api/config/raw` returns unmasked `manualCookies` and `cookieCloud`
- `POST /api/cookie` accepts main-only, yuba-only, and dual-cookie payloads
- `POST /api/cookie-source/check` returns readiness booleans and missing-key arrays
- `POST /api/cookie-source/persist` writes effective CookieCloud results back into `manualCookies`
- CookieCloud “同步并校验” performs persist before check, and missing-key diagnostics reflect the synced local snapshot
- direct route boot still works for `/Configurations/LoginConfig`, `/Configurations/CollectGiftConfig`, and `/Configurations/YubaCheckInConfig`
- `buildBackpackEndpoints()` returns default IDs first, appends deduped candidate room IDs, and emits `v5 -> v1` order per room
- `getGiftStatus()` converts backpack code `9` plus missing `acf_auth` / `acf_stk` into a clear message
- `GET /api/fans/status` still returns `fans` when gift lookup fails and exposes failure through `gift.error`
- Docker CI still builds through Buildx and sets `PUPPETEER_SKIP_DOWNLOAD=true`

---

## Wrong vs Correct

### Wrong

- treat CookieCloud sync as a separate runtime-only source and render it in extra “effective cookie” input boxes
- leave `manualCookies` unchanged after a successful CookieCloud sync
- run CookieCloud diagnostics before sync and then display stale missing-key results
- keep login route docs pinned to `/Configurations/CookieConfig`

### Correct

- treat CookieCloud as the preferred runtime source and `manualCookies` as persisted fallback
- write synced Douyu-domain cookies back into `manualCookies.main` / `manualCookies.yuba`
- perform CookieCloud sync before readiness diagnostics when the user clicks “同步并校验”
- keep the page-route contract aligned with the current split pages:
  - `/Configurations/LoginConfig`
  - `/Configurations/CollectGiftConfig`
  - `/Configurations/YubaCheckInConfig`

---

## Related Files

- `Dockerfile`
- `.dockerignore`
- `.github/workflows/docker.yml`
- `docker-compose.yml`
- `README.md`
- `src/core/api.ts`
- `src/core/job.ts`
- `src/docker/index.ts`
- `src/docker/server.ts`
- `src/docker/webui/index.html`
