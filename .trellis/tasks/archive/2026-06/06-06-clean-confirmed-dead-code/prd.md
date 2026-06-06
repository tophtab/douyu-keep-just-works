# Clean Confirmed Dead Code

## Goal

Remove code that was confirmed unused during the dead-code audit, without changing runtime behavior.

## What I Already Know

- The audit found no unused source files when Knip was run with explicit backend and WebUI entries.
- Confirmed cleanup candidates are unused CSS selectors, unused WebUI helpers, one legacy task type guard, one obsolete core type, and one CookieCloud LTP0 helper superseded by full passport cookie material.
- The repository is a Node 24 / TypeScript / Vue single-repo with separate Docker backend and WebUI type-check configs.

## Requirements

- Remove unused CSS:
  - `.task-grid` and its responsive rule.
  - `.split-inline`, `.split-inline-copy`, `.split-inline-actions`, and their responsive rules.
  - `.overview-table-note`.
  - `.muted`.
- Remove unused WebUI helpers:
  - `getAllocationModel` and its private `AllocationConfig` interface.
  - `formatRatioPercent`.
  - `WEBUI_TASK_TYPES` and `isWebUiTaskType`.
- Remove obsolete core type:
  - `Config` from `src/core/types.ts`.
- Remove obsolete CookieCloud helper:
  - `getCookieCloudPassportLtp0`.
  - Keep `getCookieCloudPassportCookie` as the passport cookie material API.
  - Update tests that explicitly assert the old LTP0 helper exists.

## Acceptance Criteria

- [ ] Removed symbols and CSS selectors no longer appear in production source unless as unrelated text.
- [ ] CookieCloud passport tests cover full passport cookie material and no longer depend on `getCookieCloudPassportLtp0`.
- [ ] `npm run lint` passes.
- [ ] `npm run type-check` passes.
- [ ] `npm run test:contracts` passes.
- [ ] Explicit-entry dead-code recheck has no remaining findings for the cleaned items.

## Out of Scope

- No behavioral changes to task scheduling, cookie recovery, or WebUI layout.
- No broad refactors beyond deleting the confirmed unused items.
- No new dead-code tooling configuration unless required to verify this cleanup.

## Technical Notes

- Relevant frontend files: WebUI CSS, `allocation-task.ts`, and `task-shared.ts`.
- Relevant backend/core files: `src/core/types.ts`, `src/core/cookie-cloud.ts`.
- Relevant tests: `test/douyu-passport-contract.test.js`, `test/project-maintenance-contract.test.js`.
