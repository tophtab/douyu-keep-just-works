# Docker WebUI overview page Vue migration

## Goal

Migrate the Docker WebUI overview page from legacy DOM string rendering into Vue-managed state and template bindings while preserving the current page behavior, copy, styling, and Docker deployment contract.

## Requirements

* Render the overview basic status cards in Vue instead of writing `#overview-basic-summary.innerHTML`.
* Render the gift summary, fans table loading/empty states, and fans status table in Vue instead of writing `#overview-gift-summary`, `#overview-fans-note`, and `#overview-fans-table-wrap`.
* Keep the existing refresh button behavior and loading state, but expose it through Vue events/state instead of relying on a static `data-action="refresh-overview"` click target.
* Preserve current lazy-loading behavior: when the overview page is active and a cookie source is configured, the fans status should load as it does today.
* Preserve existing accessibility semantics: live region for the fans note, tab panel attributes, scoped table headers, stable table classes, and icon-only refresh/logout labels.
* Keep legacy browser modules as the transitional resource/action layer until the remaining behavior is migrated.

## Acceptance Criteria

* [x] `App.vue` renders the overview summary, gift summary, fans note, and fans table with Vue directives and no overview-only DOM target placeholders.
* [x] The old `renderOverview()` path no longer mutates overview page markup directly and instead dispatches state to Vue.
* [x] The refresh control is wired with Vue `@click` and reflects active refresh loading with `disabled`, `aria-busy`, and title changes.
* [x] The login empty state's "前往登录" action is handled by Vue navigation rather than a legacy `data-action="tab"` button.
* [x] Existing Vue migration contract tests are updated to cover overview page bindings and absence of overview DOM-string rendering.
* [x] `npm run lint` and `npm run type-check:webui` pass.

## Definition of Done

* Tests added or updated for the migration contract.
* Lint and Vue type-check pass.
* No backend API contract changes.
* No visual redesign beyond the minimum template conversion.

## Technical Approach

Follow the existing page migration pattern used by login, collect, yuba, keepalive, double-card, and expiring-gift pages: create a Vue composable under `src/docker/webui-src/`, listen to document-level legacy bridge events, expose computed view models to `App.vue`, and leave the legacy modules responsible for API/resource orchestration during the transition.

## Decision (ADR-lite)

**Context**: The overview page is the remaining page still populated by legacy `innerHTML` writes in `app-pages.js`, while recent commits migrated task pages to Vue composables without rewriting the full legacy resource layer.

**Decision**: Add a dedicated overview composable and bridge event so the legacy renderer pushes state snapshots to Vue, then replace the overview section markup in `App.vue` with Vue loops/conditionals.

**Consequences**: This keeps the migration small and consistent with existing patterns. The legacy state object still exists until later cleanup, but overview presentation becomes type-checkable and contract-testable in Vue.

## Out of Scope

* Backend `/api/overview` shape changes.
* Redesigning the overview page layout or table columns.
* Removing all legacy resource/action modules.
* Migrating expiring, double, keepalive, yuba, collect, login, or logs behavior further than needed for overview integration.

## Technical Notes

* Current overview markup lives in `src/docker/webui-src/App.vue`.
* Current legacy overview renderer lives in `src/docker/webui/app-pages.js`.
* Current resource bridge dispatches `douyu-keep-webui:overview` from `src/docker/webui-src/resources.ts`.
* Existing table HTML helpers are in `src/docker/webui/app-table-render.js`; the Vue migration should preserve their rendered semantics in Vue template form.
* Relevant frontend spec: `.trellis/spec/frontend/index.md`.
* Final verification passed: `npm run lint`, `npm run type-check:webui`, `npm run test:contracts`, and `npm test`.
