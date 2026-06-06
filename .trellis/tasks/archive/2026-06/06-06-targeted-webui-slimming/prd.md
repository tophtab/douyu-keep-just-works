# targeted webui frontend slimming

## Goal

Finish the targeted Docker WebUI slimming work already started in the working tree: keep the app visually simpler, make the login shell rely on shared theme variables, replace the app icon assets, and prevent the first paint from flashing the wrong theme by injecting the configured UI theme into the served HTML.

## What I already know

- The active working tree already modifies Docker WebUI frontend files, WebUI static serving helpers, and both root/WebUI icon assets.
- Docker WebUI is the maintained runtime. The Vue/Vite WebUI must remain the only frontend runtime.
- Theme mode is a shared backend/frontend config contract owned by `src/core/types.ts`.
- The server can read the current Docker config through `AppContext.getConfig()`.

## Requirements

- Serve WebUI HTML with initial theme tokens derived from `config.ui.themeMode`.
- Keep invalid or missing theme mode values safe by falling back to `system`.
- Pass the server-provided initial theme mode into the Vue theme composable.
- Do not let an empty initial raw config reset the server-provided bootstrap theme before authenticated config loads.
- Keep login/shell styling aligned with global theme variables instead of a hard-coded one-off dark surface.
- Keep icon references at `/icon.png` and update both root and WebUI public icon assets consistently.

## Acceptance Criteria

- [ ] `/` WebUI HTML includes `initialThemeMode` matching valid configured values.
- [ ] Invalid/missing theme mode renders as `system`.
- [ ] Initial body/meta theme tokens are replaced in the served HTML; no template placeholders leak.
- [ ] Vue theme state initializes from `window.DOUYU_KEEP_WEBUI_BOOTSTRAP.initialThemeMode`.
- [ ] Docker WebUI maintenance contracts are updated for the new bootstrap shape.
- [ ] `npm run lint`, `npm run type-check`, and relevant contract tests pass.

## Definition of Done

- Tests added/updated where behavior or guardrails changed.
- Lint/type-check are green.
- Build contract remains Docker-first and Vite-backed.
- No secrets or raw config values are exposed in HTML beyond the safe UI theme mode.

## Out of Scope

- Broad redesign of WebUI pages beyond the targeted login/shell slimming already in progress.
- New theme modes, user preference storage, or config migrations.
- Electron/Yarn desktop runtime work.

## Technical Notes

- Relevant files inspected: `src/docker/webui.ts`, `src/docker/server-webui-routes.ts`, `src/docker/server.ts`, `src/docker/webui/App.vue`, `src/docker/webui/theme.ts`, `src/docker/webui/index.html`, `src/docker/webui/styles/shell.css`, `test/project-maintenance-contract.test.js`, `test/server-route-guardrails-contract.test.js`.
- Relevant specs: `.trellis/spec/frontend/*`, `.trellis/spec/backend/{directory-structure,error-handling,testing-guidelines,quality-guidelines}.md`, `.trellis/spec/guides/{cross-layer-thinking-guide,code-reuse-thinking-guide}.md`.
