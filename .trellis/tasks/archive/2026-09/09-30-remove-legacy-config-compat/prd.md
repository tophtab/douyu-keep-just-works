# Remove Legacy Config Compatibility

## Goal

End the old configuration compatibility window and maintain only the current format. Delete the entire README section titled `配置升级与回滚`.

## Background

The user considers the several-month upgrade window complete. Runtime and WebUI state already use `DockerConfig`; remaining legacy support lives in normalization, API validation, partial-update merging, and cookie-source update detection. Existing tests and specs still require migration behavior.

## Requirements

- R1: Read/update credentials only through `loginCookies.{passport,main,yuba}`. Remove configuration aliases `cookie`, `manualCookies`, and `manualPassport`, including the old `cookie` request alias on `/api/cookie`; retain its current `mainCookie`/`yubaCookie` fields.
- R2: Use only `enabled`, `allocationMode`, `roomAllocations` with `count`/`weight`, and `doubleCard.participatingRoomIds`. Remove interpretation of task/CookieCloud `active`, numeric `model`, `send`, allocation `number`, and double-card `enabled` room maps.
- R3: Stop replacing `0 0 8 */7 * *` with the current default. Preserve explicitly saved valid cron after trimming; missing/blank cron still receives the current default.
- R4: Preserve current-format normalization, default filling, ordering, partial updates, explicit cookie clearing, persistence, and API validation. Obsolete fields have no migration meaning; use existing unknown-field/default behavior without adding a legacy-field blacklist or migration error system.
- R5: Delete the README heading and all four bullets under `配置升级与回滚`. Update active specs and tests to describe current-format-only behavior.

## Acceptance Criteria

- [x] AC1 (R1, R2): Old fields do not supply credentials, enable jobs, choose allocation modes, populate allocations, select rooms, or overwrite current-format settings during partial updates.
- [x] AC2 (R2, R4): API validation rejects invalid current switches, cron and allocations; legacy double-card enabled maps are invalid, and old model/send/number fields cannot satisfy current allocation requirements.
- [x] AC3 (R3): The old cron remains unchanged; missing/blank cron uses `0 0 8 * * 3`.
- [x] AC4 (R4): The example config remains stable; current Cookie updates and authenticated config round trips preserve unspecified fields and allow explicit clearing. Disk loading/saving retains current values.
- [x] AC5 (R5): README contains none of the removed subsection; active specs no longer promise legacy config migration.
- [x] AC6: Lint, backend/frontend type checks, contract tests, and Docker application build pass.

## Out of Scope

- CookieCloud `cryptoType: 'legacy'` (a current encryption protocol), Yuba legacy signing, remote `DoubleCardInfo.active`, Vue/CSS state, internal allocation helper parameters, and manual Passport recovery using current credentials.
- New migration tools, compatibility warnings, or modification of local runtime `config/config.json`.
- Rewriting historical changelog entries or unrelated archived tasks/journals.

## Consequences

Old snapshots no longer recover settings through aliases; missing current fields receive defaults. Old API clients must send current fields. This is the intended compatibility removal, not a new startup rejection policy.

## Planning Status

The user approved the final planning summary with “开干”. Implementation and independent review are complete as of 2026-09-30. All acceptance criteria passed. The user subsequently authorized commit, finish-work, push, release 3.11.0 with changelog in GitHub Release, and inclusion of all existing Trellis modifications.

## Authorized Release Follow-up

Publish version 3.11.0 using the repository-required `v3.11.0` tag. Update CHANGELOG and GitHub Release notes, commit existing Trellis 0.6.17 changes separately, use `npm version` for synchronized package/lockfile version metadata, perform finish-work, then push master and the release tag. The user explicitly approved these actions; no additional permission gate remains. Preserve runtime configuration.
