# Auto-save Task Toggles On Enable

## Goal
Make Docker WebUI task switches persist immediately when toggled on, so a page refresh does not revert the visual state back to disabled.

## Requirements
- Enabling the collect-gift switch must save and enable the task immediately.
- Enabling the keepalive switch must save and enable the task immediately.
- Enabling the double-card switch must save and enable the task immediately.
- Disabling each switch must keep the current behavior of saving immediately.
- Existing save buttons must continue to work.

## Acceptance Criteria
- [ ] Toggling any task switch on sends a save request without requiring the user to click the save button.
- [ ] Refreshing the page after enabling a task keeps the switch in the enabled state.
- [ ] Toggling any task switch off still disables the task immediately.
- [ ] Existing save-button flows still succeed for collect-gift, keepalive, and double-card.

## Technical Notes
- The change is scoped to the Docker WebUI client logic in `src/docker/html.ts`.
- Reuse the existing save and disable helpers instead of introducing a parallel request path.
