# Douyu Cookie Refresh Research

## Question

Can Douyu cookies be refreshed without running a browser or browser automation?

## Findings

- Public project `starudream/sign-task` implements a non-browser refresh call.
- Its `pkg/douyu/api/auth.go` calls `https://passport.douyu.com/lapi/passport/iframe/safeAuth` with query params including `client_id=1`, a timestamp, `_`, and `callback=axiosJsonpCallback`.
- Its `pkg/douyu/api/cookie.go` sends only two cookies to that call: `dy_did` and `LTP0`.
- The refresh call reads response cookies and updates `acf_uid`, `acf_auth`, `acf_stk`, `acf_ltkid`, and `acf_username`.
- This is closer to the Douyu website's silent refresh than CookieCloud syncing, but it depends on preserving `LTP0`, which is a long-lived login credential and should be treated as sensitive.

## Sources

- `https://github.com/starudream/sign-task/blob/master/pkg/douyu/api/auth.go`
- `https://github.com/starudream/sign-task/blob/master/pkg/douyu/api/cookie.go`
- `https://github.com/starudream/sign-task/blob/master/pkg/douyu/config/account.go`

## Implementation Decision

- Do not add direct `safeAuth` refresh in this pass.
- Implement the confirmed requirement first: on cookie/login failure, force CookieCloud persist and retry once.
- A future direct refresh feature would need config shape, secret handling, masking, validation, logs, and UI text for `LTP0`.
