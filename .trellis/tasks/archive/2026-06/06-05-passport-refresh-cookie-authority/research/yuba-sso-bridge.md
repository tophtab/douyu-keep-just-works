# Yuba SSO bridge research

## Summary

The Yuba page appears to rely on the same Douyu Passport login popup/QR flow, with the return URL pointed at Yuba. This makes the user's remembered flow plausible: after a normal Passport login completes, the browser returns to `https://yuba.douyu.com/mygroups`, where Yuba-side code can finish its own logged-in state.

Scan-confirmed Playwright isolation now shows the authority chain clearly: `passport.douyu.com` `LTP0` is the credential that lets Yuba complete SSO. Main-site `www.douyu.com` `acf_*` cookies alone did not produce full Yuba login cookies. With passport `LTP0` retained and main/Yuba auth cookies deleted, visiting `https://yuba.douyu.com/mygroups` triggered Yuba SSO and produced the full Yuba cookies.

## Public-page observations

Test environment: isolated `playwright-cli` browser with no user profile or existing login cookies.

Visited:

```text
https://yuba.douyu.com/mygroups
```

Fresh visit set only partial/anonymous Yuba material:

```text
acf_yb_t=<value>        domain: yuba.douyu.com
dy_did=<value>          domain: .douyu.com and yuba.douyu.com
```

It did not set:

```text
acf_yb_auth
acf_yb_uid
```

The page still rendered the login-required state:

```text
登录后可查看我关注的鱼吧
```

## Login trigger observations

Clicking the page's message/login-trigger surface opened the Douyu Passport iframe. The iframe showed:

```text
斗鱼APP扫码登录
```

The iframe offered OAuth links using Yuba as the return URL:

```text
https://www.douyu.com/member/oauth/signin/weixin?biz_type=5&ref_url=https%3A%2F%2Fyuba.douyu.com%2Fmygroups&fac=&type=login&isMultiAccount=0
https://www.douyu.com/member/oauth/signin/qq?biz_type=5&ref_url=https%3A%2F%2Fyuba.douyu.com%2Fmygroups&fac=&type=login&isMultiAccount=0
https://www.douyu.com/member/oauth/signin/weibo?biz_type=5&ref_url=https%3A%2F%2Fyuba.douyu.com%2Fmygroups&fac=&type=login&isMultiAccount=0
```

The QR login network calls matched the existing Passport QR research:

```http
POST https://passport.douyu.com/scan/generateCode
GET  https://passport.douyu.com/japi/scan/auth?time=<epoch-ms>&code=<scan-code>
```

The Passport page also probed local PC client ports:

```text
https://local.passport.douyu.com:<port>/pcclient/getUserInfo
```

Those probes failed in the isolated environment and are not required for QR login.

## Scan-confirmed authority isolation

Experiment environment: isolated `playwright-cli` browser session. Raw cookie values were not recorded; only cookie names, domains, and response cookie names were inspected.

### Normal passport QR to Yuba

Opened:

```text
https://passport.douyu.com/index/login?type=login&client_id=1&state=https%3A%2F%2Fyuba.douyu.com%2Fmygroups
```

After Douyu app scan confirmation, the browser first obtained passport/main login material, then navigating to `https://yuba.douyu.com/mygroups` showed the logged-in "我关注的" page state and the cookie jar contained:

```text
LTP0
acf_auth
acf_uid
acf_stk
acf_biz
acf_ct
acf_ltkid
acf_yb_auth
acf_yb_uid
acf_yb_t
```

Deleting only the Yuba cookies and reloading `mygroups` captured:

```text
GET https://yuba.douyu.com/wbapi/web/leaderboardTop
Set-Cookie: acf_yb_t

GET https://yuba.douyu.com/ybapi/authlogin
Set-Cookie: acf_yb_auth
Set-Cookie: acf_yb_new_uid
Set-Cookie: acf_yb_uid
```

### Main-site cookie without passport

Deleted passport login cookies (`LTP0`, `dy_accounts_main`) and Yuba cookies, while leaving the existing main-site login cookies. Reloading `https://yuba.douyu.com/mygroups` failed to produce full Yuba login state:

```text
Page text: 登录后可查看我关注的鱼吧
Final cookies: acf_yb_t only; no acf_yb_auth or acf_yb_uid
```

The page attempted `https://passport.douyu.com/lapi/passport/iframe/safeAuth`, but without passport `LTP0` it did not bridge to Yuba login. This shows main-site cookies alone are not a full-Yuba-cookie recovery source.

### Passport without main-site/Yuba auth

After a fresh QR login, deleted main-site auth cookies (`acf_auth`, `acf_uid`, `acf_stk`, `acf_biz`, `acf_ct`, `acf_ltkid`, `dy_auth`) and Yuba auth cookies, while retaining passport `LTP0`. Reloading `https://yuba.douyu.com/mygroups` succeeded:

```text
GET https://passport.douyu.com/lapi/passport/iframe/safeAuth
302

GET https://yuba.douyu.com/ybapi/authlogin
Set-Cookie: acf_yb_auth
Set-Cookie: acf_yb_new_uid
Set-Cookie: acf_yb_uid

Final cookies: acf_yb_auth, acf_yb_uid, acf_yb_t
Page text: logged-in "我关注的" content
```

Conclusion: full Yuba SSO should be modeled as passport-rooted. Main-site cookies still matter for the existing dy-token Yuba API path, but they should not be described as sufficient to mint full Yuba cookies.

## Implementation implications

The best next implementation path is not another plain request to `yuba.douyu.com`. It should be a browser-equivalent flow rooted in passport material:

1. Obtain or retain passport `LTP0` in an isolated project session.
2. Visit `https://yuba.douyu.com/mygroups` or run the equivalent Yuba SSO bridge.
3. Let Yuba call passport `safeAuth` and follow the bridge to `https://yuba.douyu.com/ybapi/authlogin`.
4. Capture `acf_yb_auth`, `acf_yb_uid`, and `acf_yb_t` from Yuba-domain responses.
5. Separately obtain main-site `acf_*` fields from passport QR/login or main-site safeAuth for dy-token requests.
6. Verify that current Yuba status/check-in APIs pass with the captured Yuba cookies plus main dy-token fields.

The future project-native login should model Yuba login as a dedicated project-session browser bridge after passport QR login. It should not add a separate Yuba QR login flow.

## Risks

* Yuba login completion may depend on browser-side JavaScript, iframe callbacks, or same-site navigation behavior that is hard to reproduce with plain HTTP.
* `acf_yb_t` alone is not proof of full login; the current project needs `acf_yb_auth`, `acf_yb_uid`, and `acf_yb_t` for full Yuba cookie readiness.
* The QR/login endpoints are internal web endpoints and can change.
