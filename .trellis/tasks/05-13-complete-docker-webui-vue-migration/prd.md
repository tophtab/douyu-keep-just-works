# Complete Docker WebUI Vue Migration

## Goal

Complete the Docker WebUI migration from the transitional legacy browser modules under `src/docker/webui/app-*.js` to Vue/TypeScript-owned behavior under `src/docker/webui-src/`. The migration must proceed as small, reversible commits, preserving Docker runtime behavior and keeping the test suite green after each coherent slice.

## Requirements

- Treat this as a continuous migration plan, not a single large diff.
- Keep current Docker WebUI routes, API response contracts, Chinese UI copy, styling, and Docker build semantics unless a migration slice explicitly requires a compatible replacement.
- Move behavior into Vue SFCs, composables, and typed helpers under `src/docker/webui-src/`.
- Keep transitional legacy modules available until their owned behavior is fully replaced.
- Commit one coherent rollback unit at a time.
- Recommended migration order:
  1. Auth shell/session: login page, auth state, session expiration, logout, and `data-auth`.
  2. API/request layer: `requestJson`, 401 handling, and toast-based error feedback as Vue/TS helpers.
  3. Config/loading overview: overview, raw config, raw overview, logs, and read-only data loading patterns.
  4. Cookie/Login config page: Cookie and CookieCloud form behavior.
  5. Task pages: collect, yuba, keepalive, double, and expiring gift task pages, preferably one task family per commit.
  6. Tables/render helpers: replace `app-render.js` and `app-table-render.js` after their legacy consumers are gone.
  7. Remove legacy modules: delete the transitional `src/docker/webui/app-*.js` layer and make `main.ts` start only Vue-owned code.
- Start implementation with the auth shell/session slice.

## Acceptance Criteria

- [x] Login shell and post-login app shell visibility are controlled by Vue state rather than legacy DOM mutation.
- [x] Initial session check, successful login, expired login, unauthorized API response handling, and logout preserve existing user-visible behavior.
- [x] `document.body.dataset.auth` keeps the existing authenticated/anonymous contract while auth is migrated.
- [x] Legacy modules that still need auth state can consume a narrow compatibility bridge until they are migrated.
- [x] Vue/TS request helpers provide the shared path for JSON requests, 401/session expiration handling, and toast feedback before page migrations depend on them.
- [x] Read-only data surfaces establish a reusable Vue loading/error pattern before form-heavy or action-heavy pages move.
- [ ] Each migration slice removes or disables the corresponding legacy owner and leaves unrelated legacy behavior untouched.
- [ ] `src/docker/webui-src/main.ts` no longer imports legacy modules when the final migration slice is complete.
- [ ] `npm run lint`, `npm run type-check`, relevant focused tests, and `npm test` pass at suitable rollback points.

## Definition of Done

- Docker WebUI behavior is Vue/TypeScript-owned end to end.
- No transitional `src/docker/webui/app-*.js` modules remain in the production WebUI boot path.
- Docker image build semantics remain valid: Vite is build-time only and the Express runtime serves static assets.
- Specs are updated if the migration establishes new reusable frontend/auth/request patterns.
- Work is committed in reviewable, rollback-friendly units.

## Technical Approach

Use a strangler migration: move one behavior owner at a time into Vue while maintaining a small compatibility bridge for any legacy modules that have not yet moved. Prefer composables for shared state and side effects, typed helpers for API calls, and SFC-owned DOM for shell/page behavior. Keep the DOM ids and data attributes that backend contracts or transitional modules still depend on until their consumers are removed.

## Decision (ADR-lite)

**Context**: Previous stages migrated the Vite/Vue build, navigation, theme mode, and toast region, but `main.ts` still imports many ordered legacy modules and `App.vue` still contains legacy-owned auth/page DOM.

**Decision**: Continue as a sequence of rollback-friendly migration commits, starting with auth shell/session because it is the final global shell behavior before broad page/API migration.

**Consequences**: The early auth and request slices may need compatibility events or narrow globals so remaining legacy modules keep working. This adds temporary bridge code, but it lowers risk and lets each page migration remove bridge dependencies incrementally.

## Out of Scope

- Redesigning the Docker WebUI visuals.
- Changing Express API routes or response contracts except for compatible client-side handling.
- Introducing Pinia, Vue Router, Vuetify, Tailwind, or another UI framework.
- Publishing Docker images.
- Rewriting every page in a single commit.

## Technical Notes

- Current Vue entry points:
  - `src/docker/webui-src/App.vue`
  - `src/docker/webui-src/main.ts`
  - `src/docker/webui-src/navigation.ts`
  - `src/docker/webui-src/theme.ts`
  - `src/docker/webui-src/toast.ts`
- Current transitional legacy modules include:
  - `src/docker/webui/app-auth-actions.js`
  - `src/docker/webui/app-request.js`
  - `src/docker/webui/app-pages.js`
  - `src/docker/webui/app-render.js`
  - `src/docker/webui/app-table-render.js`
  - task/resource/action modules under `src/docker/webui/app-*.js`
- Relevant specs:
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/hook-guidelines.md`
  - `.trellis/spec/frontend/state-management.md`
  - `.trellis/spec/frontend/type-safety.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
  - `.trellis/spec/backend/directory-structure.md`
  - `.trellis/spec/backend/error-handling.md`
  - `.trellis/spec/backend/quality-guidelines.md`
  - `.trellis/spec/guides/docker-webui-auth-contract.md`

## First Slice: Auth Shell/Session

The first implementation commit should migrate the login page, app shell visibility, initial session check, login submit, logout action, expired-session handling, and `data-auth` state into Vue-owned code. It should preserve compatibility for remaining legacy page/data modules and pass the project test suite before committing.

## Verification Results

- Vue-owned logs page slice:
  - `App.vue` now renders the logs summary, auto-refresh toggle, log rows, and empty state from Vue state.
  - `resources.ts` owns log refresh, clear-log action, auto-refresh timing, log timestamp formatting, and legacy log-state syncing.
  - Removed legacy ownership for `#logs-summary`, `#full-log-box`, `data-action="refresh-logs"`, and `data-action="clear-logs"`.
  - `npm run lint` passed.
  - `npm run type-check:webui` passed.
  - `npm run test:contracts` passed.
  - `npm run build:webui` passed.
- Read-only system resource slice:
  - Moved `/api/config/raw`, `/api/overview`, and `/api/logs` loading into `src/docker/webui-src/resources.ts`.
  - Removed the transitional `src/docker/webui/app-system-resource-actions.js` owner from the Vite boot path.
  - `npm run lint` passed.
  - `npm run type-check` passed.
  - `npm run test:contracts` passed.
  - `npm run build:webui` passed.
  - `npm test` passed, including `npm run build:docker`.
- Request helper slice:
  - `npm run lint` passed.
  - `npm run type-check` passed.
  - `npm run test:contracts` passed.
  - `npm run build:webui` passed.
- `npm run lint` passed.
- `npm run type-check` passed.
- `npm run test:contracts` passed.
- `npm test` passed, including `npm run build:docker`.
- Browser smoke test against built Docker WebUI on `127.0.0.1:51419` passed:
  - `?web-password=password` logged in and removed the password from the URL.
  - Login changed `body[data-auth]` to `app`, hid the auth shell, and showed the app shell.
  - Logout changed `body[data-auth]` back to `login`, showed the auth shell, hid the app shell, and displayed the logout toast.
  - Form login cleared the password input and displayed the success toast.
