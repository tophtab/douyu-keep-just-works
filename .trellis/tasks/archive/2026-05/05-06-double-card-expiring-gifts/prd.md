# brainstorm: double-card expiring gifts

## Goal

Extend the double-card task with a configurable gift scope so it can use glow sticks only or all limited-time gifts.

## Why

Double-card gifting should make better use of gifts that will expire, while still preserving the existing double-card behavior of sending only when eligible rooms have an active double card.

## What I already know

* Current double-card execution loads only the glow-stick count through `loadGiftNumber()`.
* Current double-card allocation uses `computeGiftCountWithDoubleCard()` to send all available budget to active double-card rooms.
* Current expiring-gift execution already loads backpack rows, selects rows with positive count and absolute `expireTime`, groups counts by `giftId`, and sets generated jobs to the candidate `giftId`.
* Backpack rows already expose `giftId`, `name`, `count`, and `expireTime`.
* The send endpoint accepts `giftId` per generated job via `prop_id`.
* Current backpack lookup requests `https://www.douyu.com/japi/prop/backpack/web/v5?rid={roomid}` first, with a v1 fallback.
* In observed backpack responses, `met` is the absolute expiry timestamp source.
* Non-glow-stick gifts can be sent through the existing send endpoint by `giftId`.
* Existing glow-stick-only behavior should remain the default and continue using the current glow-stick count path.

## Assumptions (temporary)

* Gifts without an absolute `expireTime` should not be included in the "limited-time gifts" part of the double-card gift budget.
* The task should keep checking room double-card state before sending.
* Actual Douyu backpack deduction order cannot be controlled beyond `giftId`; exact batch targeting remains out of scope.
* The default scope should preserve existing behavior: `全部荧光棒`.

## Open Questions

* None currently.

## Requirements (evolving)

* Add a double-card gift scope option with these modes:
  * `全部荧光棒`: current behavior, send the available glow-stick budget.
  * `限时礼物`: send every positive-count backpack gift row with an absolute `expireTime`. This includes glow sticks when they have an absolute expiry.
* The "限时礼物" mode must include all positive-count rows with an absolute expiry, regardless of how far in the future the expiry is.
* The default selected scope in config and UI must be `全部荧光棒`.
* WebUI should add only one double-card setting: a gift-scope dropdown.
* Reuse the backpack row parsing and per-`giftId` grouping approach from the expiring-gift task for non-glow-stick gift groups.
* In `限时礼物` mode, each `giftId` must be handled as its own group; run double-card allocation separately per gift group.
* Keep double-card room filtering: no active double-card rooms means no gift send.
* Generated send jobs must use the candidate gift's `giftId`, not always glow-stick `268`.
* Logs should identify the gift name/ID and count for each gift group sent by the double-card task.
* Do not change keepalive, collect-gift, yuba, or the expiring-gift task behavior as part of this task.

## Acceptance Criteria (evolving)

* [ ] Existing configs without the new scope continue to behave as `全部荧光棒`.
* [ ] New default double-card config uses `全部荧光棒`.
* [ ] In `限时礼物` mode, every positive-count backpack gift row with absolute expiry is selected even if it is not inside a near-expiry threshold.
* [ ] Generated double-card send jobs use the candidate row's `giftId`.
* [ ] Multiple candidate gift IDs are handled as separate gift groups.
* [ ] No gifts are sent when no configured room currently has an active double card.
* [ ] Gifts without absolute expiry are not included.
* [ ] WebUI exposes a single double-card gift-scope dropdown and no extra per-gift controls.
* [ ] Lint / type-check pass.

## Definition of Done

* `npm run lint` passes.
* `npm run type-check` passes.
* Docker build impact is considered and run if Docker WebUI/runtime files change.

## Out of Scope

* Controlling which exact backpack batch Douyu deducts.
* Per-gift room targeting.
* Changing unrelated task behavior.

## Technical Notes

* Likely affected files: `src/core/job.ts`, `src/core/gift.ts`, `src/core/types.ts`, `src/docker/html.ts`, and possibly config defaults in `src/core/medal-sync.ts`.
* Current double-card flow is in `executeDoubleCardJob()`.
* Current reusable backpack candidate/grouping logic is in `selectExpiringGiftCandidates()`.
