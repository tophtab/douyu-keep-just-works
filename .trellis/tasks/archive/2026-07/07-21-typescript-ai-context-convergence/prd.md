# Converge TypeScript Contracts and AI Maintenance Context

## Goal

Keep the TypeScript/Vue stack while completing only the parameter and contract changes that reduce misuse and AI maintenance context. Public configuration, API, persistence, runtime state, and WebUI payloads must have clear ownership and one canonical shape after the input boundary.

Success is measured by fewer ambiguous representations, bounded consumer lists, and less cross-layer context for common changes. It is not measured by repository-wide naming consistency or mechanical code cleanup.

## Background

- The stable implementation baseline is `master@c0bcd29`.
- The incomplete prior migration is preserved at `wip/ts-normalize-parameter-names-order@0a963e1`. It is a source of migration cases and failure evidence, not a patch to merge.
- A Go rewrite was rejected because it would not reduce the domain surface, would duplicate contracts across Go and Vue, and would increase the code an AI must understand.
- The application currently uses the npm `cron` six-field dialect (`second minute hour day month weekday`). This dialect remains unchanged.
- The keepalive default is intentionally changed from the calendar-day expression `0 0 8 */7 * *` to every Wednesday at 08:00 in `Asia/Shanghai`: `0 0 8 * * 3`.

## Requirements

- R1. `DockerConfig` and normal WebUI state contain only the canonical shape. Legacy fields are accepted only by disk/API boundary input types and normalization.
- R2. Canonical top-level serialized order is `loginCookies`, `cookieCloud`, `ui`, `collectGift`, `keepalive`, `doubleCard`, `expiringGift`, `yubaCheckIn`.
- R3. Login credentials use `loginCookies: { passport, main, yuba }` in that order. Existing `passportCookie`, `mainCookie`, and `yubaCookie` runtime/local ref names may remain where they are already clear.
- R4. Configured switches use `enabled`. `active` remains only for actual runtime state, active tabs, CSS state, and equivalent non-config meanings.
- R5. Persisted gift allocation intent is separate from runtime gift jobs. Canonical config uses discriminated `allocationMode` and `roomAllocations`; runtime jobs add `roomId`, selected `giftId`, and actual `count` only during execution.
- R6. Fixed allocation continues to accept non-negative integer counts and one optional `-1` remainder entry. Weighted allocation accepts finite non-negative weights. The two entry shapes cannot be mixed.
- R7. The old double-card room boolean map is migrated to `participatingRoomIds`; the task switch uses `enabled`, while actual card state keeps `active`.
- R8. New canonical fields take precedence over legacy fields. Successful API responses and disk writes contain only canonical fields; the application does not dual-write old formats.
- R9. The exact old keepalive default `0 0 8 */7 * *` migrates to `0 0 8 * * 3`. Missing keepalive cron uses the new default. Every other valid user-supplied six-field expression is preserved after trimming.
- R10. Defaults, examples, API responses, persistence, and public diagnostic objects use stable canonical ordering. Imports, local variables, and internal temporary objects are not reordered for visual symmetry.
- R11. Rename or restructure shared parameters only when the changed contract otherwise creates a concrete positional or ownership risk. Do not perform a repository-wide signature audit.
- R12. The WebUI keeps its current layout, interactions, Chinese copy, refresh behavior, and authoritative save-response handling. It changes only the reads and writes required by the canonical contract.
- R13. Cookie diagnostics never expose raw Cookie values. Diagnostic changes are limited to misleading names, duplicate fields, and stable public grouping required by this migration.
- R14. Old-program rollback requires a pre-upgrade config backup because canonical writes are one-way. Upgrade and rollback documentation must state this explicitly.
- R15. Do not introduce a generic migration framework, schema registry, repository layer, event bus, or another normal representation of the configuration.

## Acceptance Criteria

- [ ] AC1 (R1-R3, R8, R10): legacy, canonical, and mixed-precedence fixtures normalize to one canonical object with the specified top-level and nested key order.
- [ ] AC2 (R4, R7): configuration, API payloads, persistence, and WebUI state use `enabled`; searches classify every remaining `active` as legitimate runtime/UI state or a defect.
- [ ] AC3 (R5-R7): allocation config and runtime gift job types cannot be interchanged; weighted/fixed validation, `-1`, participating rooms, and stable gift-count results have contract coverage.
- [ ] AC4 (R9): defaults and examples use `0 0 8 * * 3`; the exact old default migrates to Wednesday; other six-field expressions remain unchanged.
- [ ] AC5 (R3, R8, R12-R13): the backend and WebUI round-trip one canonical config, Cookie credentials remain masked, and the WebUI needs no normal-path legacy fallback.
- [ ] AC6 (R11, R15): the final diff contains no repository-wide signature cleanup, mechanical ordering, broad module moves, or unsupported architectural layers.
- [ ] AC7 (R14): upgrade documentation describes backup, one-way write, and restore-based rollback, and a migrated config plus canonical saved config are manually inspected.
- [ ] AC8: changing a task default, adding one allocation validation rule, and adding one Cookie diagnostic flag each have one obvious primary owner and a bounded consumer list.
- [ ] AC9: `npm run lint`, `npm run type-check`, `npm run test:contracts`, `npm run build:docker`, and `git diff --check` pass.

## Out of Scope

- Go or another backend rewrite.
- Linux five-field cron migration.
- Vue/WebUI visual redesign.
- Repository-wide function signature, import, local-variable, or internal-object normalization.
- General config versioning, legacy dual-write, or automatic reverse migration.
- Business changes to gift selection, allocation results, task locking, Cookie recovery, or Yuba behavior beyond the explicit canonical contract.

## Planning References

- Stable baseline: `master@c0bcd29`
- Preserved WIP: `wip/ts-normalize-parameter-names-order@0a963e1`
- Rejected Go evaluation: `.trellis/tasks/archive/2026-07/07-21-rewrite-backend-in-go/`
