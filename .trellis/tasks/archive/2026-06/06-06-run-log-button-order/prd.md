# Swap Run Log Button Order

## Goal

On the run log page, swap the display order of the two action buttons "手动刷新" and "清空日志" while preserving their existing behavior and state handling.

## What I Already Know

- The user requested that the "手动刷新" and "清空日志" buttons on the run log page switch order.
- The target component is `src/docker/webui/components/LogsPage.vue`.
- The current order is "手动刷新" followed by "清空日志".
- The frontend is the Vue/Vite Docker WebUI under `src/docker/webui/`.

## Requirements

- Display "清空日志" before "手动刷新" in the run log page action row.
- Keep each button's existing click handler, disabled state, aria-busy binding, styling class, and text unchanged.
- Do not change log loading, clearing, or auto-refresh behavior.

## Acceptance Criteria

- [x] In `LogsPage.vue`, the clear-log button appears before the manual-refresh button in the template.
- [x] Existing frontend lint and type-check checks still pass.

## Out of Scope

- Changing button labels, styles, layout CSS, or runtime log behavior.
- Changing the auto-refresh control.

## Technical Notes

- Inspected `src/docker/webui/components/LogsPage.vue`.
- Relevant specs are under `.trellis/spec/frontend/`.
