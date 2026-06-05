# CSRF Cookie Origin And Relevance

## Source

The `getCsrfCookie` idea came from `yijianguanzhu/douyu-qrcode-login`.

- `Cookie.csrfToken()` calls `DouyuHttpRequestConfig.CSRF_TOKEN_URL` and is commented as `验证&&获取csrf`.
- `DouyuHttpRequestConfig.CSRF_TOKEN_URL` is `https://www.douyu.com/curl/csrfApi/getCsrfCookie`.
- That project treats non-zero response errors as `CsrfTokenFailedException`, then merges returned `Set-Cookie` headers into the current cookie map.

## Current Project Evidence

The current project does not call `getCsrfCookie`.

Related existing cookie requirements:

- Main-site task paths require core login fields such as `acf_uid`, `dy_did`, `acf_auth`, `acf_stk`, `acf_ltkid`, `acf_biz`, and `acf_ct`.
- `collect-gift.ts` maps `acf_ct` into a Danmu login parameter named `ct`.
- Yuba signing uses its own CSRF-style token from `acf_yb_t` as `X-CSRF-TOKEN`.

These are not proof that `acf_ccn` or `PHPSESSID` are required for the current project; they only show that Douyu has cookie-backed anti-forgery/session fields in adjacent flows.

## Live Verification

Unauthenticated or device-cookie-only request to `getCsrfCookie`:

- HTTP 200
- HTML body
- no `Set-Cookie`

After passport QR login and main-site cookie exchange:

- HTTP 200
- JSON body
- additional `Set-Cookie` names observed: `acf_ccn`, `PHPSESSID`
- required main-site keys were already complete before treating these as required

## Design Conclusion

Do not make `getCsrfCookie` part of the required login success path yet.

If implemented later, it should be optional post-login enrichment:

- run only after main-site login succeeds
- merge returned allowlisted fields if present
- log diagnostics if it returns HTML, no cookies, or fails
- never fail passport/main/Yuba login solely because this enrichment fails

Reason: the evidence supports it as a browser-session closer, not as a login prerequisite.
