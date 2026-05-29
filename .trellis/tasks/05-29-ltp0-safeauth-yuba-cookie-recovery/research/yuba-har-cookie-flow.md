# Yuba HAR Cookie Flow Notes

Source HAR: `/mnt/d/Download/yuba.douyu.com.har`

Reviewed on: 2026-05-29

## Safety

The HAR was inspected with scripts that report only URL shape, status code, header names, cookie names, and sanitized snippets. Raw Cookie values, tokens, `LTP0`, callback code values, and uid/did values were not copied into this file.

## Current Export Summary

The updated HAR has:

* 188 entries.
* Main hosts:
  * `shark2.douyucdn.cn`
  * `c-yuba.douyucdn.cn`
  * `yuba.douyu.com`
  * `apic.douyucdn.cn`
  * `img.douyucdn.cn`
* No structured request cookies in HAR `request.cookies`.
* No request `Cookie` headers in HAR `request.headers`.
* No structured response cookies in HAR `response.cookies`.
* No response `Set-Cookie` headers in HAR `response.headers`.

This means the HAR export still cannot prove which concrete browser cookies were sent or refreshed. It is useful for page/request flow and frontend code references, but not enough to validate cookie mutation.

## Observed Fishbar Requests

Captured `yuba.douyu.com` requests include:

* `GET /discussion/561/posts`
* `GET /wbapi/web/group/head`
* `GET /wgapi/yuba/api/feed/getViewResourceList`
* `GET /wgapi/yuba/api/feed/webEmoji`
* `GET /wgapi/yuba/api/common/config`
* `GET /wgapi/livenc/search/searchWordRec`
* `GET /wbapi/web/leaderboardTop`
* `GET /wgapi/yubanc/api/feed/groupTopFeedList`
* `GET /wbapi/web/group/getLiveInfo`
* `GET /wgapi/yuba/api/group/userRank`
* `GET /wbapi/web/group/managersdetail`
* `GET /wgapi/yubanc/api/user/getCenterInfo`
* `GET /wgapi/yubanc/api/user/getUserFollowGroupList`
* `GET /wgapi/yubanc/api/feed/groupTabFeedList`
* `GET /wbapi/web/release/pc/latestVersion`

The HAR header list for these requests shows `referer` / `Referer` only, not `Cookie`, `dy-token`, `token`, or `X-CSRF-TOKEN`. Because browser devtools can redact credentials from HAR exports, absence in HAR is not proof that the browser sent no credentials, but this export does not provide credential evidence.

## Frontend Code Signals

The captured JS bundles contain code paths for:

* `acf_yb_` cookie prefix.
* `X-CSRF-TOKEN` derived from fishbar cookie key `acf_yb_t`.
* `dy-client: pc` and `dy-token` headers for PC-client/token mode.
* Login checks that display or trigger login when auth errors occur.
* `passport.douyu.com/lapi/passport/iframe/safeAuth`.
* A fishbar auth bridge endpoint `/ybapi/authlogin` was seen in a previous HAR export, but not in the updated export.

## Previous HAR Observation

An earlier export from the same path showed this chain:

1. `GET https://passport.douyu.com/lapi/passport/iframe/safeAuth`
   * query keys: `client_id`, `did`, `t`, `callback`
   * response: `302`
   * redirect location shape: `//yuba.douyu.com/ybapi/authlogin?callback=<masked>&code=<masked>&loginType=safeAuth&uid=<masked>`
2. `GET https://yuba.douyu.com/ybapi/authlogin`
   * query keys: `callback`, `code`, `loginType`, `uid`
   * response: `200`
   * response body shape: JSONP success, message "登录成功"

That older observation suggests the fishbar page bridges passport safeAuth into fishbar auth with `/ybapi/authlogin`. However, neither export exposed Set-Cookie names for this bridge, so the exact `acf_yb_*` refresh contract remains unverified.

## Interpretation

The app can safely implement the main-site `safeAuth` refresh because it was validated separately with CookieCloud `LTP0 + dy_did` and returned main-site auth cookies.

The fishbar-specific refresh path is still not validated. There is a plausible browser flow:

1. Browser uses passport safeAuth.
2. Passport redirects to fishbar `/ybapi/authlogin` with a one-time code.
3. Fishbar may update fishbar login state.

But the available HAR data does not show Set-Cookie output for `acf_yb_*`, so the MVP should not claim to refresh fishbar cookies directly.

## Browser/App Divergence

Douyu Keep's server-side HTTP refresh operates in the app process. Even if it receives refreshed cookies, those cookies are persisted only into the app's local config unless explicitly written elsewhere. The browser's cookie jar is separate and will not receive those cookies.

CookieCloud is also one-way for this app's current design: browser to CookieCloud to Douyu Keep. It does not push Douyu Keep's refreshed cookies back to the browser.

Therefore, it is possible for:

* Douyu Keep local cookies to be valid after a server-side refresh.
* The browser cookies to remain stale or show "用户未登陆或token已过期".

It is not yet proven that Douyu Keep's refresh invalidates browser cookies. That would require comparing browser cookie names/expiry/validity before and after an app-side refresh, or observing server behavior that rotates auth tokens and rejects prior browser tokens.

## Follow-up Needed

To validate fishbar cookie refresh, capture a HAR with:

* "Preserve log" enabled before loading fishbar.
* The login-refresh moment included.
* Request and response headers exported with cookies if the browser allows it.
* Focus on `passport.douyu.com/lapi/passport/iframe/safeAuth` and `yuba.douyu.com/ybapi/authlogin`.

Only cookie names are needed for planning; raw values should remain redacted.
