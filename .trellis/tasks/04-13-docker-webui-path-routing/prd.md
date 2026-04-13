# Support Docker WebUI Path Routing

## Goal
Allow the Docker WebUI to support direct path-based navigation such as `/Configurations/DailyJobConfig` while keeping the current single-HTML architecture.

## Requirements
- Keep the Docker WebUI as a single HTML entry instead of splitting into multiple HTML files.
- Support direct page access for the main WebUI sections through pathname-based routing.
- Keep existing `/api/*` endpoints and task/config behavior unchanged.
- Preserve the current login gate so unauthenticated users cannot access protected pages.
- Keep browser back/forward navigation working for page switches inside the WebUI.

## Acceptance Criteria
- [ ] Visiting supported page paths returns the Docker WebUI HTML instead of a 404 or redirect loop.
- [ ] After login, the UI opens the page that matches the current pathname.
- [ ] Clicking sidebar tabs updates the visible page and syncs the browser URL.
- [ ] Browser back/forward updates the active page correctly.
- [ ] Existing Docker API endpoints and auth flows still work.

## Technical Notes
- Update `src/docker/server.ts` to treat selected pathname routes as valid page entries.
- Update `src/docker/html.ts` to map pathname routes to existing tab keys.
- Keep route handling lightweight and explicit; do not introduce a full frontend framework router inside the Docker HTML string.
