# Fix Backend Logic Review Findings

## Goal

Fix the two backend logic issues identified in review while intentionally leaving the default WebUI password behavior unchanged per user confirmation.

## What I Already Know

* User confirmed the default password is acceptable and should not be changed.
* `loadGiftNumber()` currently converts backpack lookup failures into `0`, which makes external failures look like empty inventory.
* `executeDoubleCardJob()` currently lets one `checkDoubleCard()` failure abort the whole double-card task.
* Backend conventions require external effects to be explicit, avoid silently converting upstream failures into normal domain values, and keep the job loop resilient where one room fails.

## Requirements

* Preserve current `WEB_PASSWORD || 'password'` behavior.
* Change keepalive / double-card glow-stick flows so backpack lookup failures do not look like `0` glow sticks.
* Keep legitimate `0` glow-stick inventory as a normal early exit.
* Change double-card room detection so a failed room-level double-card lookup is logged and skipped while other rooms continue.
* Keep `/api/fans/status` partial degradation behavior unchanged.
* Keep changes scoped to backend/core logic unless compilation requires small type updates.

## Acceptance Criteria

* [ ] A failed backpack lookup during keepalive or glow-stick double-card execution is logged as a task failure/error path, not as "荧光棒数量为0".
* [ ] A legitimate successful backpack response with zero glow sticks still logs zero and exits normally.
* [ ] Double-card task continues checking and can still send to other active double-card rooms when one room's double-card lookup fails.
* [ ] No full cookies or secrets are added to logs or responses.
* [ ] `npm run lint`, `npm run type-check`, and `npm test` pass.

## Out of Scope

* Changing default WebUI password behavior.
* Removing or changing `/api/config/raw`.
* Adding a new automated test framework.

## Technical Notes

* Likely files: `src/core/job.ts`, possibly `src/core/types.ts`.
* Relevant specs: backend error handling, quality guidelines, logging guidelines, directory structure.
