# Fix web-password redirect after refactor

## Goal

Restore the Docker WebUI shortcut login flow for URLs such as `/?web-password=<password>` so deployments or bookmarks that pass the WebUI password in the query string still enter the app after the auth refactor.

## What I Already Know

- User reports the refactored project is unusable at `http://192.168.31.100:51417/?web-password=penglekang`: it stays on that URL and does not redirect.
- The Docker WebUI currently serves `src/docker/webui/index.html` for known page paths and uses `POST /api/auth/login` to issue the `dykw_session` cookie.
- `src/docker/webui/index.html` has login form handling, auth status loading, and path-based tab routing, but no logic for a `web-password` query parameter.
- Existing auth contract requires successful login to switch from the login shell to the app shell without a manual refresh.

## Assumptions

- `web-password` in the URL is an existing or expected compatibility shortcut that should attempt login with the configured WebUI password.
- After consuming the query parameter, the browser should replace the current URL with the same path without `web-password` so the password is not left visible in the address bar or history entry.
- Wrong or missing shortcut passwords should leave the user on the normal login form with a clear error.

## Requirements

- On initial WebUI load, detect `web-password` in `window.location.search`.
- If present and non-empty, submit it through the existing `/api/auth/login` endpoint instead of duplicating auth rules client-side.
- Preserve the existing race protection for stale auth requests.
- Remove `web-password` from the address bar after the shortcut is consumed.
- After a successful shortcut login, load protected app data and show the app shell.
- Keep the normal password form login behavior unchanged.

## Acceptance Criteria

- [x] Visiting `/?web-password=<correct password>` authenticates, removes the query parameter, and displays the app shell without manual form submission.
- [x] Visiting `/?web-password=<wrong password>` removes the query parameter and shows the normal login shell with an error.
- [x] Existing form login still works and switches to the app shell.
- [x] `npm run type-check` passes.
- [x] `npm run build:docker` passes.

## Definition of Done

- Tests or build/type-check verification run for the Docker WebUI path.
- Auth behavior remains consistent with `.trellis/spec/guides/docker-webui-auth-contract.md`.
- Any lasting auth contract change is reflected in the spec if needed.

## Out of Scope

- Changing the server-side session storage model.
- Adding usernames or persistent sessions.
- Reworking the Docker WebUI layout.

## Technical Notes

- Relevant files: `src/docker/webui/index.html`, `src/docker/server.ts`, `src/docker/webui.ts`.
- Relevant spec: `.trellis/spec/guides/docker-webui-auth-contract.md`, `.trellis/spec/frontend/index.md`, `.trellis/spec/backend/index.md`.
