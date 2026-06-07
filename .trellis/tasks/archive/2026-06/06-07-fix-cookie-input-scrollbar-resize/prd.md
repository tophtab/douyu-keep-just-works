# Fix cookie input scrollbar and resize behavior

## Goal

Make the login Cookie textareas visually consistent with the rest of the Docker WebUI by using the same scrollbar styling as other scrollable surfaces and preventing users from resizing the Cookie inputs vertically.

## What I already know

* The issue is on the login Cookie input fields.
* `LoginConfigPage.vue` renders three Cookie `<textarea>` fields.
* `styles/components.css` applies `resize: vertical` to all textareas.
* Existing scrollable surfaces include the page, tables, and log boxes.

## Assumptions

* Cookie textareas should remain scrollable when pasted Cookie content exceeds the visible height.
* The fix should preserve existing labels, bindings, placeholders, and save behavior.
* The change should stay in the Vue/Vite Docker WebUI source under `src/docker/webui/`.

## Requirements

* The three login Cookie textareas must not expose a manual resize handle.
* The Cookie textareas must keep a stable height across desktop and mobile layouts.
* Cookie textarea scrollbars must visually match the WebUI scrollbar treatment.
* Existing form behavior, v-model bindings, accessibility labels, and actions must remain unchanged.

## Acceptance Criteria

* [x] Main, yuba, and passport Cookie textareas cannot be resized vertically by the browser resize handle.
* [x] Overflowing Cookie text still scrolls inside the textarea.
* [x] Cookie textarea scrollbars use the same color and track style as other WebUI scrollbars.
* [x] The login form layout remains stable at desktop and mobile widths.
* [x] Frontend lint and WebUI type-check pass, or any inability to run them is documented.

## Definition of Done

* Read relevant frontend specs before editing.
* Keep the change focused to component markup/classes and global WebUI CSS.
* Run frontend verification commands appropriate for a CSS/Vue visual fix.
* Record whether a spec update is needed.

## Out of Scope

* Changing Cookie save, validation, CookieCloud, or QR login behavior.
* Redesigning the login page layout.
* Changing backend config or API contracts.

## Technical Notes

* Relevant files found by repo inspection:
  * `src/docker/webui/components/LoginConfigPage.vue`
  * `src/docker/webui/styles/components.css`
  * `src/docker/webui/styles/base.css`
  * `src/docker/webui/styles/tables.css`
* Frontend guidelines read:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/directory-structure.md`
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/frontend/hook-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/type-safety.md`
  * `.trellis/spec/guides/index.md`
  * `.trellis/spec/guides/code-reuse-thinking-guide.md`
