# brainstorm: release all expiring backpack gifts

## Goal

Fix the expiring gift task so every backpack gift row with a positive count and an absolute expiry inside the configured threshold is included in automatic release, not only glow sticks `id=268`.

## Why

The previous precise-release implementation kept the conservative MVP rule that only glow sticks are automatically sent. User clarified the latest intended behavior is broader: if a gift is expiring and can be sent through the existing Douyu send endpoint by `giftId`, it should be released instead of wasted.

## What I already know

* Current backpack parsing already normalizes row-level `giftId`, `name`, `count`, and absolute `expireTime`.
* Current expiring selection still uses `autoSendGiftIds: [GLOW_STICK_GIFT_ID]`, which excludes non-glow-stick gifts.
* Current WebUI wording says default automatic release only handles glow sticks.
* Current send endpoint posts `prop_id` from `SendGift.giftId`, so the transport already accepts a per-job `giftId`.
* Existing allocation helpers operate on a total count and room send config. For multiple gift IDs, the task should compute room allocation once per gift ID/count group, setting each generated job's `giftId` to that group.

## Assumptions

* A gift row is eligible when `count > 0`, absolute `expireTime` exists, and `expireTime - now <= thresholdHours`.
* There is no additional gift allowlist for this task.
* Rows without absolute expiry are not released.
* The UI should not say "default only glow sticks" anymore.
* The send API still cannot target a specific backpack batch; actual deduction order remains controlled by Douyu.

## Requirements

* Remove the expiring gift auto-send whitelist behavior.
* Include all positive-count backpack rows with normalized absolute expiry inside threshold.
* Keep skip counters for not-expiring and no-expiry rows; remove or zero the "unsafe/not whitelisted" concept for this task.
* Group expiring candidate counts by `giftId`.
* For each `giftId`, compute room send jobs using the existing expiring task room allocation settings.
* Ensure generated jobs send the candidate `giftId`, not always `268`.
* Logs should mention each gift name/ID and count being released.
* WebUI should mark any expiring gift row as `释放`, not only `268`.
* WebUI should not show a skip/release reason column or row-level reason text for expiring backpack rows.
* WebUI wording should describe all expiring gifts, not glow-stick-only behavior.
* Do not change keepalive, double-card, collect-gift, or yuba behavior.

## Acceptance Criteria

* [ ] A non-268 gift row with count > 0 and expiry inside threshold is selected for release.
* [ ] A non-268 expiring row displays `释放` in WebUI.
* [ ] Generated send jobs use the candidate row's `giftId`.
* [ ] Multiple candidate gift IDs are sent as separate gift groups using the configured room allocation.
* [ ] Non-expiring rows still display `跳过`.
* [ ] Rows without absolute expiry are not released.
* [ ] UI no longer says automatic release is limited to glow sticks.
* [ ] Lint / type-check / Docker build pass.

## Definition of Done

* `npm run lint` passes.
* `npm run type-check` passes.
* `npm run build:docker` passes.

## Out of Scope

* Proving Douyu deduction order for a specific backpack batch.
* Adding per-gift allowlist configuration.
* Adding a separate target room configuration per gift type.

## Technical Notes

* Likely affected files: `src/core/job.ts`, `src/docker/html.ts`, and possibly `src/core/types.ts`.
* Related archived task: `.trellis/tasks/archive/2026-05/05-06-precise-expiring-gift-release/prd.md`.
