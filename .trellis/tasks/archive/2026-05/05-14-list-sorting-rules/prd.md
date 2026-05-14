# Update list sorting rules

## Goal

Change user-facing list ordering so fan-badge related lists prioritize the current intimacy progress, and backpack detail rows prioritize larger quantities.

## What I Already Know

* Fan-badge rows currently sort by `level` descending in `src/core/api.ts`.
* Overview, keepalive, double-card, and expiring-gift room tables consume the shared fan list/status order without applying their own sort.
* Backpack detail rows currently preserve Douyu API response order and are displayed directly by the expiring-gift WebUI table.
* The user wants fan-badge related lists sorted by the `aa` part of intimacy formatted as `aa/bb`, descending.
* The user wants backpack detail rows sorted by quantity, descending.

## Assumptions

* If intimacy is malformed or missing, it should sort as `0` rather than fail the refresh.
* Equal sort keys may keep JavaScript's stable input order; no secondary tie-breaker is required.
* Sorting in shared core data functions is preferred so all current and future consumers receive a consistent order.

## Requirements

* Fan-badge related lists are sorted by parsed current intimacy value descending.
* Intimacy parsing supports values like `123/1000`; the `123` part is the sort key.
* Backpack detail rows are sorted by numeric `count` descending.
* Existing API response shapes and UI table columns remain unchanged.

## Acceptance Criteria

* [ ] `getFansList` returns fans sorted by intimacy current value descending.
* [ ] Fan-badge WebUI tables inherit the new fan order without duplicated page-level sorting.
* [ ] `getBackpackStatus` returns `rows` sorted by count descending.
* [ ] Focused contract/unit tests cover both sorting rules.
* [ ] Lint and type-check pass.

## Definition of Done

* Tests added or updated for changed behavior.
* Lint and TypeScript checks pass.
* No unrelated refactors or UI layout changes.

## Out of Scope

* User-configurable sorting.
* Changing fish-bar list ordering.
* Changing table columns or display text.

## Technical Notes

* Relevant specs read: backend quality, frontend state management/type safety/quality, cross-layer guide, contributing Docker-first guidance.
* Data flow: Douyu API/HTML -> `src/core/api.ts` normalized arrays -> Docker runtime cache/status -> WebUI resource state -> page table rows.
