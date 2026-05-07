# WebUI accessibility and polish fixes

## Goal

Improve the Docker WebUI accessibility and interface polish based on the Web Interface Guidelines review, while preserving the current one-file Docker WebUI architecture and the current "clear logs immediately" behavior.

## What I already know

* The supported WebUI is generated from `src/docker/html.ts`.
* The UI is plain HTML/CSS/JavaScript served by Express; there is no active Vue/Vite renderer.
* The user explicitly said not to add confirmation or undo behavior to "clear logs".
* The current review found one concrete rendering bug: a dynamic empty-state string uses curly attribute quotes.
* The most important remaining issues are focus visibility, accessible names for icon/switch/table controls, live-region announcements, theme metadata, reduced-motion handling, and form attribute polish.
* Follow-up list review found room to improve table/list scanability, especially long text handling, numeric alignment, mobile readability, and task-specific column emphasis.
* The user specifically requested swapping the "序号" and "参与" columns in the double-card list so participation comes first.

## Requirements

* Fix the dynamic empty-state HTML that uses curly quotes so the generated class and data-action attributes parse correctly.
* Add visible `:focus-visible` styles for buttons, tab buttons, switch controls, and other interactive controls that currently rely on hover/active only.
* Add accessible announcements for toast/status feedback with `aria-live` or an equivalent semantic live-region pattern.
* Add accessible names for switch controls and dynamically generated table checkbox/number inputs.
* Improve tab navigation semantics using appropriate ARIA attributes, without changing the visible navigation model.
* Add dark/light theme metadata improvements such as `theme-color` and `color-scheme` where appropriate.
* Add `prefers-reduced-motion` handling for the small UI transitions/transforms.
* Improve form metadata where low-risk: meaningful `name`, accurate input types, autocomplete behavior, spellcheck where appropriate, and numeric constraints.
* Replace loading ellipses `...` with `…` in user-visible loading text touched by this work.
* Improve list/table scanability without a full redesign:
  * Use tabular numeric alignment for tables/log timestamps and numeric comparison columns.
  * Tighten table/list visual rhythm: headers and body cells should share predictable padding, numeric/control columns should align consistently, and row height should feel compact but not cramped.
  * Avoid inappropriate truncation of key text such as streamer/fish-bar/gift names and row-level errors.
  * Improve mobile readability for status/detail lists where horizontal scrolling is currently the only option.
  * Keep configuration tables usable for editing and avoid changing saved config behavior.
* In the double-card configuration table, swap the first two columns so "参与" appears before "序号".

## Acceptance Criteria

* [ ] `src/docker/html.ts` no longer contains curly attribute quotes in generated HTML.
* [ ] Keyboard focus is visibly clear on navigation, buttons, switches, and key form controls.
* [ ] Toast messages are announced through a live region.
* [ ] Switches and dynamic table inputs have useful accessible names.
* [ ] Theme metadata and reduced-motion behavior are present.
* [ ] List/table rows are easier to scan: key text is not blindly truncated, numeric values align, and small screens have a readable representation where practical.
* [ ] Table/list alignment and row spacing feel consistent across overview, keepalive, double-card, expiring-gift, yuba, backpack, and logs views.
* [ ] In the double-card configuration table, "参与" is the first column and "序号" is the second column.
* [ ] "Clear logs" continues to execute without confirmation and without undo.
* [ ] `npm run lint` passes.
* [ ] `npm run type-check` passes.

## Definition of Done

* Keep edits scoped to Docker WebUI code and relevant task documentation.
* Do not introduce a frontend framework, build step, new runtime dependency, modal system, or large refactor.
* Preserve existing routes, API payloads, scheduling behavior, and saved config shape.
* Run lint and type-check before handing off.

## Out of Scope

* Adding confirmation or undo to clearing logs.
* Rebuilding the WebUI in React/Vue or splitting it into a new frontend app.
* Changing backend route behavior or task execution semantics unless required for compile correctness.
* Visual redesign beyond the polish needed for accessibility and guideline compliance.

## Technical Notes

* Primary file: `src/docker/html.ts`.
* Frontend spec says current UI changes should treat `src/docker/html.ts` as Docker runtime code and read backend runtime/quality guidance.
* Relevant review source: <https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md>
* Persisted review notes: `research/web-interface-guidelines-review.md`.
