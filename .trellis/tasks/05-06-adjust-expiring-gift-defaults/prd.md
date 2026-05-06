# brainstorm: adjust expiring gift defaults

## Goal

Refine the newly added expiring-gift task defaults and WebUI wording so the task runs after the latest default double-card check and describes `model=1` as weight-based allocation instead of percentage allocation.

## What I already know

* User reviewed the local WebUI and found two product issues in the expiring-gift task.
* The expiring-gift task should run last because it consumes currently available glow sticks; the latest default double-card run is 23:20.
* The default expiring-gift check time should be daily 23:45.
* The expiring-gift threshold should remain 24 hours.
* `model=1` should be called "按权重", not "按百分比".
* The same wording applies to keepalive/saturation task allocation mode because the actual behavior treats values as weights.
* Current implementation uses `0 0 */6 * * *` as the expiring-gift default cron in config, WebUI defaults, and the Docker medal sync contract.
* Current WebUI still shows "按百分比" for keepalive and expiring-gift mode `1`.

## Assumptions

* "每天 23:45" should use the existing six-field cron format: `0 45 23 * * *`.
* This task should not change the underlying `model` enum or send allocation algorithm.
* Existing persisted configs should keep user-customized cron/mode values; only missing or invalid defaults should change.
* Double-card already uses "按权重" wording and should remain unchanged except where shared table labels still say "百分比".

## Open Questions

* None for this refinement.

## Requirements

* Change the default expiring-gift cron from every 6 hours to daily 23:45.
* Keep the expiring-gift threshold default at 24 hours.
* Keep expiring-gift default inactive unless the existing product behavior explicitly enables it elsewhere.
* Change WebUI mode `1` label for keepalive and expiring-gift from "按百分比" to "按权重".
* Change room table headers and helper/documentation text so `model=1` is described as weight/proportion, not literal percentage.
* Update `config.example.json` and the Docker medal sync contract to match the new cron and wording.
* Do not change fixed-count mode behavior.

## Acceptance Criteria

* [ ] A newly created/default expiring-gift config uses cron `0 45 23 * * *`.
* [ ] WebUI fallback/default expiring-gift cron displays `0 45 23 * * *`.
* [ ] Keepalive and expiring-gift mode `1` options show "按权重".
* [ ] `model=1` table column labels are "权重值" where applicable, not "百分比".
* [ ] Contract docs no longer describe expiring-gift/keepalive `model=1` as percentage.
* [ ] Lint and type-check pass.

## Definition of Done

* Lint / typecheck pass.
* Contract docs updated because default config/API payload behavior changes.
* Local WebUI can be rebuilt and restarted for manual review.

## Out of Scope

* Changing send allocation math.
* Changing double-card schedule.
* Changing live Douyu API behavior.
* Reworking the WebUI layout beyond wording/defaults.

## Technical Notes

* Likely affected code: `src/core/medal-sync.ts`, `src/docker/html.ts`, `config.example.json`, `.trellis/spec/guides/docker-medal-sync-contract.md`.
* Search found current expiring-gift cron in `config.example.json`, `src/core/medal-sync.ts`, `src/docker/html.ts`, and the Docker medal sync contract.
* Search found "按百分比" in `src/docker/html.ts` for keepalive and expiring-gift select options.
