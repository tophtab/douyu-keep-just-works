# Clean WebUI Explanatory Copy

## Goal

Remove low-value explanatory copy from the Docker WebUI so the pages focus on controls, task status cards, tables, and actionable feedback.

## What I Already Know

* The user wants the repeated copy such as "当前已同步...", "当前已勾选...", "手填 passport Cookie...", and similar descriptive paragraphs removed.
* The confirmed scope is to remove explanatory copy only.
* Keep page titles, field labels, buttons, data tables, error messages, and empty-state guidance.
* The affected frontend lives under `src/docker/webui/` and uses Vue single-file components plus sibling composables.

## Requirements

* Remove static explanatory paragraphs from overview, login, CookieCloud, collect, and similar task pages.
* Remove normal/success-state status summaries such as synced room counts, selected double rooms, loaded Yuba counts, and generic "displaying previous result" copy where they are shown only as page notes.
* Remove task switch note copy for keepalive, double, expiring gift, and Yuba check-in switches.
* Remove the double-card "分配说明" explanatory block while preserving allocation controls and preset buttons.
* Preserve actual data presentation, task status cards, form controls, actions, validation/error feedback, and empty states.
* Do not change backend APIs, persisted config shape, cookie logic, task scheduling, or runtime task behavior.

## Acceptance Criteria

* [ ] The named explanatory strings no longer appear in the WebUI source.
* [ ] Error and empty-state guidance remains available where a user needs action or troubleshooting.
* [ ] Docker WebUI lint and TypeScript checks pass.
* [ ] Existing contract tests pass or are updated only where they asserted removed explanatory copy.

## Out of Scope

* Visual redesign beyond natural spacing cleanup caused by removing text.
* Backend behavior changes.
* New components, dependencies, or state-management patterns.

## Technical Notes

* Likely component files: `OverviewPage.vue`, `LoginConfigPage.vue`, `CollectPage.vue`, `KeepalivePage.vue`, `DoublePage.vue`, `ExpiringPage.vue`, `YubaPage.vue`.
* Likely composables: `overview.ts`, `keepalive.ts`, `double.ts`, `expiring.ts`, `yuba.ts`, and possibly `cookie-source-copy.ts`.
* Existing frontend specs require Vue-owned declarative templates, existing global styles, no legacy bridge behavior, and `npm run lint` plus `npm run type-check:webui` for frontend changes.
