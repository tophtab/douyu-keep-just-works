# brainstorm: simplify expiring backpack table labels

## Goal

Simplify the expiring backpack detail table in the Docker WebUI so the automatic release column is concise and does not show per-row skip reasons.

## What I already know

* User reviewed the WebUI manually and found the skip reason text unnecessary.
* The current table shows `会释放` / `跳过` plus a helper reason such as `未进入阈值`.
* User wants the cell labels to be exactly `释放` / `跳过`, removing the `会` character.
* This is a UI wording/layout cleanup only; expiring candidate selection and job logging should not change.

## Assumptions

* The `临期` column remains visible and still shows whether a row is inside the current threshold.
* The top summary can continue to show candidate row count and budget count.
* Internal row classification may keep enough state for rendering, but skip reason text must not be displayed in the table.

## Requirements

* In the expiring backpack detail table, remove the displayed skip/release reason helper text.
* Change the automatic release column header from `自动释放 / 跳过原因` to `自动释放`.
* Change the positive status label from `会释放` to `释放`.
* Keep the negative status label as `跳过`.
* Do not change backend expiring candidate selection, auto-send whitelist, logs, or send budgeting behavior.

## Acceptance Criteria

* [ ] The table cell only displays `释放` or `跳过` for automatic release status.
* [ ] No skip reason helper text appears in each row.
* [ ] The table header no longer mentions `跳过原因`.
* [ ] Existing threshold and candidate count behavior remains unchanged.
* [ ] Lint / type-check pass.

## Definition of Done

* `npm run lint` passes.
* `npm run type-check` passes.
* Docker WebUI build remains valid.

## Out of Scope

* Changing the expiring gift business logic.
* Changing job logs.
* Changing non-WebUI API payloads.

## Technical Notes

* Likely affected file: `src/docker/html.ts`.
* Current strings found around `buildBackpackRowsTable()` and `describeBackpackRow()`.
