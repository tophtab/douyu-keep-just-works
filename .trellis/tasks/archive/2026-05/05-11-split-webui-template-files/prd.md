# Split WebUI Template Files

## Goal

Split the oversized Docker WebUI source template into separate HTML, CSS, and JavaScript source files so future UI maintenance is easier, while preserving the existing Docker runtime behavior and page output.

## What I Already Know

- The current WebUI document lives in `src/docker/webui/index.html` and is 4463 lines.
- `src/docker/webui.ts` reads `src/docker/webui/index.html`, replaces `__APP_NAME__`, `__APP_VERSION_LABEL__`, and `__DOCKER_WEBUI_PAGE_ROUTES_JSON__`, then serves the resulting HTML.
- `npm run build:docker` copies the whole `src/docker/webui` directory into `build/docker/docker/webui`, so extra source files under that directory are included in the build output.
- Current project guidance treats the Docker WebUI as part of the Docker runtime and discourages reintroducing Vue, Vite, Electron renderer code, or heavy frontend tooling.

## Assumptions

- The desired split is for source maintainability; the served page should still work through the existing `getHtml()` route without adding new static asset routes.
- CSS and JavaScript can be injected into placeholders at runtime from separate source files, keeping the browser-facing behavior equivalent to the current single HTML response.

## Requirements

- Keep `src/docker/webui/index.html` as the HTML shell.
- Move the existing inline styles into `src/docker/webui/styles.css`.
- Move the existing inline script into `src/docker/webui/app.js`.
- Update `src/docker/webui.ts` to load the split files and inject them into the HTML shell.
- Preserve existing runtime token replacement for app name, version label, and Docker WebUI page routes.
- Do not introduce a frontend build pipeline, framework, or new dependency.

## Acceptance Criteria

- [x] `src/docker/webui/index.html` is substantially smaller and no longer contains the full inline CSS/JS bodies.
- [x] `src/docker/webui/styles.css` contains the previous stylesheet.
- [x] `src/docker/webui/app.js` contains the previous client-side script.
- [x] `getHtml()` returns an HTML document with the same style/script content injected.
- [x] `npm run build:docker` passes.

## Definition of Done

- Build/type-check pass through the Docker compile path.
- No behavior changes are intentionally introduced.
- The change stays within the Docker WebUI/runtime boundary.

## Out of Scope

- Redesigning the WebUI.
- Adding static asset routes.
- Adding bundlers or frontend frameworks.
- Refactoring the client-side JavaScript logic beyond the file split needed for extraction.

## Technical Notes

- Relevant specs read:
  - `.trellis/spec/frontend/index.md`
  - `.trellis/spec/backend/index.md`
  - `.trellis/spec/backend/directory-structure.md`
  - `.trellis/spec/backend/error-handling.md`
  - `.trellis/spec/backend/quality-guidelines.md`
- Current `package.json` build script: `rm -rf build/docker && tsc -p tsconfig.docker.json && cp -R src/docker/webui build/docker/docker/webui`.
