# Rename Double Allocation Mode To Proportional

## Goal

Rename the current double-card allocation mode wording from percentage-based language to proportion-based language so the UI matches the actual behavior, explain the allocation rule clearly for users, and remove the special `-1` sentinel from the double-card flow if the new mode no longer needs it.

## What I already know

* The user wants "双倍任务分配模式" renamed from percentage wording to "按比例".
* The user wants the UI/help text to explain how this mode distributes gifts in practice.
* The user wants other user-facing "百分比" wording in this related flow changed to "按比例".
* The user expects the ratio mode to no longer need the `-1` value.
* Existing shared logic in `src/core/gift.ts` already behaves like proportional redistribution for double-card rooms:
  * 0 double rooms: skip sending
  * 1 double room: send all to that room
  * 2+ double rooms: redistribute only among active double rooms using their original weights
* Desktop config UI still exposes `百分比`, validates sum-to-100, and still documents `-1`.
* Docker WebUI still exposes `按百分比` and explains the logic in percentage terms.

## Assumptions (temporary)

* The rename primarily targets the double-card task and its related explanations first.
* Keepalive fixed-number mode should remain unchanged unless the user wants the wording broadened there too.
* Removing `-1` applies to the double-card ratio/proportional flow; fixed-number mode semantics may need a separate decision if they are still exposed in the same page.

## Requirements (evolving)

* Rename double-card mode label from percentage wording to proportion wording.
* Update help/description text to explain the actual proportional redistribution behavior.
* Replace related user-facing "百分比" wording in this flow with "按比例" wording.
* Remove the `-1` explanation/value path from the double-card ratio flow.
* Change double-card ratio input from "sum to 100" percentage entry to true proportional weights.
* Add helper UX on the double-card page so users can configure ratios faster and understand the result.
* Keep keepalive semantics unchanged unless a tiny shared-copy fix is required to avoid contradictions.
* Keep the actual redistribution semantics consistent with the current backend unless requirements explicitly change.

## Acceptance Criteria (evolving)

* [ ] Double-card mode label uses "按比例" instead of percentage wording.
* [ ] Double-card help text explains 0-room / 1-room / multi-room behavior in plain language.
* [ ] Related user-facing wording in the touched double-card flow no longer says "百分比".
* [ ] The double-card flow no longer relies on or documents `-1`.
* [ ] Double-card ratio values no longer need to sum to `100`.
* [ ] The double-card page shows a ratio preview and at least one fast-fill helper action.
* [ ] Saved configs still validate correctly and preserve current redistribution semantics unless intentionally changed.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* Reworking unrelated branding / README tasks
* Changing Douyu API behavior
* Renaming keepalive mode semantics just for terminology consistency
* Rebuilding the entire task model beyond the selected double-card UX improvements

## Technical Approach

Treat double-card mode `1` as proportional weights instead of literal percentages:

* UI accepts any non-negative numeric weight
* Validation requires at least one enabled room with a positive weight
* Runtime keeps the same redistribution rule:
  * no active double rooms -> do not send
  * exactly one active double room -> send all
  * multiple active double rooms -> normalize their saved weights and redistribute
* Docker WebUI adds:
  * clearer explanatory copy
  * ratio preview for enabled rooms
  * quick action to set all enabled rooms to `1`

Desktop config should only receive wording/validation changes if needed to keep shared semantics coherent.

## Decision (ADR-lite)

**Context**: The old "百分比" wording suggests a literal 0-100 percentage split, but the double-card task already behaves like weighted redistribution among currently active double rooms. That mismatch makes the feature harder to understand, and `-1` reads like an implementation detail rather than a product concept.

**Decision**: For double-card mode, adopt a true "按比例" model with weight inputs and add helper UX. Keep keepalive semantics unchanged. Only change shared wording outside the double-card flow if needed to avoid contradictory copy.

**Consequences**: Existing saved values remain usable as weights, so migration risk stays low. Validation and UI copy must be updated together across the WebUI and any touched desktop/shared surfaces. Keepalive remains semantically distinct, which is more accurate but means the product will intentionally use different terms for different tasks.

## Technical Notes

* Files already identified:
  * `src/core/gift.ts`
  * `src/docker/html.ts`
  * `src/docker/server.ts`
  * `src/core/medal-sync.ts`
  * `src/core/types.ts`
  * `src/renderer/views/config/index.vue`
  * `README.md`
* Current desktop validation still enforces percentage sum equals 100 and allows a single `-1` in fixed-number mode.
* Current Docker WebUI copy already describes normalized redistribution, which is semantically closer to "按比例" than "按百分比".
