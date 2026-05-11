# fix gift expiry time display

## Goal

Make Docker WebUI date/time rendering human-readable when showing gift expiry and related task timestamps, avoiding raw ISO fallback strings such as `2026-05-11T15:59:59.000Z`.

## What I already know

* The user reported the expiring gift backpack table showing `2026-05-11T15:59:59.000Z`.
* The user prefers a compact display such as `2026-05-11T15:59:59` or `2026-05-11 16:00`; this task will use the cleaner `YYYY-MM-DD HH:mm` display.
* `src/docker/webui/app.js` has a shared `formatDate()` helper used by gift expiry, overview gift expiry, task status timestamps, log timestamps, and other UI date fields.
* `formatDate()` currently tries `Intl.DateTimeFormat` with `Asia/Shanghai`, then falls back to `date.toISOString()`, which leaks the raw machine format when `Intl` formatting fails.
* Existing project contracts say Docker WebUI timestamps should use Shanghai-time display.

## Assumptions

* Compact minute precision is acceptable for UI display; exact seconds are not required in these status tables.
* Invalid or non-date values should continue to be shown as the original value rather than hidden.
* Missing values should continue to display `无`.

## Requirements

* Render valid dates as `YYYY-MM-DD HH:mm`.
* Keep the display timezone aligned with `Asia/Shanghai`.
* Do not fall back to `.toISOString()` for user-facing date display.
* Keep the change scoped to Docker WebUI display formatting.

## Acceptance Criteria

* [ ] `formatDate(1776614399000)` returns a compact `YYYY-MM-DD HH:mm` style string.
* [ ] The expiring gift backpack table no longer shows `.000Z` for valid expiry timestamps.
* [ ] Missing values still render as `无`.
* [ ] Invalid date values still render as their original string.
* [ ] Docker build or relevant validation passes.

## Definition of Done

* Tests or focused validation updated/run where appropriate.
* Lint / typecheck / build validation considered.
* No unrelated UI or config behavior changes.

## Out of Scope

* Changing backend timestamp payload shape.
* Changing Douyu expiry parsing or gift selection logic.
* Adding new frontend dependencies.

## Technical Notes

* Relevant file: `src/docker/webui/app.js`.
* Relevant specs: `.trellis/spec/frontend/index.md`, `.trellis/spec/backend/directory-structure.md`, `.trellis/spec/backend/quality-guidelines.md`.
* Related contract: `.trellis/spec/guides/docker-medal-sync-contract.md` says WebUI gift expiry and overview/task statuses use Shanghai-time display.
