# 细分斗鱼扫码登录状态

## Goal

Improve passport QR login clarity without broadening the login flow unnecessarily. The current focus is status detail only.

## What I already know

- The project uses `passport.douyu.com` QR login to obtain separate passport, main-site, and Yuba cookie snapshots.
- A live scan test using `https://passport.douyu.com/japi/scan/auth` completed `waiting -> scanned -> confirmed -> main_ok -> csrf_done -> done`.
- The live test returned required passport, main-site, and Yuba cookie keys.
- `getCsrfCookie` was found in `yijianguanzhu/douyu-qrcode-login`, not in the current project.
- In live tests, `getCsrfCookie` returned HTML and no cookies without a main-site login, but returned JSON plus `acf_ccn` and `PHPSESSID` after main-site login. This task will not add that enrichment.

## Requirements

- Expose real QR scan states where the passport API returns them, especially scanned-but-not-confirmed.
- Do not add the legacy QR poll endpoint fallback for now.
- Do not add browser-cookie sync alternatives beyond the existing CookieCloud path.
- Do not add main-site `getCsrfCookie` enrichment in this task.

## Acceptance Criteria

- [x] QR status distinguishes waiting, scanned, confirmed, cancelled/expired/failed where the active API returns those states.
- [x] No legacy QR fallback is introduced.
- [x] No CSRF/cookie-enrichment implementation is introduced.

## Out of Scope

- Cookie JSON import.
- New browser-extension or GitHub-file cookie sync.
- Legacy QR polling fallback.
- Main-site `getCsrfCookie` enrichment.

## Technical Notes

- Research note: `research/csrf-cookie-origin.md`
