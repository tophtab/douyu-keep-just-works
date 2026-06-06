# Simplify WebUI Login Page

## Goal

Replace the verbose Docker WebUI login screen with a compact centered password login page. The page should present the project identity, one password field, and one login button, with no side explanation panel or extra operational copy.

## What I Already Know

* The current login UI lives in `src/docker/webui/components/AuthShell.vue`.
* Login styling lives primarily in `src/docker/webui/styles/shell.css`, with responsive overrides in `src/docker/webui/styles/responsive.css`.
* Authentication logic and password validation already exist in `src/docker/webui/auth.ts` and backend auth routes; this task is visual/layout only.
* The user wants a centered layout inspired by the provided dark MoviePilot login screenshot, but without username, remember-login, or password visibility controls.

## Requirements

* Show the project name with a small project icon near it.
* Show only a password input and login button as the main login controls.
* Keep the login form centered in the viewport.
* Remove the current descriptive hero panel, side-by-side layout, form heading copy, and environment-variable hint from the visible login page.
* Preserve existing password submission behavior, disabled state, error alert, and browser password autocomplete behavior.
* Do not rewrite existing task configuration, Cookie files, or WebUI authentication behavior.

## Acceptance Criteria

* [x] Unauthenticated WebUI displays a centered login panel.
* [x] The panel contains project branding, password input, login button, and login error text only when needed.
* [x] There is no visible explanatory side panel or auxiliary login copy.
* [x] Existing login API behavior continues to work.
* [x] Frontend lint/type checks pass or any inability to run them is documented.

## Definition of Done

* Frontend component and CSS updated using existing Vue/Vite structure.
* Visual layout remains usable on desktop and mobile widths.
* Quality checks run for the changed frontend surface.

## Out of Scope

* Adding username login, remember-login, password visibility toggle, or new auth storage.
* Changing `WEB_PASSWORD` behavior or backend auth/session handling.
* Redesigning the authenticated management console.

## Technical Notes

* Follow `.trellis/spec/frontend/index.md` and related WebUI component/style guidance before implementation.
* This task is expected to touch only the auth shell component and auth shell responsive styles unless inspection shows a tighter local dependency.
* Verified with `npm run lint`, `npm run type-check:webui`, `npm run build:webui`, `npm run test:contracts`, and `npm test`.
* Visual checked through Vite at desktop, 390px mobile, and 320px narrow mobile widths.
* Spec update reviewed after implementation; no code-spec change needed because no reusable convention, API, config, or cross-layer contract changed.
