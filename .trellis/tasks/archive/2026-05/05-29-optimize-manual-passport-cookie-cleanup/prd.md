# Optimize Manual Passport Cookie Cleanup

## Goal

Tighten the manual passport cookie cleanup found during review without changing behavior: reduce unnecessary secret retention, make the WebUI raw-vs-masked save handling clearer, and unify user-facing wording.

## What I already know

* The previous finish changed manual recovery from `manualPassport.ltp0` to visible `manualPassport.cookie`.
* Review found no blocking correctness issue; lint, type-check, contract tests, and Docker build passed.
* Three low-risk cleanup points remain:
  * `PassportRecoveryMaterial.cookie` is not used after parsing.
  * `saveManualPassport` intentionally restores the raw local textarea value because `/api/config` returns masked secret values.
  * One diagnostics string still says `passport/LTP0` while the rest of the UI says `passport Cookie`.

## Assumptions

* Behavior should remain unchanged.
* No public API shape changes.
* No new tests are required unless existing contract coverage needs wording updates.

## Requirements

* Remove unused raw cookie retention from `PassportRecoveryMaterial`.
* Clarify or centralize the WebUI handling that applies a raw locally-entered passport cookie after a masked config save response.
* Change the diagnostics label from `passport/LTP0` to `passport Cookie`.
* Keep existing recovery behavior and masking contract intact.

## Acceptance Criteria

* [ ] Runtime recovery still parses `LTP0` and `dy_did` from passport cookie material.
* [ ] WebUI still leaves the saved passport cookie visible in the textarea after saving.
* [ ] User-facing manual passport labels consistently say `passport Cookie`.
* [ ] `npm run lint`, `npm run type-check`, relevant tests, and Docker build pass.

## Definition of Done

* Focused code cleanup implemented.
* Quality checks pass.
* No behavior or schema changes beyond wording cleanup.

## Out of Scope

* Changing safeAuth retry behavior.
* Changing config API masking policy.
* Adding new recovery material fields.

## Technical Notes

* Runtime recovery: `src/docker/runtime-cookie-recovery.ts`.
* WebUI cookie page state: `src/docker/webui/cookie.ts`.
* Existing contracts: `.trellis/spec/backend/error-handling.md`, `.trellis/spec/backend/database-guidelines.md`, `.trellis/spec/frontend/state-management.md`.
