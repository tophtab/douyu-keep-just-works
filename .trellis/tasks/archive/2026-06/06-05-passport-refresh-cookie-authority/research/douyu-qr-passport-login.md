# Douyu QR passport login research

## Summary

Project-native Douyu passport QR login is feasible as a follow-up direction. A fresh Playwright browser session was able to generate a QR challenge, poll scan status, receive `LTP0` from `passport.douyu.com`, follow the returned main-site login URL, and receive the main `www.douyu.com` login cookies needed by the existing runtime.

No username/password, SMS, Chrome profile, or existing browser cookie was used in this validation.

## Login page entry

The main site opens a passport iframe:

```text
https://passport.douyu.com/index/login?...&type=login&client_id=1&state=<return-url>
```

The iframe loads the QR login implementation from:

```text
https://shark.douyucdn.cn/app/douyu-passport/js/page/iframe/app-login-all.js?v=v202510274
```

The QR itself is rendered as a `canvas`. Before login, the iframe cookie jar contained `dy_did` and `acf_did`, but no `LTP0`.

## QR challenge

Generate QR challenge:

```http
POST https://passport.douyu.com/scan/generateCode
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
Referer: https://passport.douyu.com/index/login?type=login&client_id=1

client_id=1&isMultiAccount=0
```

Observed response shape:

```json
{
  "error": 0,
  "data": {
    "expire": 300,
    "url": "https://m.douyu.com/topic/scan-login-middle-page?scan_code=<32-char-code>",
    "code": "<32-char-code>"
  }
}
```

A plain backend-style HTTP request was able to generate this challenge without existing browser cookies. The project can render `data.url` as a terminal/WebUI QR code and use `data.code` for polling.

## Polling

Poll login status:

```http
GET https://passport.douyu.com/japi/scan/auth?time=<epoch-ms>&code=<32-char-code>
X-Requested-With: XMLHttpRequest
Referer: https://passport.douyu.com/index/login?type=login&client_id=1
```

Observed status responses:

```json
{ "error": -2, "msg": "客户端还未扫码" }
{ "error": 1, "msg": "客户端已扫码" }
```

After app confirmation, the same polling endpoint returned:

```json
{
  "error": 0,
  "msg": "success",
  "data": {
    "isAutoReg": "...",
    "provider": "...",
    "url": "https://www.douyu.com/api/passport/login?uid=<uid>&code=<ticket>&loginType=scanCheck&..."
  }
}
```

The successful polling response set these passport cookies:

```text
dy_accounts_main
LTP0
```

`LTP0` was stored for `passport.douyu.com` as an HttpOnly secure cookie.

## Main-site cookie exchange

The browser then requested the `data.url` value:

```http
GET https://www.douyu.com/api/passport/login?uid=<uid>&code=<ticket>&loginType=scanCheck&state=&client_id=1&callback=appClient_json_callback&_=<timestamp>
```

Observed response body shape:

```text
appClient_json_callback({"error":0,"msg":"ok","data":[]})
```

Observed `Set-Cookie` names from this response:

```text
PHPSESSID
acf_auth
acf_jwt_token
acf_dmjwt_token
dy_auth
wan_auth37wan
acf_uid
acf_username
acf_nickname
acf_own_room
acf_groupid
acf_phonestatus
acf_avatar
acf_ct
acf_ltkid
acf_biz
acf_stk
```

After this request, the page showed a logged-in account state and the cookie jar contained the required main/dy-token fields:

```text
LTP0
acf_auth
acf_stk
acf_biz
acf_ct
acf_ltkid
```

## Implementation implications

The project-native QR flow should be modeled as a dedicated project session:

1. Generate `scan_code` through `scan/generateCode`.
2. Render `data.url` as QR in WebUI/terminal.
3. Poll `japi/scan/auth` until `error: 0`, with timeout and cancellation.
4. Capture `LTP0` from the successful poll response's Set-Cookie headers.
5. Request the returned `data.url` and capture main-site Set-Cookie fields.
6. Persist the passport and main cookies as local project snapshots.
7. Never log raw `scan_code`, `uid`, `ticket`, `LTP0`, or cookie values.

The existing `safeAuth` recovery can remain a fallback/refresh mechanism for this project-owned passport session. The QR login path can obtain the initial `LTP0` and main cookie directly, so it does not need username/password login.

## Risks and unknowns

* These are internal Douyu web endpoints, not a documented public API. The iframe script is versioned and may change.
* The QR challenge expires after 300 seconds; stale pollers must stop.
* This validation intentionally did not inspect or modify the user's daily browser session. It used an isolated Playwright session.
* Full Yuba cookies (`acf_yb_auth`, `acf_yb_uid`, `acf_yb_t`) were not produced by this QR main-site login path in this test. The QR flow solves passport/main login first, not full Yuba login.
